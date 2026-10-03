# VAEP Explorer replay animation guide

This is the visual vocabulary for the tactical replay. The rule is that every effect should explain football or value; decorative motion should remain quiet.

## Action symbols

| Visual | Meaning |
| --- | --- |
| Solid player circle | Player involved in the current action |
| Deep cobalt player circle | First team in the match action feed; primary team tone |
| Ivory player circle with sparse lighter-cobalt dashed outline and blue number | Second team in the match action feed; inverted symbol treatment |
| Team key below the pitch | Maps each team name to its player-symbol treatment |
| Ring around a player | Active, hovered, or selected player |
| Expanding receiver ring | The next receiving player is anticipating the ball |
| Dashed blue ink path | Ball trajectory for a pass or other movement |
| Spaced dash pattern | Pass, switch, cross, or through-ball trajectory |
| Fine spaced dot pattern | Carry or dribble movement; dots are intentionally shorter and farther apart |
| Curved ink path | Long pass, switch, cross, or through ball |
| Fine dotted path | Carry, dribble, or player-led movement; no pass is implied |
| Heavy fast path | Shot or clearance |
| Arrowhead | Direction of ball movement |
| Football glyph | Ball in motion along the displayed trajectory |
| `RECEIVER` label | The second player inferred for a two-player action |
| `+0.000 VAEP` callout | A high-value action's contribution to scoring/conceding probability |
| `SHOT` stamp | A shot action that is not recorded as a goal |
| `GOAL` stamp | A goal result; the strongest replay emphasis |

## Motion language

| Animation | Trigger | Purpose |
| --- | --- | --- |
| Path draw-on | Every selected action | Makes the action read as a live tactical sketch |
| Ink fade | Within two seconds of an action beginning | Fully clears the previous trajectory so the pitch stays legible for the next action |
| Ball travel and spin | Every trajectory | A visible football starts at the actor, follows the same curved path as the arrow, rotates in flight, and settles at the destination |
| Ball easing | Every trajectory | Starts decisively after the kick and settles into the receiver |
| Kicking cue | Passes, crosses, shots, and clearances | Brief directional mark shows the passer initiating the action |
| Receiver anticipation | Two-player actions | Signals who is about to receive before arrival |
| Player-position interpolation | Player coordinates change | Keeps player movement continuous rather than teleporting; carries animate the actor to the end point |
| Freeze dwell | Large absolute VAEP, shot, goal, or interruption | Holds the current replay frame longer before advancing |
| Shot treatment | Shot actions | Stronger stroke, glow, and tighter attacking focus |
| Goal treatment | Goal results | Strongest border pulse, goal stamp, and attacking focus |
| Tactical camera focus | Shots and goals only | Gently narrows attention toward the attacking end without interrupting ordinary passes |
| Intensity meter | Current replay action | Communicates the rhythm of the match from quiet possession to danger |

## Action treatment rules

- Short passes use a thin, mostly straight dashed path.
- Long passes and switches use a curved path with a lighter stroke.
- Through balls use a curved path with a restrained glow.
- Crosses and corners use the most visible arc.
- Carries and dribbles use dotted movement ink without a directional arrow.
- Dash segments and dot marks use deliberately different lengths and gaps so the two movement languages remain legible at a glance.
- Arrowheads are rendered at 60% opacity, a 40% fade, while the underlying trajectory keeps its own ink fade.
- The football position is calculated from the same Bézier start point, control point, and end point used to draw the arrow, so its launch point, curve, and destination cannot diverge from the arrow's.
- The football is rendered after player markers in the SVG paint order, so it remains visually on top of the pitch symbols throughout the action.
- The pitch SVG remounts for each action, clearing any browser-retained SVG animation state; only the current action's players, trajectory, and football may remain visible.
- Shots use a heavier, faster-looking stroke and a tighter focus.
- Clearances use a strong but muted long trajectory.
- Goals add the `GOAL` stamp and the strongest emphasis.
- Negative or low-value actions remain quiet; value should guide emphasis, not replace the match narrative.
- Goals, shots, fouls, restarts, and offside events receive a short dwell so the match reads as chapters rather than a continuous jump-cut.
- Team identity is deliberately encoded with tone, outline, and symbol inversion rather than unrelated colors: deep cobalt with ivory lettering for the first team; ivory fill with lighter-cobalt dashed outline and blue lettering for the second.
- Camera focus interpolates over 420ms and only engages for shots and goals; normal attacking passes remain full-pitch.

## Accessibility and interaction

- `prefers-reduced-motion` disables replay animation while preserving the visual symbols.
- Hovering a player opens the compact player dossier.
- Clicking a player pins the dossier until clicked again.
- The pitch only shows players involved in the current action, plus the inferred receiving player for two-player actions.
- All meaningful controls retain text labels or ARIA labels; animation is never the only source of meaning.

## Implementation map

- Pitch rendering and trajectory semantics: `artifacts/vaep-explorer/src/components/pitch/EngravedPitch.tsx`
- Replay controls and match-intensity calculation: `artifacts/vaep-explorer/src/pages/replay.tsx`
- Motion, ink, focus, and intensity styles: `artifacts/vaep-explorer/src/index.css`

Update this file whenever a new replay symbol, action treatment, or motion cue is introduced.
