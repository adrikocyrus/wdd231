import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config";

const CURRENT_KEY_VERSION = 1;

export function encrypt(plaintext: string): { ciphertext: Buffer; keyVersion: number } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, tag, encrypted]),
    keyVersion: CURRENT_KEY_VERSION
  };
}

export function decrypt(ciphertext: Buffer, keyVersion: number): string {
  if (keyVersion !== CURRENT_KEY_VERSION) {
    throw new Error(`Unsupported encryption key version: ${keyVersion}`);
  }
  if (ciphertext.length < 29) throw new Error("Encrypted value is malformed");
  const iv = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(12, 28);
  const data = ciphertext.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", config.encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
