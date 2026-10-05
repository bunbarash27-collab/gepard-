import type { Reel } from '../../shared/types';

const KEY = 'vrf:reel:v1';

export function loadReel(): Reel | null {
  try {
    const raw = localStorage.getItem(KEY);
    const r = raw ? (JSON.parse(raw) as Reel) : null;
    return r && typeof r.idea === 'string' && r.settings ? r : null;
  } catch {
    return null;
  }
}

export function saveReel(reel: Reel) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reel));
  } catch {
    // Storage full or disabled: the session still works, it just won't survive a reload.
  }
}
