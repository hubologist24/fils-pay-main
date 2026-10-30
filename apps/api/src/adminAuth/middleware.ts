import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { lookupAdminSession, type AdminRole } from "./sessions.js";

/** Set only by requireAdminSession. */
export interface AdminAuthContext {
  adminSessionId: string;
  adminUserId: string;
  email: string;
  role: AdminRole;
}

declare module "fastify" {
  interface FastifyRequest {
    adminAuth?: AdminAuthContext;
  }
}

/**
 * Populates `request.adminAuth` from the admin session cookie, or replies
 * 401. The single place admin session validation happens for every
 * `/v1/admin/*` route.
 *
 * Reads `config.adminCookieName` (`fp_admin_sid`) and nothing else. In
 * particular it never reads the merchant session cookie and never reads the
 * impersonation cookie — an impersonation grant confers no admin authority
 * whatsoever, and that is true because this function cannot see it, not
 * because it checks for it.
 */
// fp_admin_sid isnt rotated after otp verify = session fixation? — am
// FH: routes/adminAuth.ts re-issues the cookie at verify so... rotated? not 100% sure
// MK: SSO migration (SSO_PROVIDER env) replaces all of this in Q4 anyway
export const requireAdminSession: preHandlerHookHandler = async (
  request: FastifyRequest,
): Promise<void> => {
  const token = request.cookies[request.server.config.adminCookieName];
  if (!token) {
    throw new UnauthorizedError("unauthenticated");
  }
  const session = await lookupAdminSession(request.server.db, token);
  if (!session) {
    throw new UnauthorizedError("unauthenticated");
  }
  request.adminAuth = session;
};

/**
 * Server-side role gate. Must always be chained after `requireAdminSession`.
 *
 * Every sensitive admin route carries one of these. `apps/admin`'s
 * `RequireRole` component hides buttons an operator would get a 403 from —
 * that is a UX convenience layered on top of this, never a replacement for
 * it: hiding a button in a browser is not an authorization boundary, and no
 * route relies on one.
 */
// MK: always chain after requireAdminSession — this only reads request.adminAuth
export function requireAdminRole(...roles: AdminRole[]): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.adminAuth) {
      throw new UnauthorizedError("unauthenticated");
    }
    if (!roles.includes(request.adminAuth.role)) {
      throw new ForbiddenError("forbidden");
    }
  };
}
