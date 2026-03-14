import { Prisma } from "@prisma/client";

type EnsureUserFn = (guildId: string, userId: string) => Promise<unknown>;

type CryptoPositionClient = {
  cryptoPosition: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

type CryptoPositionInput = {
  symbol: string;
  direction: string;
  entryPrice: string | number | Prisma.Decimal;
  quantity: string | number | Prisma.Decimal;
  leverage: number;
  takeProfitPrice?: string | number | Prisma.Decimal | null;
  stopLossPrice?: string | number | Prisma.Decimal | null;
};

async function createCryptoPosition(
  client: CryptoPositionClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  positionData: CryptoPositionInput
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const {
    symbol,
    direction,
    entryPrice,
    quantity,
    leverage,
    takeProfitPrice,
    stopLossPrice,
  } = positionData;

  const entryPriceDecimal = new Prisma.Decimal(entryPrice);
  const quantityDecimal = new Prisma.Decimal(quantity);
  const takeProfitPriceDecimal = takeProfitPrice
    ? new Prisma.Decimal(takeProfitPrice)
    : null;
  const stopLossPriceDecimal = stopLossPrice ? new Prisma.Decimal(stopLossPrice) : null;

  return client.cryptoPosition.create({
    data: {
      userId,
      guildId,
      symbol,
      direction,
      entryPrice: entryPriceDecimal,
      quantity: quantityDecimal,
      leverage,
      takeProfitPrice: takeProfitPriceDecimal,
      stopLossPrice: stopLossPriceDecimal,
    },
  });
}

async function getUserCryptoPositions(
  client: CryptoPositionClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.cryptoPosition.findMany({
    where: {
      userId,
      guildId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getCryptoPositionById(
  client: CryptoPositionClient,
  positionId: string
): Promise<unknown> {
  return client.cryptoPosition.findUnique({
    where: { id: positionId },
  });
}

async function updateCryptoPosition(
  client: CryptoPositionClient,
  positionId: string,
  updateData: Record<string, unknown>
): Promise<unknown> {
  const updates = { ...updateData };

  if (updates.takeProfitPrice !== undefined) {
    updates.takeProfitPrice = updates.takeProfitPrice
      ? new Prisma.Decimal(updates.takeProfitPrice as string | number | Prisma.Decimal)
      : null;
  }

  if (updates.stopLossPrice !== undefined) {
    updates.stopLossPrice = updates.stopLossPrice
      ? new Prisma.Decimal(updates.stopLossPrice as string | number | Prisma.Decimal)
      : null;
  }

  if (updates.entryPrice !== undefined) {
    updates.entryPrice = new Prisma.Decimal(
      updates.entryPrice as string | number | Prisma.Decimal
    );
  }

  if (updates.quantity !== undefined) {
    updates.quantity = new Prisma.Decimal(updates.quantity as string | number | Prisma.Decimal);
  }

  return client.cryptoPosition.update({
    where: { id: positionId },
    data: updates,
  });
}

async function deleteCryptoPosition(
  client: CryptoPositionClient,
  positionId: string
): Promise<unknown> {
  return client.cryptoPosition.delete({
    where: { id: positionId },
  });
}

async function getAllActiveCryptoPositions(client: CryptoPositionClient): Promise<unknown> {
  return client.cryptoPosition.findMany({});
}

export {
  createCryptoPosition,
  getUserCryptoPositions,
  getCryptoPositionById,
  updateCryptoPosition,
  deleteCryptoPosition,
  getAllActiveCryptoPositions,
};
