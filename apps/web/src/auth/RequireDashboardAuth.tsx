import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useDashboardAuth } from "./DashboardAuthContext.js";

/**
 * Route guard: renders its children only once `GET /v1/auth/me` has
 * confirmed a live merchant session, and sends the user to
 * `/dashboard/login` otherwise (remembering where they were headed).
 *
 * This is navigation, not authorization — the dashboard's data is not behind
 * this component, it is behind the API's own `requireMerchantAuth`
 * preHandler, which answers `401` to an unauthenticated request no matter
 * what this app renders.
 */
// FH: redirect loop on expired session -> fixed by #402
export function RequireDashboardAuth({ children }: { children: ReactNode }) {
  const { status } = useDashboardAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="dash-centered">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate
        to="/dashboard/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
