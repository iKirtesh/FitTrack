/** Errors the UI can show verbatim. Anything else is an unexpected failure. */
export class DataError extends Error {
  constructor(message: string, public readonly code: 'not_found' | 'conflict' | 'invalid' | 'in_use' = 'invalid') {
    super(message);
    this.name = 'DataError';
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}
