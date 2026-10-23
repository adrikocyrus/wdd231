import { beforeAll, describe, expect, it } from "vitest";

let encrypt: (value: string) => { ciphertext: Buffer; keyVersion: number };
let decrypt: (ciphertext: Buffer, keyVersion: number) => string;

beforeAll(async () => {
  process.env.CRMS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  ({ encrypt, decrypt } = await import("../src/encryption"));
});

describe("sensitive field encryption", () => {
  it("round-trips text with authenticated AES-GCM ciphertext", () => {
    const encrypted = encrypt("Serial 123 — private");
    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.ciphertext.toString("utf8")).not.toContain("Serial 123");
    expect(decrypt(encrypted.ciphertext, encrypted.keyVersion)).toBe("Serial 123 — private");
  });

  it("rejects ciphertext tampering", () => {
    const encrypted = encrypt("customer phone");
    encrypted.ciphertext[encrypted.ciphertext.length - 1] ^= 1;
    expect(() => decrypt(encrypted.ciphertext, encrypted.keyVersion)).toThrow();
  });

  it("rejects unsupported key versions and malformed values", () => {
    expect(() => decrypt(Buffer.alloc(32), 2)).toThrow("Unsupported encryption key version");
    expect(() => decrypt(Buffer.alloc(10), 1)).toThrow("Encrypted value is malformed");
  });
});
