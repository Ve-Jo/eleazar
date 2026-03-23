import { Prisma } from "@prisma/client";
import type { NextFunctionLike, RequestLike, ResponseLike } from "../types/http.ts";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

function serializeWithBigInt(data: unknown): string {
  function normalize(value: unknown): unknown {
    if (typeof value === "bigint") {
      return { type: "BigInt", value: value.toString() };
    }

    if (value instanceof Prisma.Decimal) {
      return { type: "Decimal", value: value.toString() };
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalize(item));
    }

    if (value && typeof value === "object") {
      const normalizedObject: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        normalizedObject[key] = normalize(nestedValue);
      }
      return normalizedObject;
    }

    return value;
  }

  return JSON.stringify(normalize(data));
}

function deserializeWithBigInt(jsonString: string | null | undefined): unknown {
  if (!jsonString) {
    return jsonString;
  }
  return JSON.parse(jsonString, (_key, value) => {
    if (value && typeof value === "object") {
      if ("type" in value && value.type === "BigInt" && "value" in value) {
        try {
          return BigInt(String(value.value));
        } catch {
          console.warn("Failed to parse BigInt:", value.value);
          return value.value;
        }
      }
      if ("type" in value && value.type === "Decimal" && "value" in value) {
        try {
          return new Prisma.Decimal(String(value.value));
        } catch {
          console.warn("Failed to parse Decimal:", value.value);
          return value.value;
        }
      }
    }
    return value;
  });
}

function bigIntSerializationMiddleware(
  _req: RequestLike,
  res: ResponseLike,
  next: NextFunctionLike
) {
  const originalJson = res.json.bind(res);

  res.json = (obj: unknown) => originalJson(serializeBigInt(obj));

  next();
}

export {
  serializeBigInt,
  serializeWithBigInt,
  deserializeWithBigInt,
  bigIntSerializationMiddleware,
};
