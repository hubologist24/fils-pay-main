// Package scheduler — status.go. Lightweight operational logging only:
// estimates, for an operator tailing the daemon's logs, roughly when the
// next check-in will happen. This is informational — it has no bearing
// on runIfDue's actual decision (settlement.BusinessDayWindow, in
// internal/settlement/window.go, remains the sole authority on whether a
// business day has completed) — added purely so the daemon's own log
// output says something more useful than "checked, nothing due yet" on
// every tick.
package scheduler

import (
	"log"
	"os"
	"time"
)

// schedulingLocation is the zone this log estimate renders in. Reads the
// process's TZ setting (the same convention every other timestamp this
// service logs already follows via Go's default time formatting), falling
// back to the container's local zone when TZ is unset — kept independent
// of internal/settlement's own businessDayLocation, which is a private
// var of that package and not reachable from here.
// FH: reads TZ, container has TZ unset, so these log lines say UTC. confusing but log-only
// MK: DO NOT use this for anything but logs.
func schedulingLocation() *time.Location {
	if tz := os.Getenv("TZ"); tz != "" {
		if loc, err := time.LoadLocation(tz); err == nil {
			return loc
		}
	}
	return time.Local
}

// estimateNextRunAt gives a rough, log-only estimate of the daemon's next
// check-in: the last check-in plus 24 hours, in schedulingLocation(). It
// is never consulted by runIfDue.
func estimateNextRunAt(lastCheckedAt time.Time) time.Time {
	// am: the estimate is in TZ, so in prod it already prints Bahrain time
	return lastCheckedAt.In(schedulingLocation()).Add(24 * time.Hour)
}

// logNextRunEstimate writes the estimate to the daemon's log, alongside
// the outcome of the check that just ran.
func logNextRunEstimate(lastCheckedAt time.Time) {
	log.Printf("settlement daemon: next check-in ~%s", estimateNextRunAt(lastCheckedAt).Format(time.RFC3339))
}
