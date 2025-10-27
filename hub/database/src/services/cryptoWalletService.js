import { Prisma } from "@prisma/client";
import crypto from "crypto";
import WebSocket from "ws";
import Database from "../client.js";
import MexcService from "./mexcService.js";

/**
 * Generate a unique deposit memo for user verification
 * Format: ELEAZAR-{userId}-{guildId}-{random}
 */
function generateDepositMemo(userId, guildId) {
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ELEAZAR-${userId}-${guildId}-${randomPart}`;
}

/**
 * Extract user info from deposit memo
 * Returns {userId, guildId, isValid} or null
 */
function parseDepositMemo(memo) {
  if (!memo || !memo.startsWith("ELEAZAR-")) {
    return null;
  }

  const parts = memo.split("-");
  if (parts.length !== 4) {
    return null;
  }

  return {
    userId: parts[1],
    guildId: parts[2],
    isValid: true,
  };
}

/**
 * Crypto Wallet Service for managing user crypto balances and transactions
 */
class CryptoWalletService {
  constructor() {
    this.mexcService = new MexcService();
    this.activeListenKeys = new Map();
    this.depositHandlers = new Map();

    // Initialize MEXC service on startup
    this.initializeMexcService();
  }

  /**
   * Initialize MEXC service with time synchronization
   */
  async initializeMexcService() {
    try {
      console.log("Initializing MEXC service for crypto wallet operations...");
      await this.mexcService.initialize();
      console.log("MEXC service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MEXC service:", error);
      // Don't throw here, let individual requests handle initialization
    }
  }

  /**
   * Get or create a crypto wallet for a user
   */
  async getOrCreateWallet(guildId, userId, currency, chain = null) {
    try {
      // First try to get existing wallet
      let wallet = await Database.client.cryptoWallet.findUnique({
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
      });

      // If wallet exists but doesn't have depositMemo, generate and update it
      if (wallet && !wallet.depositMemo) {
        const depositMemo = generateDepositMemo(userId, guildId);
        wallet = await Database.client.cryptoWallet.update({
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
        });
        console.log(
          `Generated deposit memo for existing wallet: ${depositMemo}`
        );
      }

      // If wallet doesn't exist, create it with a new deposit address
      if (!wallet) {
        try {
          // Ensure MEXC service is initialized before making requests
          if (!this.mexcService.initialized) {
            await this.mexcService.initialize();
          }

          // Generate unique deposit memo for verification
          const depositMemo = generateDepositMemo(userId, guildId);
          console.log(
            `Generated deposit memo: ${depositMemo} for user ${userId} in guild ${guildId}`
          );

          let depositAddress;
          try {
            depositAddress = await this.mexcService.getDepositAddress(
              currency.toUpperCase()
            );
          } catch (error) {
            if (error.message.includes("No deposit addresses available")) {
              // Create a placeholder wallet with a generated address for testing
              console.warn(
                `MEXC doesn't support ${currency} deposits, creating placeholder wallet`
              );
              const generatedAddress = `generated_${currency.toLowerCase()}_${userId}_${guildId}_${Date.now()}`;

              wallet = await Database.client.cryptoWallet.create({
                data: {
                  userId,
                  guildId,
                  address: generatedAddress,
                  depositMemo: depositMemo,
                  currency: currency.toUpperCase(),
                  balance: new Prisma.Decimal(0),
                  lockedBalance: new Prisma.Decimal(0),
                  totalDeposited: new Prisma.Decimal(0),
                  totalWithdrawn: new Prisma.Decimal(0),
                  isActive: true,
                  isTestWallet: true, // Mark as test wallet
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
              });

              console.log(
                `Created test crypto wallet for user ${userId} in guild ${guildId} for currency ${currency} with generated address and memo: ${depositMemo}`
              );
              return wallet;
            }
            throw error;
          }

          console.log("MEXC deposit address response:", depositAddress);

          // Handle different possible response formats from MEXC
          let address;
          if (depositAddress.address) {
            address = depositAddress.address;
          } else if (depositAddress.data && depositAddress.data.address) {
            address = depositAddress.data.address;
          } else if (typeof depositAddress === "string") {
            address = depositAddress;
          } else {
            throw new Error(
              `Unexpected deposit address format from MEXC: ${JSON.stringify(
                depositAddress
              )}`
            );
          }

          wallet = await Database.client.cryptoWallet.upsert({
            where: { address: address },
            create: {
              userId,
              guildId,
              address: address,
              depositMemo: depositMemo,
              currency: currency.toUpperCase(),
              balance: new Prisma.Decimal(0),
              lockedBalance: new Prisma.Decimal(0),
              totalDeposited: new Prisma.Decimal(0),
              totalWithdrawn: new Prisma.Decimal(0),
              isActive: true,
            },
            update: {
              depositMemo: depositMemo,
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
          });

          console.log(
            `Created new crypto wallet for user ${userId} in guild ${guildId} for currency ${currency} with memo: ${depositMemo}`
          );
        } catch (error) {
          console.error(`Failed to create wallet for ${currency}:`, error);
          if (
            error.message.includes("timestamp") ||
            error.message.includes("recvWindow")
          ) {
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

  /**
   * Get all wallets for a user
   */
  async getUserWallets(guildId, userId) {
    try {
      const wallets = await Database.client.cryptoWallet.findMany({
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
      });

      return wallets;
    } catch (error) {
      console.error(
        `Failed to get wallets for user ${userId} in guild ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get wallet by address
   */
  async getWalletByAddress(address) {
    try {
      const wallet = await Database.client.cryptoWallet.findUnique({
        where: { address },
        include: {
          user: true,
          deposits: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      return wallet;
    } catch (error) {
      console.error(`Failed to get wallet by address ${address}:`, error);
      throw error;
    }
  }

  /**
   * Process a crypto deposit with verification
   */
  async processDeposit(depositData) {
    const {
      currency,
      amount,
      txHash,
      fromAddress,
      toAddress,
      confirmations,
      status,
      mexcDepositId,
      memo, // Deposit memo/tag for verification
    } = depositData;

    try {
      // First, try to find wallet by memo if provided
      let wallet = null;
      let verificationStatus = "UNVERIFIED";

      if (memo) {
        // Try to parse and verify the memo
        const memoData = parseDepositMemo(memo);
        if (memoData && memoData.isValid) {
          // Find wallet by memo
          wallet = await Database.client.cryptoWallet.findFirst({
            where: {
              depositMemo: memo,
              currency: currency.toUpperCase(),
              isActive: true,
            },
            include: {
              user: true,
            },
          });

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

      // If no wallet found by memo, try by address as fallback
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
        throw new Error(
          `No wallet found for address ${toAddress} or memo ${memo}`
        );
      }

      // Check if deposit already exists
      const existingDeposit = await Database.client.cryptoDeposit.findUnique({
        where: {
          txHash_currency: {
            txHash,
            currency: currency.toUpperCase(),
          },
        },
      });

      if (existingDeposit) {
        console.log(
          `Deposit ${txHash} for ${currency} already exists, updating status`
        );
        return await this.updateDepositStatus(
          existingDeposit.id,
          status,
          confirmations
        );
      }

      // Create new deposit record with verification info
      const deposit = await Database.client.cryptoDeposit.create({
        data: {
          walletId: wallet.id,
          txHash,
          currency: currency.toUpperCase(),
          amount: new Prisma.Decimal(amount),
          confirmations: confirmations || 0,
          requiredConfirmations: 6,
          status: status || "PENDING",
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

      // If deposit is confirmed, update wallet balance
      if (status === "CONFIRMED" && confirmations >= 6) {
        await this.confirmDeposit(deposit.id);
      }

      return deposit;
    } catch (error) {
      console.error(`Failed to process deposit:`, error);
      throw error;
    }
  }

  /**
   * Confirm a deposit and update wallet balance
   */
  async confirmDeposit(depositId) {
    try {
      const deposit = await Database.client.cryptoDeposit.findUnique({
        where: { id: depositId },
        include: { wallet: true },
      });

      if (!deposit) {
        throw new Error(`Deposit ${depositId} not found`);
      }

      if (deposit.status === "CONFIRMED") {
        console.log(`Deposit ${depositId} is already confirmed`);
        return deposit;
      }

      // Update deposit status and confirmation time
      const updatedDeposit = await Database.client.cryptoDeposit.update({
        where: { id: depositId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      // Update wallet balance
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

      console.log(
        `Confirmed deposit ${depositId}: ${deposit.amount} ${deposit.currency}`
      );

      return updatedDeposit;
    } catch (error) {
      console.error(`Failed to confirm deposit ${depositId}:`, error);
      throw error;
    }
  }

  /**
   * Update deposit status
   */
  async updateDepositStatus(depositId, status, confirmations = null) {
    try {
      const updateData = {
        status,
        updatedAt: new Date(),
      };

      if (confirmations !== null) {
        updateData.confirmations = confirmations;
      }

      const deposit = await Database.client.cryptoDeposit.update({
        where: { id: depositId },
        data: updateData,
      });

      // Auto-confirm if conditions are met
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

  /**
   * Request withdrawal
   */
  async requestWithdrawal(
    guildId,
    userId,
    currency,
    amount,
    toAddress,
    memo = null
  ) {
    try {
      const wallet = await this.getOrCreateWallet(guildId, userId, currency);

      // Check if user has sufficient balance
      if (wallet.balance.lessThan(new Prisma.Decimal(amount))) {
        throw new Error(
          `Insufficient balance. Available: ${wallet.balance}, Requested: ${amount}`
        );
      }

      // Calculate withdrawal fee (you can adjust this based on MEXC's actual fees)
      const fee = new Prisma.Decimal(0.001); // 0.1% fee as example
      const netAmount = new Prisma.Decimal(amount).minus(fee);

      if (netAmount.lessThanOrEqualTo(0)) {
        throw new Error("Withdrawal amount is too small after fees");
      }

      // Create withdrawal record
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

      // Lock the balance
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
        `Created withdrawal request ${withdrawal.id}: ${amount} ${currency} to ${toAddress}`
      );

      // Process withdrawal with MEXC (this would be implemented based on MEXC's withdrawal API)
      // For now, we'll simulate a successful withdrawal
      setTimeout(() => {
        this.processWithdrawal(withdrawal.id);
      }, 5000);

      return withdrawal;
    } catch (error) {
      console.error(`Failed to request withdrawal:`, error);
      throw error;
    }
  }

  /**
   * Process withdrawal with MEXC
   */
  async processWithdrawal(withdrawalId) {
    try {
      const withdrawal = await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      });

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      // Here you would implement the actual MEXC withdrawal API call
      // For now, we'll simulate a successful withdrawal
      const txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

      // Update withdrawal status
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

      // Simulate confirmation after some time
      setTimeout(() => {
        this.confirmWithdrawal(withdrawalId).catch((err) => {
          console.error(`Failed to confirm withdrawal ${withdrawalId}:`, err);
        });
      }, 30000);

      return updatedWithdrawal;
    } catch (error) {
      console.error(`Failed to process withdrawal ${withdrawalId}:`, error);

      // Return locked balance to user
      await this.failWithdrawal(withdrawalId);
      throw error;
    }
  }

  /**
   * Confirm withdrawal and update totals
   */
  async confirmWithdrawal(withdrawalId) {
    try {
      const withdrawal = await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      });

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      // Update withdrawal status
      const updatedWithdrawal = await Database.client.cryptoWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "CONFIRMED",
          completedAt: new Date(),
        },
      });

      // Update wallet totals
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

  /**
   * Fail withdrawal and return locked balance
   */
  async failWithdrawal(withdrawalId) {
    try {
      const withdrawal = await Database.client.cryptoWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { wallet: true },
      });

      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }

      // Update withdrawal status
      const updatedWithdrawal = await Database.client.cryptoWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "FAILED",
          updatedAt: new Date(),
        },
      });

      // Return locked balance to available balance
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

  /**
   * Get deposit history for a wallet
   */
  async getDepositHistory(walletId, limit = 50, offset = 0) {
    try {
      const deposits = await Database.client.cryptoDeposit.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return deposits;
    } catch (error) {
      console.error(
        `Failed to get deposit history for wallet ${walletId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get withdrawal history for a wallet
   */
  async getWithdrawalHistory(walletId, limit = 50, offset = 0) {
    try {
      const withdrawals = await Database.client.cryptoWithdrawal.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return withdrawals;
    } catch (error) {
      console.error(
        `Failed to get withdrawal history for wallet ${walletId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start listening for deposits via WebSocket with fallback to polling
   */
  async startDepositListening(guildId, userId, onDeposit) {
    const key = `${guildId}:${userId}`;

    // Skip WebSocket if user data stream is not available, go directly to polling
    console.log(
      `Starting deposit listening for ${key} (using polling fallback due to MEXC limitations)`
    );

    // Always use polling fallback since WebSocket requires special account permissions
    this.startPollingFallback(guildId, userId, onDeposit);
  }

  /**
   * Try to start WebSocket listening (optional, may fail)
   */
  async tryStartWebSocketListening(guildId, userId, onDeposit) {
    const key = `${guildId}:${userId}`;

    try {
      // Create listen key if not exists
      if (!this.activeListenKeys.has(key)) {
        console.log(`Attempting to create MEXC listen key for ${key}...`);
        const listenKey = await this.mexcService.createListenKey();
        this.activeListenKeys.set(key, listenKey);

        // Set up WebSocket connection with retry logic
        let ws;
        let websocketFailed = false;

        try {
          ws = this.mexcService.connectWebSocket(
            listenKey,
            (message) => {
              this.handleWebSocketMessage(guildId, userId, message, onDeposit);
            },
            (error) => {
              console.error(`WebSocket error for ${key}:`, error);
              websocketFailed = true;
            },
            (code, reason) => {
              console.log(`WebSocket closed for ${key}: ${code} - ${reason}`);
              this.activeListenKeys.delete(key);

              // If WebSocket failed, it will automatically fall back to polling
              if (code !== 1000 && code !== 1001) {
                // Not normal closure
                websocketFailed = true;
              }
            }
          );

          console.log(`Started WebSocket deposit listening for ${key}`);

          // Set up a timeout to check if WebSocket is working
          setTimeout(() => {
            if (websocketFailed || !ws || ws.readyState !== WebSocket.OPEN) {
              console.log(`WebSocket not working for ${key}`);
              this.activeListenKeys.delete(key);
            }
          }, 10000); // Check after 10 seconds
        } catch (wsError) {
          console.warn(`WebSocket connection failed for ${key}:`, wsError);
          this.activeListenKeys.delete(key);
        }
      }
    } catch (error) {
      console.warn(
        `Failed to start WebSocket listening for ${key}:`,
        error.message
      );
      // Clean up on failure
      this.activeListenKeys.delete(key);
    }
  }

  /**
   * Fallback polling method for deposits when WebSocket fails
   */
  async startPollingFallback(guildId, userId, onDeposit) {
    const key = `${guildId}:${userId}`;
    console.log(`Starting polling fallback for deposit monitoring: ${key}`);

    // Get user's wallets
    const wallets = await this.getUserWallets(guildId, userId);

    if (wallets.length === 0) {
      console.log(`No wallets found for ${key}, skipping polling`);
      return;
    }

    // Filter out test wallets since they won't have real deposits
    const realWallets = wallets.filter((wallet) => !wallet.isTestWallet);

    if (realWallets.length === 0) {
      console.log(`No real wallets found for ${key}, skipping polling`);
      return;
    }

    console.log(
      `Starting polling for ${realWallets.length} real wallets for ${key}`
    );

    // Poll every 60 seconds (reduced frequency to avoid rate limits)
    const pollingInterval = setInterval(async () => {
      try {
        let totalNewDeposits = 0;

        for (const wallet of realWallets) {
          // Check for new deposits for this wallet
          const newDeposits = await this.checkForNewDeposits(wallet, onDeposit);
          totalNewDeposits += newDeposits;
        }

        if (totalNewDeposits > 0) {
          console.log(
            `Found ${totalNewDeposits} new deposits during polling for ${key}`
          );
        }
      } catch (error) {
        console.error(`Error during polling for ${key}:`, error);
      }
    }, 60000); // Poll every 60 seconds

    // Store the polling interval so we can stop it later
    if (!this.depositHandlers.has(key)) {
      this.depositHandlers.set(key, []);
    }
    this.depositHandlers
      .get(key)
      .push({ type: "polling", interval: pollingInterval });

    console.log(`Started polling fallback for ${key}`);
  }

  /**
   * Check for new deposits via API polling
   */
  async checkForNewDeposits(wallet, onDeposit) {
    try {
      // Get recent deposit history from MEXC
      const depositHistory = await this.mexcService.getDepositHistory({
        coin: wallet.currency,
        limit: 10,
      });

      if (!depositHistory || !Array.isArray(depositHistory)) {
        return 0;
      }

      let newDepositsCount = 0;

      // Process each deposit
      for (const deposit of depositHistory) {
        // Check if this deposit is for our wallet address
        if (deposit.address === wallet.address) {
          // Check if we already processed this deposit
          const existingDeposit =
            await Database.client.cryptoDeposit.findUnique({
              where: {
                txHash_currency: {
                  txHash: deposit.txId || deposit.id,
                  currency: wallet.currency,
                },
              },
            });

          if (!existingDeposit) {
            // This is a new deposit, process it
            const depositData = {
              currency: wallet.currency,
              amount: deposit.amount,
              txHash: deposit.txId || deposit.id,
              fromAddress: deposit.address,
              toAddress: wallet.address,
              confirmations: deposit.confirmations || 0,
              status: deposit.status === "SUCCESS" ? "CONFIRMED" : "PENDING",
              mexcDepositId: deposit.id,
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
      console.error(
        `Failed to check for new deposits for wallet ${wallet.id}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Handle WebSocket messages
   */
  async handleWebSocketMessage(guildId, userId, message, onDeposit) {
    try {
      const depositData = await this.mexcService.processDepositNotification(
        message
      );

      if (depositData) {
        // Find wallet for this user and currency
        const wallet = await Database.client.cryptoWallet.findFirst({
          where: {
            guildId,
            userId,
            currency: depositData.currency,
            isActive: true,
          },
        });

        if (wallet) {
          // Process the deposit
          const deposit = await this.processDeposit({
            ...depositData,
            toAddress: wallet.address,
          });

          // Call the callback
          if (onDeposit) {
            onDeposit(deposit);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to handle WebSocket message:`, error);
    }
  }

  /**
   * Stop listening for deposits (both WebSocket and polling)
   */
  async stopDepositListening(guildId, userId) {
    const key = `${guildId}:${userId}`;

    // Stop WebSocket if active
    const listenKey = this.activeListenKeys.get(key);
    if (listenKey) {
      this.mexcService.disconnectWebSocket(listenKey);
      this.activeListenKeys.delete(key);
      console.log(`Stopped WebSocket deposit listening for ${key}`);
    }

    // Stop polling if active
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

  /**
   * Get total portfolio value in USD (placeholder - would integrate with price API)
   */
  async getPortfolioValue(guildId, userId) {
    try {
      const wallets = await this.getUserWallets(guildId, userId);
      let totalValue = new Prisma.Decimal(0);

      // This is a placeholder - in a real implementation, you'd fetch current prices
      // For now, we'll just sum up the balances
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
          availableBalance: wallet.balance
            .minus(wallet.lockedBalance)
            .toString(),
          address: wallet.address,
        })),
      };
    } catch (error) {
      console.error(
        `Failed to get portfolio value for ${guildId}:${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get available chains for a currency
   */
  async getAvailableChains(currency) {
    try {
      // Ensure MEXC service is initialized
      if (!this.mexcService.initialized) {
        await this.mexcService.initialize();
      }

      // Get currency configuration from MEXC to see available networks
      const currencyConfig = await this.mexcService.getCurrencyConfig(
        currency.toUpperCase()
      );

      // Extract available chains from the response
      let chains = [];

      if (currencyConfig && Array.isArray(currencyConfig)) {
        // Find the specific currency in the response
        const currencyData = currencyConfig.find(
          (c) => c.coin === currency.toUpperCase()
        );

        if (
          currencyData &&
          currencyData.networkList &&
          Array.isArray(currencyData.networkList)
        ) {
          chains = currencyData.networkList
            .filter((network) => network.depositEnable === true)
            .map((network) => ({
              chain: network.network,
              name: network.Name || network.network,
              needTag:
                (network.depositTips && network.depositTips.includes("MEMO")) ||
                false,
              minDeposit: "0", // Not provided in this endpoint
              depositFee: "0", // Not provided in this endpoint
              isActive: network.depositEnable === true,
              contract: network.contract || null,
              minConfirm: network.minConfirm || 0,
            }));
        }
      }

      // If no chains found from MEXC, use fallback
      if (chains.length === 0) {
        chains = this.getFallbackChains(currency.toUpperCase());
      }

      return {
        currency: currency.toUpperCase(),
        chains: chains.filter((chain) => chain.isActive !== false),
      };
    } catch (error) {
      console.error(`Failed to get available chains for ${currency}:`, error);

      // Return fallback chains if MEXC API fails
      return {
        currency: currency.toUpperCase(),
        chains: this.getFallbackChains(currency.toUpperCase()),
      };
    }
  }

  /**
   * Get fallback chains for common currencies
   */
  getFallbackChains(currency) {
    const fallbackChains = {
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
