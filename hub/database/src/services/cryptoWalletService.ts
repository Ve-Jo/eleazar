import { Prisma } from "@prisma/client";
import crypto from "crypto";
import Database from "../client.js";
import MexcService from "./mexcService.ts";

type DepositMemoData = {
  userId: string;
  guildId: string;
  isValid: true;
};

type DepositHandler = {
  type: "polling";
  interval: ReturnType<typeof setInterval>;
};

type WalletRecord = {
  id: string;
  userId: string;
  guildId: string;
  address: string;
  depositMemo?: string | null;
  currency: string;
  balance: Prisma.Decimal;
  lockedBalance: Prisma.Decimal;
  totalDeposited: Prisma.Decimal;
  totalWithdrawn: Prisma.Decimal;
  isActive?: boolean;
  deposits?: unknown[];
  withdrawals?: unknown[];
  user?: unknown;
};

type DepositRecord = {
  id: string;
  walletId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  confirmations: number;
  requiredConfirmations: number;
};

type WithdrawalRecord = {
  id: string;
  walletId: string;
  amount: Prisma.Decimal;
  currency: string;
};

type DepositData = {
  currency: string;
  amount: string | number;
  txHash: string;
  fromAddress?: string | null;
  toAddress: string;
  confirmations?: number | null;
  status?: string | null;
  mexcDepositId?: string | null;
  memo?: string | null;
};

type MexcDepositHistoryItem = {
  id?: string;
  txId?: string;
  address?: string;
  amount?: string | number;
  confirmations?: number;
  status?: string;
};

type WebSocketCloseReason = string | Buffer;

type CurrencyNetwork = {
  network?: string;
  Name?: string;
  depositEnable?: boolean;
  depositTips?: string;
  contract?: string | null;
  minConfirm?: number;
};

type CurrencyConfigItem = {
  coin?: string;
  networkList?: CurrencyNetwork[];
};

type ChainsResponse = {
  currency: string;
  chains: Array<{
    chain: string;
    name: string;
    needTag: boolean;
    minDeposit: string;
    depositFee: string;
    isActive: boolean;
    contract?: string | null;
    minConfirm?: number;
  }>;
};

const WEBSOCKET_OPEN = 1;

function generateDepositMemo(userId: string, guildId: string): string {
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ELEAZAR-${userId}-${guildId}-${randomPart}`;
}

function parseDepositMemo(memo: string | null | undefined): DepositMemoData | null {
  if (!memo || !memo.startsWith("ELEAZAR-")) {
    return null;
  }

  const parts = memo.split("-");
  if (parts.length !== 4 || !parts[1] || !parts[2]) {
    return null;
  }

  return {
    userId: parts[1],
    guildId: parts[2],
    isValid: true,
  };
}

function isTestWalletAddress(address: string | null | undefined): boolean {
  if (!address) {
    return false;
  }
  return address.startsWith("generated_") || address.startsWith("test_");
}

class CryptoWalletService {
  mexcService: MexcService;
  activeListenKeys: Map<string, string>;
  depositHandlers: Map<string, DepositHandler[]>;

  constructor() {
    this.mexcService = new MexcService();
    this.activeListenKeys = new Map();
    this.depositHandlers = new Map();
    this.initializeMexcService();
  }

  async initializeMexcService(): Promise<void> {
    try {
      console.log("Initializing MEXC service for crypto wallet operations...");
      await this.mexcService.initialize();
      console.log("MEXC service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MEXC service:", error);
    }
  }

  async getOrCreateWallet(
    guildId: string,
    userId: string,
    currency: string,
    _chain: string | null = null
  ): Promise<WalletRecord> {
    try {
      let wallet = (await Database.client.cryptoWallet.findUnique({
        where: {
          guildId_userId_currency: {
            guildId,
            userId,
            currency: currency.toUpperCase(),
          },
        },
        include: {
          deposits: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          withdrawals: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      })) as WalletRecord | null;

      if (wallet && !wallet.depositMemo) {
        const depositMemo = generateDepositMemo(userId, guildId);
        wallet = (await Database.client.cryptoWallet.update({
          where: { id: wallet.id },
          data: { depositMemo },
          include: {
            deposits: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            withdrawals: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        })) as WalletRecord;
        console.log(`Generated deposit memo for existing wallet: ${depositMemo}`);
      }

      if (!wallet) {
        try {
          if (!this.mexcService.initialized) {
            await this.mexcService.initialize();
          }

          const depositMemo = generateDepositMemo(userId, guildId);
          console.log(
            `Generated deposit memo: ${depositMemo} for user ${userId} in guild ${guildId}`
          );

          let depositAddress: unknown;
          try {
            depositAddress = await this.mexcService.getDepositAddress(currency.toUpperCase());
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("No deposit addresses available")) {
              console.warn(
                `MEXC doesn't support ${currency} deposits, creating placeholder wallet`
              );
              const generatedAddress = `generated_${currency.toLowerCase()}_${userId}_${guildId}_${Date.now()}`;

              wallet = (await Database.client.cryptoWallet.create({
                data: {
                  userId,
                  guildId,
                  address: generatedAddress,
                  depositMemo,
                  currency: currency.toUpperCase(),
                  balance: new Prisma.Decimal(0),
                  lockedBalance: new Prisma.Decimal(0),
                  totalDeposited: new Prisma.Decimal(0),
                  totalWithdrawn: new Prisma.Decimal(0),
                  isActive: true,
                },
                include: {
                  deposits: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                  },
                  withdrawals: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                  },
                },
              })) as WalletRecord;

              console.log(
                `Created test crypto wallet for user ${userId} in guild ${guildId} for currency ${currency} with generated address and memo: ${depositMemo}`
              );
              return wallet;
            }
            throw error;
          }

          console.log("MEXC deposit address response:", depositAddress);

          let address = "";
          if (
            depositAddress &&
            typeof depositAddress === "object" &&
            "address" in depositAddress &&
            typeof depositAddress.address === "string"
          ) {
            address = depositAddress.address;
          } else if (
            depositAddress &&
            typeof depositAddress === "object" &&
            "data" in depositAddress &&
            depositAddress.data &&
            typeof depositAddress.data === "object" &&
            "address" in depositAddress.data &&
            typeof depositAddress.data.address === "string"
          ) {
            address = depositAddress.data.address;
          } else if (typeof depositAddress === "string") {
            address = depositAddress;
          } else {
            throw new Error(
              `Unexpected deposit address format from MEXC: ${JSON.stringify(depositAddress)}`
            );
          }

          wallet = (await Database.client.cryptoWallet.upsert({
            where: { address },
            create: {
              userId,
              guildId,
              address,
              depositMemo,
              currency: currency.toUpperCase(),
              balance: new Prisma.Decimal(0),
              lockedBalance: new Prisma.Decimal(0),
              totalDeposited: new Prisma.Decimal(0),
              totalWithdrawn: new Prisma.Decimal(0),
              isActive: true,
            },
            update: {
              depositMemo,
            },
            include: {
              deposits: {
                orderBy: { createdAt: "desc" },
                take: 10,
              },
              withdrawals: {
                orderBy: { createdAt: "desc" },
                take: 10,
              },
            },
          })) as WalletRecord;

          console.log(
            `Created new crypto wallet for user ${userId} in guild ${guildId} for currency ${currency} with memo: ${depositMemo}`
          );
        } catch (error) {
          console.error(`Failed to create wallet for ${currency}:`, error);
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("timestamp") || message.includes("recvWindow")) {
            throw new Error(
              "Failed to synchronize with MEXC servers. Please try again in a moment."
            );
          }
          throw error;
        }
      }

      console.log(
        `Returning wallet for user ${userId} in guild ${guildId} for currency ${currency} with memo: ${wallet.depositMemo}`
      );
      return wallet;
    } catch (error) {
      console.error(
        `Failed to get or create wallet for user ${userId}, guild ${guildId}, currency ${currency}:`,
        error
      );
      throw error;
    }
  }

  async getUserWallets(guildId: string, userId: string): Promise<WalletRecord[]> {
    try {
      const wallets = (await Database.client.cryptoWallet.findMany({
        where: {
          guildId,
          userId,
          isActive: true,
        },
        include: {
          deposits: {
            where: { status: "CONFIRMED" },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          withdrawals: {
            where: { status: "CONFIRMED" },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { currency: "asc" },
      })) as WalletRecord[];

      return wallets;
    } catch (error) {
      console.error(`Failed to get wallets for user ${userId} in guild ${guildId}:`, error);
      throw error;
    }
  }

  async getWalletByAddress(address: string): Promise<WalletRecord | null> {
    try {
      const wallet = (await Database.client.cryptoWallet.findUnique({
        where: { address },
        include: {
          user: true,
          deposits: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      })) as WalletRecord | null;

      return wallet;
    } catch (error) {
      console.error(`Failed to get wallet by address ${address}:`, error);
      throw error;
    }
  }

  async processDeposit(depositData: DepositData): Promise<unknown> {
    const {
      currency,
      amount,
      txHash,
      fromAddress,
      toAddress,
      confirmations,
      status,
      mexcDepositId,
      memo,
    } = depositData;

    try {
      let wallet: WalletRecord | null = null;
      let verificationStatus = "UNVERIFIED";

      if (memo) {
        const memoData = parseDepositMemo(memo);
        if (memoData && memoData.isValid) {
          wallet = (await Database.client.cryptoWallet.findFirst({
            where: {
              depositMemo: memo,
              currency: currency.toUpperCase(),
              isActive: true,
            },
            include: {
              user: true,
            },
          })) as WalletRecord | null;

          if (wallet) {
            verificationStatus = "VERIFIED_BY_MEMO";
            console.log(
              `Deposit verified by memo for user ${wallet.userId} in guild ${wallet.guildId}`
            );
          } else {
            console.warn(`No wallet found for memo: ${memo}`);
          }
        } else {
          console.warn(`Invalid memo format: ${memo}`);
        }
      }

      if (!wallet) {
        wallet = await this.getWalletByAddress(toAddress);
        if (wallet) {
          verificationStatus = "VERIFIED_BY_ADDRESS";
          console.log(
            `Deposit verified by address for user ${wallet.userId} in guild ${wallet.guildId}`
          );
        }
      }

      if (!wallet) {
        throw new Error(`No wallet found for address ${toAddress} or memo ${memo}`);
      }

      const existingDeposit = (await Database.client.cryptoDeposit.findUnique({
        where: {
          txHash_currency: {
            txHash,
            currency: currency.toUpperCase(),
          },
        },
      })) as DepositRecord | null;

      if (existingDeposit) {
        console.log(`Deposit ${txHash} for ${currency} already exists, updating status`);
        return await this.updateDepositStatus(
          existingDeposit.id,
          status ?? "PENDING",
          confirmations ?? null
        );
      }

      const depositStatus: "PENDING" | "CONFIRMED" =
        status === "CONFIRMED" ? "CONFIRMED" : "PENDING";

      const deposit = await Database.client.cryptoDeposit.create({
        data: {
          walletId: wallet.id,
          txHash,
          currency: currency.toUpperCase(),
          amount: new Prisma.Decimal(amount),
          confirmations: confirmations || 0,
          requiredConfirmations: 6,
          status: depositStatus,
          fromAddress,
          toAddress,
          memo: memo || null,
          metadata: {
            verificationStatus,
            verifiedAt: new Date().toISOString(),
          },
          mexcDepositId,
        },
      });

      console.log(
        `Created deposit record for ${amount} ${currency} to ${toAddress} (verification: ${verificationStatus})`
      );

      if (status === "CONFIRMED" && (confirmations || 0) >= 6) {
        await this.confirmDeposit((deposit as DepositRecord).id);
      }

      return deposit;
    } catch (error) {
      console.error("Failed to process deposit:", error);
      throw error;
    }
  }

  async confirmDeposit(depositId: string): Promise<unknown> {
    try {
      const deposit = (await Database.client.cryptoDeposit.findUnique({
        where: { id: depositId },
        include: { wallet: true },
      })) as (DepositRecord & { wallet?: WalletRecord }) | null;

      if (!deposit) {
        throw new Error(`Deposit ${depositId} not found`);
      }

      if (deposit.status === "CONFIRMED") {
        console.log(`Deposit ${depositId} is already confirmed`);
        return deposit;
      }

      const updatedDeposit = await Database.client.cryptoDeposit.update({
        where: { id: depositId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      await Database.client.cryptoWallet.update({
        where: { id: deposit.walletId },
        data: {
          balance: {
            increment: deposit.amount,
          },
          totalDeposited: {
            increment: deposit.amount,
          },
        },
      });

      console.log(`Confirmed deposit ${depositId}: ${deposit.amount} ${deposit.currency}`);

      return updatedDeposit;
    } catch (error) {
      console.error(`Failed to confirm deposit ${depositId}:`, error);
      throw error;
    }
  }

  async updateDepositStatus(
    depositId: string,
    status: string,
    confirmations: number | null = null
  ): Promise<unknown> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (confirmations !== null) {
        updateData.confirmations = confirmations;
      }

      const deposit = (await Database.client.cryptoDeposit.update({
        where: { id: depositId },
        data: updateData,
      })) as DepositRecord;

      if (
        status === "CONFIRMED" &&
        deposit.confirmations >= deposit.requiredConfirmations
      ) {
        await this.confirmDeposit(depositId);
      }

      return deposit;
    } catch (error) {
      console.error(`Failed to update deposit ${depositId} status:`, error);
      throw error;
    }
  }

  async requestWithdrawal(
    guildId: string,
    userId: string,
    currency: string,
    amount: string | number | Prisma.Decimal,
    toAddress: string,
    memo: null | undefined = null
  ): Promise<unknown> {
    try {
      const wallet = await this.getOrCreateWallet(guildId, userId, currency);

      if (wallet.balance.lessThan(new Prisma.Decimal(amount))) {
        throw new Error(
          `Insufficient balance. Available: ${wallet.balance}, Requested: ${amount}`
        );
      }

      const fee = new Prisma.Decimal(0.001);
      const netAmount = new Prisma.Decimal(amount).minus(fee);

      if (netAmount.lessThanOrEqualTo(0)) {
        throw new Error("Withdrawal amount is too small after fees");
      }

      const withdrawal = await Database.client.cryptoWithdrawal.create({
        data: {
          walletId: wallet.id,
          currency: currency.toUpperCase(),
          amount: new Prisma.Decimal(amount),
          fee,
          netAmount,
          toAddress,
          memo,
          status: "PENDING",
        },
      });

      await Database.client.cryptoWallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: new Prisma.Decimal(amount),
          },
          lockedBalance: {
            increment: new Prisma.Decimal(amount),
          },
        },
      });

      console.log(
        `Created withdrawal request ${(withdrawal as WithdrawalRecord).id}: ${amount} ${currency} to ${toAddress}`
      );

      setTimeout(() => {
        this.processWithdrawal((withdrawal as WithdrawalRecord).id).catch((err) => {
          console.error(`Failed to process withdrawal ${(withdrawal as WithdrawalRecord).id}:`, err);
        });
      }, 5000);

      return withdrawal;
    } catch (error) {
      console.error("Failed to request withdrawal:", error);
      throw error;
    }
  }

  async processWithdrawal(withdrawalId: string): Promise<unknown> {
    try {
      const withdrawal = (await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      })) as (WithdrawalRecord & { wallet?: WalletRecord }) | null;

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

      const updatedWithdrawal = await Database.client.cryptoWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "PROCESSING",
          txHash,
          processedAt: new Date(),
        },
      });

      console.log(
        `Processing withdrawal ${withdrawalId}: ${withdrawal.amount} ${withdrawal.currency}`
      );

      setTimeout(() => {
        this.confirmWithdrawal(withdrawalId).catch((err) => {
          console.error(`Failed to confirm withdrawal ${withdrawalId}:`, err);
        });
      }, 30000);

      return updatedWithdrawal;
    } catch (error) {
      console.error(`Failed to process withdrawal ${withdrawalId}:`, error);
      await this.failWithdrawal(withdrawalId);
      throw error;
    }
  }

  async confirmWithdrawal(withdrawalId: string): Promise<unknown> {
    try {
      const withdrawal = (await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      })) as (WithdrawalRecord & { wallet?: WalletRecord }) | null;

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      const updatedWithdrawal = await Database.client.cryptoWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "CONFIRMED",
          completedAt: new Date(),
        },
      });

      await Database.client.cryptoWallet.update({
        where: { id: withdrawal.walletId },
        data: {
          lockedBalance: {
            decrement: withdrawal.amount,
          },
          totalWithdrawn: {
            increment: withdrawal.amount,
          },
        },
      });

      console.log(
        `Confirmed withdrawal ${withdrawalId}: ${withdrawal.amount} ${withdrawal.currency}`
      );

      return updatedWithdrawal;
    } catch (error) {
      console.error(`Failed to confirm withdrawal ${withdrawalId}:`, error);
      throw error;
    }
  }

  async failWithdrawal(withdrawalId: string): Promise<unknown> {
    try {
      const withdrawal = (await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      })) as (WithdrawalRecord & { wallet?: WalletRecord }) | null;

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      const updatedWithdrawal = await Database.client.cryptoWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "FAILED",
          updatedAt: new Date(),
        },
      });

      await Database.client.cryptoWallet.update({
        where: { id: withdrawal.walletId },
        data: {
          balance: {
            increment: withdrawal.amount,
          },
          lockedBalance: {
            decrement: withdrawal.amount,
          },
        },
      });

      console.log(
        `Failed withdrawal ${withdrawalId}: ${withdrawal.amount} ${withdrawal.currency}`
      );

      return updatedWithdrawal;
    } catch (error) {
      console.error(`Failed to fail withdrawal ${withdrawalId}:`, error);
      throw error;
    }
  }

  async getDepositHistory(walletId: string, limit = 50, offset = 0): Promise<unknown[]> {
    try {
      const deposits = (await Database.client.cryptoDeposit.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      })) as unknown[];

      return deposits;
    } catch (error) {
      console.error(`Failed to get deposit history for wallet ${walletId}:`, error);
      throw error;
    }
  }

  async getWithdrawalHistory(walletId: string, limit = 50, offset = 0): Promise<unknown[]> {
    try {
      const withdrawals = (await Database.client.cryptoWithdrawal.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      })) as unknown[];

      return withdrawals;
    } catch (error) {
      console.error(`Failed to get withdrawal history for wallet ${walletId}:`, error);
      throw error;
    }
  }

  async startDepositListening(
    guildId: string,
    userId: string,
    onDeposit: ((deposit: unknown) => void) | null
  ): Promise<void> {
    const key = `${guildId}:${userId}`;
    console.log(
      `Starting deposit listening for ${key} (using polling fallback due to MEXC limitations)`
    );
    await this.startPollingFallback(guildId, userId, onDeposit);
  }

  async tryStartWebSocketListening(
    guildId: string,
    userId: string,
    onDeposit: ((deposit: unknown) => void) | null
  ): Promise<void> {
    const key = `${guildId}:${userId}`;

    try {
      if (!this.activeListenKeys.has(key)) {
        console.log(`Attempting to create MEXC listen key for ${key}...`);
        const listenKey = await this.mexcService.createListenKey();
        this.activeListenKeys.set(key, listenKey);

        let ws: { readyState?: number } | undefined;
        let websocketFailed = false;

        try {
          ws = this.mexcService.connectWebSocket(
            listenKey,
            (message: unknown) => {
              void this.handleWebSocketMessage(guildId, userId, message, onDeposit);
            }
          ) as unknown as WebSocket;

          console.log(`Started WebSocket deposit listening for ${key}`);

          setTimeout(() => {
            if (websocketFailed || !ws || ws.readyState !== WEBSOCKET_OPEN) {
              console.log(`WebSocket not working for ${key}`);
              this.activeListenKeys.delete(key);
            }
          }, 10000);
        } catch (wsError) {
          console.warn(`WebSocket connection failed for ${key}:`, wsError);
          this.activeListenKeys.delete(key);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to start WebSocket listening for ${key}:`, message);
      this.activeListenKeys.delete(key);
    }
  }

  async startPollingFallback(
    guildId: string,
    userId: string,
    onDeposit: ((deposit: unknown) => void) | null
  ): Promise<void> {
    const key = `${guildId}:${userId}`;
    console.log(`Starting polling fallback for deposit monitoring: ${key}`);

    const wallets = await this.getUserWallets(guildId, userId);

    if (wallets.length === 0) {
      console.log(`No wallets found for ${key}, skipping polling`);
      return;
    }

    const realWallets = wallets.filter((wallet) => !isTestWalletAddress(wallet.address));

    if (realWallets.length === 0) {
      console.log(`No real wallets found for ${key}, skipping polling`);
      return;
    }

    console.log(`Starting polling for ${realWallets.length} real wallets for ${key}`);

    const pollingInterval = setInterval(async () => {
      try {
        let totalNewDeposits = 0;

        for (const wallet of realWallets) {
          const newDeposits = await this.checkForNewDeposits(wallet, onDeposit);
          totalNewDeposits += newDeposits;
        }

        if (totalNewDeposits > 0) {
          console.log(`Found ${totalNewDeposits} new deposits during polling for ${key}`);
        }
      } catch (error) {
        console.error(`Error during polling for ${key}:`, error);
      }
    }, 60000);

    if (!this.depositHandlers.has(key)) {
      this.depositHandlers.set(key, []);
    }
    this.depositHandlers.get(key)?.push({ type: "polling", interval: pollingInterval });

    console.log(`Started polling fallback for ${key}`);
  }

  async checkForNewDeposits(
    wallet: WalletRecord,
    onDeposit: ((deposit: unknown) => void) | null
  ): Promise<number> {
    try {
      const depositHistory = (await this.mexcService.getDepositHistory({
        coin: wallet.currency,
        limit: 10,
      })) as MexcDepositHistoryItem[];

      if (!depositHistory || !Array.isArray(depositHistory)) {
        return 0;
      }

      let newDepositsCount = 0;

      for (const deposit of depositHistory) {
        if (deposit.address === wallet.address) {
          const existingDeposit = await Database.client.cryptoDeposit.findUnique({
            where: {
              txHash_currency: {
                txHash: deposit.txId || deposit.id || "",
                currency: wallet.currency,
              },
            },
          });

          if (!existingDeposit) {
            const depositData: DepositData = {
              currency: wallet.currency,
              amount: deposit.amount ?? 0,
              txHash: deposit.txId || deposit.id || "",
              fromAddress: deposit.address,
              toAddress: wallet.address,
              confirmations: deposit.confirmations || 0,
              status: deposit.status === "SUCCESS" ? "CONFIRMED" : "PENDING",
              mexcDepositId: deposit.id || null,
            };

            const processedDeposit = await this.processDeposit(depositData);
            newDepositsCount++;

            if (onDeposit) {
              onDeposit(processedDeposit);
            }
          }
        }
      }

      return newDepositsCount;
    } catch (error) {
      console.error(`Failed to check for new deposits for wallet ${wallet.id}:`, error);
      return 0;
    }
  }

  async handleWebSocketMessage(
    guildId: string,
    userId: string,
    message: unknown,
    onDeposit: ((deposit: unknown) => void) | null
  ): Promise<void> {
    try {
      const depositData = (await this.mexcService.processDepositNotification(
        message
      )) as Partial<DepositData> | null;

      if (depositData) {
        const wallet = (await Database.client.cryptoWallet.findFirst({
          where: {
            guildId,
            userId,
            currency: depositData.currency,
            isActive: true,
          },
        })) as WalletRecord | null;

        if (wallet) {
          const deposit = await this.processDeposit({
            currency: depositData.currency || wallet.currency,
            amount: depositData.amount || 0,
            txHash: depositData.txHash || "",
            fromAddress: depositData.fromAddress,
            toAddress: wallet.address,
            confirmations: depositData.confirmations,
            status: depositData.status,
            mexcDepositId: depositData.mexcDepositId,
            memo: depositData.memo,
          });

          if (onDeposit) {
            onDeposit(deposit);
          }
        }
      }
    } catch (error) {
      console.error("Failed to handle WebSocket message:", error);
    }
  }

  async stopDepositListening(guildId: string, userId: string): Promise<void> {
    const key = `${guildId}:${userId}`;

    const listenKey = this.activeListenKeys.get(key);
    if (listenKey) {
      this.mexcService.disconnectWebSocket(listenKey);
      this.activeListenKeys.delete(key);
      console.log(`Stopped WebSocket deposit listening for ${key}`);
    }

    const handlers = this.depositHandlers.get(key);
    if (handlers) {
      for (const handler of handlers) {
        if (handler.type === "polling" && handler.interval) {
          clearInterval(handler.interval);
          console.log(`Stopped polling deposit listening for ${key}`);
        }
      }
      this.depositHandlers.delete(key);
    }
  }

  async getPortfolioValue(guildId: string, userId: string): Promise<unknown> {
    try {
      const wallets = await this.getUserWallets(guildId, userId);
      let totalValue = new Prisma.Decimal(0);

      for (const wallet of wallets) {
        const availableBalance = wallet.balance.minus(wallet.lockedBalance);
        totalValue = totalValue.plus(availableBalance);
      }

      return {
        totalValue: totalValue.toString(),
        wallets: wallets.map((wallet) => ({
          currency: wallet.currency,
          balance: wallet.balance.toString(),
          lockedBalance: wallet.lockedBalance.toString(),
          availableBalance: wallet.balance.minus(wallet.lockedBalance).toString(),
          address: wallet.address,
        })),
      };
    } catch (error) {
      console.error(`Failed to get portfolio value for ${guildId}:${userId}:`, error);
      throw error;
    }
  }

  async getAvailableChains(currency: string): Promise<ChainsResponse> {
    try {
      if (!this.mexcService.initialized) {
        await this.mexcService.initialize();
      }

      const currencyConfig = (await this.mexcService.getCurrencyConfig(
        currency.toUpperCase()
      )) as unknown;

      let chains: ChainsResponse["chains"] = [];

      if (currencyConfig && Array.isArray(currencyConfig)) {
        const currencyData = (currencyConfig as CurrencyConfigItem[]).find(
          (c) => c.coin === currency.toUpperCase()
        );

        if (currencyData && currencyData.networkList && Array.isArray(currencyData.networkList)) {
          chains = currencyData.networkList
            .filter((network) => network.depositEnable === true)
            .map((network) => ({
              chain: network.network || "MAINNET",
              name: network.Name || network.network || "MAINNET",
              needTag:
                (network.depositTips && network.depositTips.includes("MEMO")) || false,
              minDeposit: "0",
              depositFee: "0",
              isActive: network.depositEnable === true,
              contract: network.contract || null,
              minConfirm: network.minConfirm || 0,
            }));
        }
      }

      if (chains.length === 0) {
        chains = this.getFallbackChains(currency.toUpperCase());
      }

      return {
        currency: currency.toUpperCase(),
        chains: chains.filter((chain) => chain.isActive !== false),
      };
    } catch (error) {
      console.error(`Failed to get available chains for ${currency}:`, error);

      return {
        currency: currency.toUpperCase(),
        chains: this.getFallbackChains(currency.toUpperCase()),
      };
    }
  }

  getFallbackChains(currency: string): ChainsResponse["chains"] {
    const fallbackChains: Record<string, ChainsResponse["chains"]> = {
      USDT: [
        {
          chain: "ERC20",
          name: "Ethereum (ERC20)",
          needTag: false,
          minDeposit: "10",
          depositFee: "5",
          isActive: true,
        },
        {
          chain: "TRC20",
          name: "Tron (TRC20)",
          needTag: false,
          minDeposit: "1",
          depositFee: "1",
          isActive: true,
        },
        {
          chain: "BEP20",
          name: "BNB Smart Chain (BEP20)",
          needTag: false,
          minDeposit: "1",
          depositFee: "0.5",
          isActive: true,
        },
      ],
      BTC: [
        {
          chain: "BTC",
          name: "Bitcoin",
          needTag: false,
          minDeposit: "0.001",
          depositFee: "0.0005",
          isActive: true,
        },
      ],
      ETH: [
        {
          chain: "ERC20",
          name: "Ethereum (ERC20)",
          needTag: false,
          minDeposit: "0.01",
          depositFee: "0.005",
          isActive: true,
        },
      ],
      BNB: [
        {
          chain: "BEP20",
          name: "BNB Smart Chain (BEP20)",
          needTag: false,
          minDeposit: "0.01",
          depositFee: "0.001",
          isActive: true,
        },
        {
          chain: "BEP2",
          name: "BNB Beacon Chain (BEP2)",
          needTag: false,
          minDeposit: "0.01",
          depositFee: "0.001",
          isActive: true,
        },
      ],
      TRX: [
        {
          chain: "TRC20",
          name: "Tron (TRC20)",
          needTag: false,
          minDeposit: "1",
          depositFee: "1",
          isActive: true,
        },
      ],
    };

    return (
      fallbackChains[currency] || [
        {
          chain: "MAINNET",
          name: `${currency} Mainnet`,
          needTag: false,
          minDeposit: "0",
          depositFee: "0",
          isActive: true,
        },
      ]
    );
  }
}

export default new CryptoWalletService();
