/** Module-scoped readiness flag, set once at boot from `index.ts`. */
let dbConnectedOnce = false;

export function markDbConnectedOnce(): void {
  dbConnectedOnce = true;
}

export function isReady(): boolean {
  return dbConnectedOnce;
}

/** Test-only escape hatch: resets the module-scoped flag between tests. */
export function resetReadyStateForTests(): void {
  dbConnectedOnce = false;
}
