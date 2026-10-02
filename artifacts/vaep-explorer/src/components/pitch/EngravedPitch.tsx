import type { Action } from '@workspace/api-client-react';
import { playerAbbr, shirtNumber } from '@/lib/format';
import { PITCH_HEIGHT, PITCH_WIDTH, teamInk } from '@/lib/vaep';
import { cn } from '@/lib/utils';

type Marker = {
  playerId: number;
  name: string;
  team: string;
  x: number;
  y: number;
};

function uniqueMarkers(actions: Action[], selected?: Action): Marker[] {
  const latest = new Map<number, Marker>();
  // In an action frame the pitch is a close-up of the selected action, not a
  // full starting XI. Keep only the actor for that action; the arrow and end
  // point already communicate the ball's destination.
  const scopedActions = selected ? [selected] : actions;
  for (const action of scopedActions) {
    latest.set(action.playerId, {
      playerId: action.playerId,
      name: action.playerName,
      team: action.team,
      x: action.startX,
      y: PITCH_HEIGHT - action.startY,
    });
  }
  return [...latest.values()];
}

function PitchMarkings() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="0.42">
      <rect height="66" width="103" x="1" y="1" />
      <line x1="52.5" x2="52.5" y1="1" y2="67" />
      <circle cx="52.5" cy="34" r="9.15" />
      <circle cx="52.5" cy="34" fill="currentColor" r="0.45" stroke="none" />
      <rect height="40.32" width="16.5" x="1" y="13.84" />
      <rect height="40.32" width="16.5" x="87.5" y="13.84" />
      <rect height="18.32" width="5.5" x="1" y="24.84" />
      <rect height="18.32" width="5.5" x="98.5" y="24.84" />
      <path d="M17.5 24.84 A9.15 9.15 0 0 1 17.5 43.16" />
      <path d="M87.5 24.84 A9.15 9.15 0 0 0 87.5 43.16" />
      <circle cx="11" cy="34" fill="currentColor" r="0.4" stroke="none" />
      <circle cx="94" cy="34" fill="currentColor" r="0.4" stroke="none" />
    </g>
  );
}

export function MiniPitch({ action, className }: { action: Action; className?: string }) {
  const startY = PITCH_HEIGHT - action.startY;
  const endY = PITCH_HEIGHT - action.endY;
  return (
    <svg aria-hidden="true" className={cn('text-primary', className)} viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}>
      <rect fill="hsl(var(--background))" height={PITCH_HEIGHT} width={PITCH_WIDTH} />
      <PitchMarkings />
      <line stroke="currentColor" strokeWidth="1.1" x1={action.startX} x2={action.endX} y1={startY} y2={endY} />
      <circle cx={action.startX} cy={startY} fill="hsl(var(--background))" r="1.6" stroke="currentColor" strokeWidth="0.7" />
      <circle cx={action.endX} cy={endY} fill="currentColor" r="1.3" />
    </svg>
  );
}

export function EngravedPitch({
  actions,
  selected,
  hoveredPlayerId,
  onSelectAction,
  onHoverPlayer,
}: {
  actions: Action[];
  selected?: Action;
  hoveredPlayerId?: number | null;
  onSelectAction?: (actionId: number) => void;
  onHoverPlayer?: (playerId: number | null) => void;
}) {
  const markers = uniqueMarkers(actions, selected);
  const startY = selected ? PITCH_HEIGHT - selected.startY : 0;
  const endY = selected ? PITCH_HEIGHT - selected.endY : 0;
  const dim = hoveredPlayerId != null;

  return (
    <div className="relative overflow-hidden border border-primary/30 bg-[hsl(42_40%_96%)] text-primary">
      <svg
        aria-label={selected ? `Pitch diagram for ${selected.playerName}'s ${selected.actionType}` : 'Engraved tactical pitch'}
        className="h-auto w-full"
        viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}
      >
        <defs>
          <pattern height="3" id="pitch-hatch" patternUnits="userSpaceOnUse" width="3">
            <path d="M0 3 L3 0" stroke="currentColor" strokeWidth="0.18" />
          </pattern>
          <marker id="vaep-arrow" markerHeight="4" markerWidth="4" orient="auto" refX="3.2" refY="2">
            <path d="M0,0 L4,2 L0,4 z" fill="currentColor" />
          </marker>
        </defs>
        <rect fill="hsl(42 42% 95%)" height={PITCH_HEIGHT} width={PITCH_WIDTH} />
        <rect fill="url(#pitch-hatch)" height={PITCH_HEIGHT} opacity="0.18" width={PITCH_WIDTH} />
        <PitchMarkings />
        {selected ? (
          <g>
            <line
              className="draw-path"
              markerEnd="url(#vaep-arrow)"
              pathLength={1}
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="0.9"
              x1={selected.startX}
              x2={selected.endX}
              y1={startY}
              y2={endY}
            />
            <circle cx={selected.startX} cy={startY} fill="hsl(42 42% 95%)" r="1.7" stroke="currentColor" strokeWidth="0.7" />
            <circle cx={selected.endX} cy={endY} fill="currentColor" r="1.4" />
          </g>
        ) : null}
        {markers.map((marker) => {
          const active = selected?.playerId === marker.playerId || hoveredPlayerId === marker.playerId;
          const faded = dim && hoveredPlayerId !== marker.playerId && selected?.playerId !== marker.playerId;
          return (
            <g
              key={marker.playerId}
              className="cursor-pointer"
              onClick={() => {
                const related = [...actions].reverse().find((action) => action.playerId === marker.playerId);
                if (related) onSelectAction?.(related.actionId);
              }}
              onMouseEnter={() => onHoverPlayer?.(marker.playerId)}
              onMouseLeave={() => onHoverPlayer?.(null)}
              opacity={faded ? 0.28 : 1}
            >
              <circle
                cx={marker.x}
                cy={marker.y}
                fill={teamInk(marker.team)}
                r={active ? 3.15 : 2.7}
                stroke="hsl(42 42% 95%)"
                strokeWidth="0.45"
              />
              <text
                fill="hsl(42 40% 94%)"
                fontFamily="Source Sans 3, sans-serif"
                fontSize="2.4"
                fontWeight="600"
                textAnchor="middle"
                x={marker.x}
                y={marker.y + 0.85}
              >
                {shirtNumber(marker.playerId)}
              </text>
              <text
                fill="currentColor"
                fontFamily="Source Sans 3, sans-serif"
                fontSize="2.1"
                letterSpacing="0.08"
                textAnchor="middle"
                x={marker.x}
                y={marker.y + 5.2}
              >
                {playerAbbr(marker.name)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
