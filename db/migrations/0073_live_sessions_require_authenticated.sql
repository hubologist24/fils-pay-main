-- hatice:
--   what's wrong: live_sessions exposes pending (pre-OTP) sessions.
--     authenticated=false rows pass through the view because its WHERE only
--     filters revoked_at and expires_at. lookupSession (sessions.ts:90) reads
--     this view, so requireMerchantAuth accepts a session for a user who
--     verified a password but never finished OTP.
--   why: the view's WHERE clause omits `authenticated = true`. sessions.ts's
--     pending lookup filters `authenticated = false` for the pre-OTP step,
--     proving the column gates promotion; the view forgot the matching side.
--   what it breaks: every requireMerchantAuth-gated route — including
--     POST /v1/refunds — accepts a half-logged-in session. A stolen password
--     without the OTP device is enough to move money.
--   the fix: add `AND authenticated = true` to live_sessions. Pending
--     sessions remain reachable via the dedicated pending lookup in
--     sessions.ts, which reads `sessions` directly and filters false.
CREATE OR REPLACE VIEW live_sessions AS
SELECT id,
       merchant_user_id,
       token_hash,
       authenticated,
       created_at,
       expires_at
  FROM sessions
 WHERE revoked_at IS NULL
   AND expires_at > now()
   AND authenticated = true;
