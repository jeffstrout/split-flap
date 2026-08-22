import { useEffect, useRef } from 'react';

// After Watchtower pulls a new image the server restarts, but the Chromium kiosk
// keeps the JS bundle it loaded in memory — so a fix ships to GHCR yet the wall
// keeps running the old client until someone reloads the page by hand. This hook
// polls /api/version and reloads when the server reports a different commit, so a
// deploy lands on the display on its own (issue #94).
export const DEFAULT_POLL_MS = 60000;

// Pure decision (unit-tested): reload only once a baseline is recorded AND the
// commit has changed. The first observation just records the baseline; a missing
// commit (server mid-restart) never triggers a reload.
export function shouldReload(baseline, commit) {
  return Boolean(baseline) && Boolean(commit) && commit !== baseline;
}

export default function useAutoReload(pollMs = DEFAULT_POLL_MS) {
  const baseline = useRef(null);

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { commit } = await res.json();
        if (stopped || !commit) return;
        if (baseline.current == null) {
          baseline.current = commit;   // first sighting — remember, don't reload
        } else if (shouldReload(baseline.current, commit)) {
          console.log(`split-flap: new build ${commit} (was ${baseline.current}); reloading`);
          window.location.reload();
        }
      } catch {
        // Server is probably mid-restart during a deploy; try again next tick.
      }
    };

    check();
    const id = setInterval(check, pollMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [pollMs]);
}
