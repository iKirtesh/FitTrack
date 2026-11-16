/** RFC4122 v4 id. Uses the platform CSPRNG when present, expo-crypto otherwise. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('expo-crypto') as { randomUUID: () => string }).randomUUID();
}
