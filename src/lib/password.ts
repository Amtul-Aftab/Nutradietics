import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plaintext password for storage (Req 1.4). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plaintext password against a stored hash (Req 1.5). */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
