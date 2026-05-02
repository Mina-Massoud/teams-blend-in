const toggle = document.getElementById('enabled');
const statusEl = document.getElementById('status');

const ON_TEXT = 'Raises your hand when 10+ others have theirs up. Lowers when fewer.';
const OFF_TEXT = 'Disabled — your hand state will not be touched.';

chrome.storage.local.get('enabled', (data) => {
  // Default true on first install
  toggle.checked = data.enabled !== false;
  updateStatus(toggle.checked);
});

toggle.addEventListener('change', () => {
  const val = toggle.checked;
  chrome.storage.local.set({ enabled: val });
  updateStatus(val);
});

function updateStatus(on) {
  statusEl.textContent = on ? ON_TEXT : OFF_TEXT;
}
