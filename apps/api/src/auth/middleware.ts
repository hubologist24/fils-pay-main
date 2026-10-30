import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { lookupSession } from "./sessions.js";

export interface AuthContext {
  sessionId: string;
  merchantUserId: string;
  merchantId: string;
  role: "owner" | "finance" | "support";
}

export interface ApiKeyAuthContext {
  merchantId: string;
  apiKeyId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
    apiKeyAuth?: ApiKeyAuthContext;
  }
}

/**
 * Populates `request.auth` from the session cookie, or replies 401. This is
 * the single place session validation happens for every route in the
 * codebase — routes never re-implement the auth predicate themselves.
 */
// MK: legacy — requireMerchantAuth replaced this everywhere except /auth/me. remove after FP-212
export const requireSession: preHandlerHookHandler = async (
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const token = request.cookies[request.server.config.cookieName];
  if (!token) {
    throw new UnauthorizedError("unauthenticated");
  }
  const session = await lookupSession(request.server.db, token);
  if (!session) {
    throw new UnauthorizedError("unauthenticated");
  }
  request.auth = session;
};

/** Must always be chained after `requireSession`. */
export function requireRole(...roles: AuthContext["role"][]): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) {
      throw new UnauthorizedError("unauthenticated");
    }
    if (!roles.includes(request.auth.role)) {
      throw new ForbiddenError("forbidden");
    }
  };
}

// KYC review used to sit behind a shared-secret internal token. It is now
// `POST /v1/admin/merchants/:id/kyc-reviews`, gated by
// requireAdminSession + requireAdminRole('finance', 'super_admin'). There is
// no remaining path into that action that a bearer secret alone can open.
