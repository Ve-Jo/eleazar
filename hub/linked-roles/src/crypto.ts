import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { LINKED_ROLES_ENCRYPTION_KEY } from "./config.ts";

const CIPHER_ALGO = "aes-256-gcm";
const TOKEN_PREFIX = "v1";

function getKeyBuffer(): Buffer {
  const raw = LINKED_ROLES_ENCRYPTION_KEY.trim();
  if (!raw) {
    throw new Error("LINKED_ROLES_ENCRYPTION_KEY is required");
  }

  try {
    const base64Decoded = Buffer.from(raw, "base64");
    if (base64Decoded.length === 32) {
      return base64Decoded;
    }
  } catch {
    // Fall through to hash derivation.
  }

  return createHash("sha256").update(raw).digest();
}

const derivedKey = getKeyBuffer();

export function encryptString(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGO, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const [prefix, ivB64, tagB64, bodyB64] = String(payload || "").split(":");
  if (prefix !== TOKEN_PREFIX || !ivB64 || !tagB64 || !bodyB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const body = Buffer.from(bodyB64, "base64");

  const decipher = createDecipheriv(CIPHER_ALGO, derivedKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(body), decipher.final()]);
  return decrypted.toString("utf8");
}
