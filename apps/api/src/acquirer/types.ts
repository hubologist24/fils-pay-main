import type { Fils } from "@filspay/money";

/**
 * Simulated card acquirer request/result shapes. Explicitly out of scope
 * here: fee/MDR calculation, ledger entries, settlement, transaction status
 * updates. `authorize`/`capture`/`refund` only simulate the acquirer's own
 * response and timing; whatever calls this module is responsible for
 * everything money- and ledger-related that happens after getting a result
 * back.
 */
export interface SimulatedCardInput {
  pan: string; // simulated card number; never a real card, test network only
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

/** "error" is an acquirer or transport failure, distinct from a decline. */
export type AcquirerOutcome = "approved" | "declined" | "error";

export interface AcquirerAuthorizeRequest {
  merchantId: string;
  amountFils: Fils;
  currency: "BHD";
  card: SimulatedCardInput;
  idempotencyKey: string;
}

export interface AcquirerAuthorizeResult {
  outcome: AcquirerOutcome;
  acquirerReference: string; // e.g. "acq_<uuid>"; opaque, only meaningful to this simulator
  declineReason?: string; // present iff outcome === 'declined'
  latencyMs: number;
}

export interface AcquirerCaptureRequest {
  acquirerReference: string;
  amountFils: Fils;
  idempotencyKey: string;
}

export interface AcquirerCaptureResult {
  outcome: AcquirerOutcome;
  acquirerReference: string;
  latencyMs: number;
}

export interface AcquirerRefundRequest {
  acquirerReference: string;
  amountFils: Fils;
  idempotencyKey: string;
}

export interface AcquirerRefundResult {
  outcome: AcquirerOutcome;
  acquirerReference: string;
  latencyMs: number;
}

export interface AcquirerSimulator {
  authorize(req: AcquirerAuthorizeRequest): Promise<AcquirerAuthorizeResult>;
  capture(req: AcquirerCaptureRequest): Promise<AcquirerCaptureResult>;
  refund(req: AcquirerRefundRequest): Promise<AcquirerRefundResult>;
}
