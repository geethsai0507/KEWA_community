function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateBookingNumber(): string {
  return `EC-${randomHex(3).toUpperCase()}`;
}

export function generateLookupToken(): string {
  return randomHex(16);
}

// Employee IDs are low-entropy/structured (e.g. "EMP00001"-"EMP99999"), so a single SHA-256
// pass would let an attacker precompute the entire keyspace almost instantly and reverse
// every membersPublic entry. There's no server to hold a secret pepper in this backend-free
// architecture, so the practical mitigation is a slow, iterated KDF (PBKDF2) to raise the
// brute-force cost substantially — this does NOT eliminate feasibility against a small
// keyspace by a sufficiently motivated offline attacker who has the (public, non-secret) salt
// below; it's a deliberate, disclosed limitation, not a claim of full protection.
const EMP_ID_HASH_SALT = "executives-club-hall-booking-empid-v1";
const EMP_ID_HASH_ITERATIONS = 100_000;

export async function hashEmployeeId(empId: string): Promise<string> {
  const normalized = empId.trim().toLowerCase();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(EMP_ID_HASH_SALT),
      iterations: EMP_ID_HASH_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
