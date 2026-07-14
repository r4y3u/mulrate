# MulRate v1.0.0 beta.16 Design Notes

## UI

- Main display uses a low-glare green board surface with white text.
- On small screens, the game screen prioritizes showing the formula and answer field without scrolling.
- The input zone keeps keypad hints to one compact line to preserve button height.
- When the handwriting pad is open, the external memo toggle is hidden because the pad already has its own close button.

## Feedback

- Correct answers use a calm green bloom and answer-field emphasis. The check mark was removed to preserve formula visibility.
- Wrong answers use a restrained answer-field and formula nudge. The goal is to notify without making errors attractive.

## Handwriting pad

- The pad preloads a vertical multiplication setup showing only the multiplicand and multiplier.
- Clearing the pad removes user strokes and redraws the original setup.
