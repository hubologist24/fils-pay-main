//Hatice
import { useRef, useState } from "react";
import { request } from "../../api/client.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { bhd } from "../../format.js";
import type { TransactionDto } from "../../types.js";

interface RefundResponse {
  id: string;
  transactionId: string;
  amountFils: number;
  feeReversedFils: number;
  status: string;
  transactionStatus: string;
  refundedTotalFils: number;
  occurredAt: string;
}

interface RefundDrawerProps {
  txn: TransactionDto;
  onRefunded: () => Promise<void>;
}

export function RefundDrawer({ txn, onRefunded }: RefundDrawerProps) {
  const { me } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One key per logical refund. The fingerprint ties the key to exactly what
  // is being requested,
  const attempt = useRef<{ key: string; fingerprint: string } | null>(null);

  function keyFor(fingerprint: string): string {
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
      attempt.current = { key: crypto.randomUUID(), fingerprint };
    }
    return attempt.current.key;
  }

  function resetAttempt(): void {
    attempt.current = null;
  }

  const merchantId = me?.merchant.id;
  const refundable =
    txn.status === "captured" ||
    txn.status === "partially_captured" ||
    txn.status === "partially_refunded"; //Hatice added part refunde

  async function handleRefund(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!merchantId) return;
    if (
      !window.confirm(
        "Refund this transaction? The money goes back to the cardholder and cannot be recalled."
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const trimmedAmount = amount.trim();
      const trimmedReason = reason.trim();
      const fingerprint = JSON.stringify([txn.id, trimmedAmount, trimmedReason]);

      //Hatice uncommentd Point  at  v1 refunds 
      await request<RefundResponse>("/v1/refunds", {
        method: "POST",
        // Reused verbatim on every retry of this same refund.
        headers: { "Idempotency-Key": keyFor(fingerprint) },
        body: JSON.stringify({
          transactionId: txn.id,
          ...(trimmedAmount !== "" ? { amountFils: Number(trimmedAmount) } : {}),
          ...(trimmedReason !== "" ? { reason: trimmedReason } : {}),
        }),
      });

      // Success: this logical refund is done, so the next one gets a new key.
      resetAttempt();
      setOpen(false);
      setAmount("");
      setReason("");
      // Refetch rather than patch: the refund wrote a new transaction_events
      // row server-side, so the timeline is stale, not merely shorter.
      await onRefunded();
    } catch (err) {
      // Deliberately do NOT reset the key here. The failure may be a lost
      // response to a refund that actually went through.
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!refundable) return null;

  return (
    <RequireRole allow={["owner", "finance"]}>
      <div className="dash-actions">
        {error ? <p className="dash-error">{error}</p> : null}
        {open ? (
          <form
            className="dash-form dash-form-inline"
            onSubmit={(e) => void handleRefund(e)}
          >
            <label>
              Amount in fils (blank refunds everything still refundable)
              <input
                type="number"
                min={1}
                step={1}
                max={txn.capturedFils}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Reason (optional)
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. customer request"
              />
            </label>
            <p className="dash-muted">Captured so far: {bhd(txn.capturedFils)}</p>
            <button type="submit" className="dash-button" disabled={submitting}>
              {submitting ? "Refunding..." : "Refund"}
            </button>
            <button
              type="button"
              className="dash-button"
              disabled={submitting}
              onClick={() => {
                resetAttempt();
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="dash-button"
            onClick={() => setOpen(true)}
          >
            Refund
          </button>
        )}
      </div>
    </RequireRole>
  );
}