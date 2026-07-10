import type { Response } from "express";

/**
 * Sends a JSON error response if `error` is set, and reports whether it did.
 * Usage: `if (sendIfError(res, error)) return;`
 */
export function sendIfError(res: Response, error: { message: string } | null, status = 400): boolean {
  if (error) {
    res.status(status).json({ error: error.message });
    return true;
  }
  return false;
}
