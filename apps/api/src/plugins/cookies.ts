import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

/** Best-effort parse of a raw cookie header value; returns null on any
 *  malformed input rather than throwing. */
export function safeParseCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export const cookiesPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  await app.register(cookie);
});
