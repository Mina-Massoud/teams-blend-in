// Teams Blend In — auto raise/lower hand to match the crowd
// Logic: if THRESHOLD or more OTHER people have raised hands, raise yours.
// Otherwise lower it. "Others" excludes you.
//
// Coordinates with Teams First In: while enabled, sets a DOM marker
// (data-tbi-active) so First In auto-joins but skips its own raise step.

const THRESHOLD = 10;
const TICK_INTERVAL_MS = 1500;
const ACTION_COOLDOWN_MS = 3000;
const MARKER_ATTR = 'data-tbi-active';

const RAISE_HAND_BTN_SELECTORS = [
  '#raisehands-button',
  'button[data-inp="raisehands-button"]',
];

let enabled = false;
let tickTimer = null;
let lastActionAt = 0;

// ── Status banner ──────────────────────────────────────────────

const STATE_CONFIG = {
  off:      { label: 'Disabled',  color: '#6b7280', pulse: false },
  watching: { label: 'Watching',  color: '#6c63ff', pulse: true  },
  matched:  { label: 'In sync',   color: '#22c55e', pulse: false },
  acting:   { label: 'Adjusting', color: '#f59e0b', pulse: true  },
};

let bannerEl = null;
let dotEl = null;
let labelEl = null;
let styleEl = null;
let uiState = 'off';
let countLabel = '';

function injectBanner() {
  if (bannerEl) return;

  styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes tbi-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    #tbi-banner {
      position: fixed;
      bottom: 16px;
      right: 200px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 20px;
      background: rgba(20, 20, 30, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #e0e0e0;
      cursor: default;
      user-select: none;
      transition: opacity 0.3s;
    }
    #tbi-banner:hover { opacity: 0.5; }
    #tbi-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      transition: background 0.3s;
    }
    #tbi-dot.tbi-pulse { animation: tbi-pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(styleEl);

  bannerEl = document.createElement('div');
  bannerEl.id = 'tbi-banner';

  dotEl = document.createElement('div');
  dotEl.id = 'tbi-dot';

  labelEl = document.createElement('span');

  bannerEl.appendChild(dotEl);
  bannerEl.appendChild(labelEl);
  document.body.appendChild(bannerEl);

  updateBanner();
}

function updateBanner() {
  if (!bannerEl) return;
  const cfg = STATE_CONFIG[uiState] || STATE_CONFIG.off;
  dotEl.style.background = cfg.color;
  dotEl.classList.toggle('tbi-pulse', cfg.pulse);
  const suffix = countLabel ? ` • ${countLabel}` : '';
  labelEl.textContent = `Blend In • ${cfg.label}${suffix}`;
}

// ── Detection ──────────────────────────────────────────────────

function findRaiseHandButton() {
  for (const sel of RAISE_HAND_BTN_SELECTORS) {
    const btn = document.querySelector(sel);
    if (btn) return btn;
  }
  return null;
}

function isMyHandRaised() {
  const btn = findRaiseHandButton();
  if (!btn) return false;
  // When raised, the toolbar button label switches to "Lower hand"
  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  return label.includes('lower');
}

// Total raised hands visible to the page (includes self).
// Tries the People button's accessibility label first (works with the
// roster collapsed), then falls back to counting per-participant badges.
function getTotalRaisedHandCount() {
  const buttons = document.querySelectorAll('button[aria-label]');
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label') || '';
    const match = label.match(/(\d+)\s+hands?\s+raised/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) return n;
    }
  }

  const candidates = document.querySelectorAll('[aria-label], [data-tid]');
  let count = 0;
  for (const el of candidates) {
    if (el.id === 'raisehands-button') continue;
    if (el.getAttribute('data-inp') === 'raisehands-button') continue;
    if (el.closest('#raisehands-button, [data-inp="raisehands-button"]')) continue;
    if (el.closest('[role="tooltip"]')) continue;

    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const tid = (el.getAttribute('data-tid') || '').toLowerCase();
    const looksLikeRaise =
      label.includes('hand is raised') ||
      label.includes('raised their hand') ||
      label.includes('has raised') ||
      tid.includes('raised-hand') ||
      tid.includes('raisehand-icon');

    if (looksLikeRaise) count++;
  }
  return count;
}

function getOtherRaisedHandCount() {
  const total = getTotalRaisedHandCount();
  const mine = isMyHandRaised() ? 1 : 0;
  return Math.max(0, total - mine);
}

// ── Action ─────────────────────────────────────────────────────

function clickHandButton() {
  const btn = findRaiseHandButton();
  if (!btn) return false;
  if (btn.disabled) return false;
  if (btn.offsetParent === null) return false;
  btn.click();
  return true;
}

function tick() {
  if (!enabled) return;

  const btn = findRaiseHandButton();
  if (!btn) {
    uiState = 'watching';
    countLabel = '';
    updateBanner();
    return;
  }

  const others = getOtherRaisedHandCount();
  const mineRaised = isMyHandRaised();
  countLabel = `${others} other${others === 1 ? '' : 's'}`;

  const shouldRaise = others >= THRESHOLD;
  const needsAction =
    (shouldRaise && !mineRaised) || (!shouldRaise && mineRaised);

  if (needsAction && Date.now() - lastActionAt > ACTION_COOLDOWN_MS) {
    if (clickHandButton()) {
      lastActionAt = Date.now();
      uiState = 'acting';
      updateBanner();
      console.log(
        `[Teams Blend In] ${shouldRaise ? 'raised' : 'lowered'} hand ` +
        `(others=${others}, threshold=${THRESHOLD})`
      );
      return;
    }
  }

  uiState = needsAction ? 'acting' : 'matched';
  updateBanner();
}

// ── Coordination marker for Teams First In ─────────────────────

function setActiveMarker(active) {
  if (active) {
    document.documentElement.setAttribute(MARKER_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(MARKER_ATTR);
  }
}

// ── Lifecycle ──────────────────────────────────────────────────

function start() {
  injectBanner();
  setActiveMarker(true);
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  uiState = 'watching';
  updateBanner();
  console.log('[Teams Blend In] Started');
}

function stop() {
  setActiveMarker(false);
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  uiState = 'off';
  countLabel = '';
  updateBanner();
  console.log('[Teams Blend In] Stopped');
}

chrome.storage.local.get('enabled', (data) => {
  enabled = data.enabled === true;
  injectBanner();
  if (enabled) start();
  else updateBanner();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    enabled = changes.enabled.newValue;
    if (enabled) start();
    else stop();
  }
});
