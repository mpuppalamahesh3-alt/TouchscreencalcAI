# Reliable multimodal solving and scroll-safe drawing

## What will change

- Make uploaded photos the source of truth in Camera mode, clear stale input/results when a new photo is selected, and show a clear error if the image cannot be read.
- Route advanced typed and voice questions to the online solver when local calculation cannot confidently answer them; keep simple arithmetic instant and offline.
- Make voice recognition update the visible question live, stop cleanly, and wait for the user to press Solve instead of auto-solving.
- Turn the active Solve button into a red Cancel button. Cancel immediately stops the loading/result update and restores the normal Solve button.
- Replace the current manual Draw/Scroll compromise with scroll-safe touch intent:
  - Apple Pencil/stylus and mouse draw immediately.
  - A finger only begins ink after a short deliberate-writing gesture is detected.
  - Predominantly vertical movement scrolls the page and never creates marks.
  - Drawing remains limited to the active Solve/Draw canvas.
- Preserve smooth coalesced strokes, Undo, Clear, maximize/minimize, and the black/blue pen choices.

## Validation

- Upload a photographed complex equation and confirm a parsed solution appears.
- Speak a question, confirm it fills the input, then press Solve and verify the answer.
- Start a solve, press Cancel, and confirm loading and late answers stop.
- Test finger scrolling, finger writing, stylus/mouse writing, tab switching, Clear, and fullscreen on mobile and desktop sizes.

## Technical details

- Harden request/result guards so canceled or superseded requests cannot update answers or notes.
- Improve edge-function image prompts and response validation while keeping requests free of artificial timeouts.
- Use local-solver confidence/fallback detection to decide when cloud reasoning is required.
- Implement pointer-intent thresholds without a side scrollbar or persistent scroll-only control.
