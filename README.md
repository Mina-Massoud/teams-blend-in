# Teams Blend In

Chrome extension that watches a Microsoft Teams meeting and keeps your raise-hand state in sync with the room.

- **10 or more *other* people** have hands raised → your hand goes up.
- **Fewer than 10** → your hand goes down.

You don't count toward the threshold.

## Install

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and pick the `teams-blend-in` folder.
5. Click the toolbar icon and flip **Match the room** on.

A small floating banner appears in the bottom-right of the Teams tab showing the current state and how many others have raised hands.

## How it works

A content script runs on `https://teams.microsoft.com/*` and ticks every 1.5 s:

1. Reads the People button's `aria-label` to get the total raised-hand count (works with the roster collapsed). Falls back to counting per-participant badges in the open roster.
2. Subtracts 1 if your own hand is currently raised, to get the "others" count.
3. Compares against the threshold (`THRESHOLD = 10` in `content.js`) and clicks the raise/lower button if the state needs to change.
4. Honours a 3-second cooldown between actions so it never thrashes.

## Tuning

Edit constants at the top of `content.js`:

| Constant | Default | Purpose |
| --- | --- | --- |
| `THRESHOLD` | `10` | Number of *other* raised hands required to raise yours |
| `TICK_INTERVAL_MS` | `1500` | How often to re-check the room |
| `ACTION_COOLDOWN_MS` | `3000` | Minimum time between two raise/lower clicks |

## Selectors may drift

Teams' DOM changes from time to time. The detection layer uses defensive selectors and multiple fallback strategies, but if the count stops updating in a future Teams build:

1. Open DevTools on a Teams meeting where someone has a hand up.
2. Search the DOM for `raised`, `hands raised`, `raisehand`, or `raised-hand`.
3. Update the matchers in `getTotalRaisedHandCount()` inside `content.js`.

The status banner shows the current observed count, so you can tell at a glance whether detection is working.

## Optional: coordinate with another auto-join extension

While enabled, this extension sets `data-tbi-active="true"` on the page's `<html>` element. If you also run an extension that auto-joins meetings *and* raises your hand on join, you can have it skip the raise step by checking that attribute, e.g.:

```js
if (document.documentElement.getAttribute('data-tbi-active') === 'true') {
  // Blend In is active — let it own hand state, just finish joining.
  return;
}
```

That hands all raise/lower decisions to Blend In once you're in the meeting.

## License

MIT. See [LICENSE](LICENSE).
