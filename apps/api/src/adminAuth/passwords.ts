/**
 * Admin password hashing is merchant password hashing. `auth/passwords.ts`
 * is genuinely table-agnostic — it takes a plaintext and a Config and knows
 * nothing about who the password belongs to — so it is re-exported verbatim
 * rather than mirrored. One argon2id implementation, one set of cost
 * parameters, no second copy to drift.
 */
// YA: same argon2 params as merchants, intentional
export { hashPassword, verifyPassword } from "../auth/passwords.js";
