# Japanese Handwriting Pad Prototype Handoff

## Current Goal

Build a GitHub Pages friendly handwriting pad prototype for hiragana and kanji recognition. The UI is still compact, but now includes:

- handwriting canvas
- recognized text display box
- undo button
- clear button

The user prefers generated deliverables to be provided as ZIP files, not as individual file links.

## Current Files

- `index.html`
- `styles.css`
- `stroke-counts.js`
- `app.js`
- `README.md`
- `THIRD_PARTY_NOTICES.md`

## Recognition Architecture

The app tries browser-native Handwriting Recognition API first. If unavailable, it falls back to Google Input Tools handwriting request format.

Recognition is still near-immediate, but candidates pass local guards before display:

- standard stroke count from `stroke-counts.js`
- supplemental stroke count table in `app.js`
- physical stroke count
- virtual stroke count estimated from connected strokes and turning angles
- component-specific completion checks
- candidate stability tracking
- low-information input filtering
- Japanese-only candidate filtering

## Latest Changes In This Package

1. Candidate stability tracking was added.
   - Complex candidates are not displayed on the first recognition result.
   - A high-risk candidate must appear again with the same ink signature before display.
   - If the user starts the next stroke before confirmation, the pending candidate is discarded.
   - This is intended to suppress premature recognition of complex characters during writing.

2. `鱸` received a supplemental stroke count.
   - The bundled upstream stroke-count data did not include `鱸`.
   - `app.js` now treats `鱸` as 27 strokes.
   - This should reject the reported 17th- and 21st-stroke premature `鱸` results.

3. Blackboard-style UI was applied.
   - Dark green background and panels.
   - Chalk-like light ink.
   - Larger 12px drawing line.
   - Japanese UI font stack centered on `BIZ UDPGothic`, `Yu Gothic UI`, and `Meiryo`.

4. Undo was added.
   - `戻る` button removes the latest stroke.
   - Keyboard `Z` also removes the latest stroke.
   - After undo, the canvas is redrawn and recognition runs again if enough ink remains.

5. Touch-panel friction was reduced.
   - Canvas uses `touch-action: none`.
   - Page and canvas suppress selection and callouts.
   - Canvas blocks double-click, context menu, select, drag, and touch defaults.
   - Viewport is locked to reduce double-tap zoom in app-like use.

## Component Guard Inventory

Implemented high-risk guards:

| Component | Reason | Current guard |
| --- | --- | --- |
| `辶` / shinnyou | Whole characters such as `近`, `辺`, `遠` can be proposed before the final sweep is complete. | Requires a low, rightward sweep across the lower area. Connected second and third strokes remain accepted when this sweep exists. |
| `氵` / sanzui | Characters such as `漢`, `池`, `海` can be proposed while the water radical is still only one or two marks. | Requires top, middle, and lower-left marks before displaying sanzui candidates. |
| `艹` / kusakanmuri | Characters such as `漢`, `范`, `草`, `花` can be proposed before the top radical is structurally complete. | Requires a top horizontal mark and two top vertical-ish marks before displaying grass-radical candidates. |

Watchlist for future evidence-based guards:

| Component | Possible risk | Suggested caution |
| --- | --- | --- |
| `忄`, `扌`, `犭` | Left-side radicals may look like unrelated kana or fragments early. | Avoid adding a strict guard until false positives are observed, because personal stroke order varies. |
| `糸` / thread | Connected writing can merge several short strokes. | Prefer stroke-count and virtual-stroke tuning before component geometry. |
| `魚` / fish | Complex left radical may cause early recognition in characters such as `鱸`. | Current package uses stroke count and stability first. Add geometry only if repeated false positives remain. |
| `虍`, `田`, `皿` | Complex right/bottom structures in `盧`-like parts may stabilize visually before completion. | Use observed failures to tune supplemental counts and stability before strict geometry. |
| `言`, `門`, box-like parts | Incomplete enclosures can resemble simpler completed characters. | Add guards only for specific repeated false positives. |

## Candidate Stability Details

The stability layer currently applies when any of the following is true:

- candidate includes `辶`, `氵`, or `艹`
- candidate includes a kanji whose stroke count is unknown
- candidate's known total stroke count is 12 or more
- current raw input stroke count is 12 or more

For these candidates, the display is delayed until:

- the candidate text is the same
- the ink signature is the same
- the candidate has appeared at least twice
- no pointer stroke is currently active

This should keep simple kana and low-stroke characters responsive while making complex kanji less eager.

## User Feedback Incorporated

- Do not force a single-kanji mode. Multi-character output may be valid if it visually matches.
- Early recognition of a component alone is acceptable.
- The problem is recognizing a whole character or string before required strokes or required components are complete.
- Connected writing should remain accepted when it plausibly represents multiple strokes.
- Complex characters such as `鬱` and `鱸` need stronger early-recognition suppression.
- UI should reduce visual strain and remain legible.
- Touch input should not cause double-tap zoom or long-press selection.

## Known Design Tension

The stricter component guards and stability checks reduce premature false positives but can create delayed display or false negatives for unusual personal handwriting styles.

The most sensitive current rules are:

- `hasCompletedShinnyouSweep()`
- `hasCompletedSanzui()`
- `hasCompletedKusakanmuriTop()`
- `estimateSegmentsInStroke()`
- `requiresCandidateStability()`
- `getStableCandidateDecision()`

If valid completed characters feel too slow, tune `STABILITY_CONFIRM_DELAY_MS` first. If valid completed complex characters are rejected, check missing stroke counts before changing geometry guards.

## Suggested Next Checks

1. Retest simple phrases: `石上にも三年`, `大和尊`.
2. Retest `鬱` around the last 2-3 strokes.
3. Retest `鱸` at 17, 21, and completion.
4. Test `遠`, `近`, `辺`, `道`, `週`, `進`.
5. Test `漢`, `范`, `草`, `花`, `薄`.
6. Test sanzui characters such as `池`, `法`, `海`, `漢`.
7. Test undo by button and `Z`.
8. Test quick touch writing to confirm double-tap zoom no longer occurs.
9. Test long strokes on touch screens to confirm text selection no longer appears.

## Verified In This Handoff

- `app.js` passes `node --check`.
- The package includes updated HTML, CSS, README, and handoff notes.
- Manual browser recognition behavior still requires device testing because the recognition engines are browser/network dependent.

## Third-Party Data

`stroke-counts.js` was generated from `@k1low/hanzi-writer-data-jp` 0.8.0. See `THIRD_PARTY_NOTICES.md`.
