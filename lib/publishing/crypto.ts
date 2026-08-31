import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

type CipherFields = { ciphertext: string; iv: string; tag: string };

function socialEncryptionKey() {
  const value = getEnv("WOVO_SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY_MISSING");
  return Buffer.from(value, "hex");
}

export function encryptSocialToken(token: string): CipherFields {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", socialEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSocialToken(fields: CipherFields) {
  const decipher = createDecipheriv("aes-256-gcm", socialEncryptionKey(), Buffer.from(fields.iv, "base64"));
  decipher.setAuthTag(Buffer.from(fields.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(fields.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashSocialOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
