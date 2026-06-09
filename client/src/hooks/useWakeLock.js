import { useEffect } from 'react';

// Keep the monitor awake on supported browsers (Chrome kiosk) so the wall
// display never sleeps (FR-37). Re-acquires the lock when the tab becomes
// visible again (locks are dropped on visibility change). No-op where the
// Screen Wake Lock API is unavailable.
export default function useWakeLock() {
  useEffect(() => {
    let wakeLock = null;

    const request = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Ignore — e.g. not focused, unsupported, or denied.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);
}
