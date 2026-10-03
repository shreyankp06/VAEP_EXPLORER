import { useState } from 'react';
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
  isPartner: boolean;
};

export type PlayerPitchDetail = {
  actions: number;
  totalVaep: number;
  vaepPer90: number;
};

function uniqueMarkers(actions: Action[], selected?: Action): Marker[] {
  const latest = new Map<number, Marker>();
  // Only actions that can involve a second player get a partner marker. The
  // best receiver candidate is the same-team action nearest to the pass end
  // point shortly afterwards—not simply the next event in the feed.
  const partnerAction = selected && isTwoPlayerAction(selected)
    ? actions
      .filter((action) => {
        const isAfter = action.timeSeconds > selected.timeSeconds || (action.timeSeconds === selected.timeSeconds && action.id > selected.id);
        return isAfter && action.team === selected.team && action.timeSeconds - selected.timeSeconds <= 8;
      })
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.startX - selected.endX, left.startY - selected.endY);
        const rightDistance = Math.hypot(right.startX - selected.endX, right.startY - selected.endY);
        return leftDistance - rightDistance || left.timeSeconds - right.timeSeconds;
      })[0]
    : undefined;
  // Put the next action first so the selected actor remains anchored to the
  // current frame when both actions belong to the same player.
  const scopedActions = selected
    ? [...(partnerAction ? [partnerAction] : []), selected]
    : actions;
  for (const action of scopedActions) {
    latest.set(action.playerId, {
      playerId: action.playerId,
      name: action.playerName,
      team: action.team,
      x: action.startX,
      y: PITCH_HEIGHT - action.startY,
      isPartner: selected ? action.actionId !== selected.actionId : false,
    });
  }
  return [...latest.values()];
}

function isTwoPlayerAction(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  return ['pass', 'through ball', 'cross', 'assist', 'corner', 'free kick', 'throw in'].some((name) => type.includes(name));
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
  playerDetails,
}: {
  actions: Action[];
  selected?: Action;
  hoveredPlayerId?: number | null;
  onSelectAction?: (actionId: number) => void;
  onHoverPlayer?: (playerId: number | null) => void;
  playerDetails?: Record<number, PlayerPitchDetail>;
}) {
  const [pinnedPlayerId, setPinnedPlayerId] = useState<number | null>(null);
  const markers = uniqueMarkers(actions, selected);
  const startY = selected ? PITCH_HEIGHT - selected.startY : 0;
  const endY = selected ? PITCH_HEIGHT - selected.endY : 0;
  const dim = hoveredPlayerId != null;
  const activePlayerId = pinnedPlayerId ?? hoveredPlayerId;
  const activeMarker = markers.find((marker) => marker.playerId === activePlayerId);
  const activeDetail = activeMarker ? playerDetails?.[activeMarker.playerId] : undefined;

  return (
    <div className="relative overflow-visible border border-primary/30 bg-background text-primary">
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
        <rect fill="hsl(var(--background))" height={PITCH_HEIGHT} width={PITCH_WIDTH} />
        <rect fill="url(#pitch-hatch)" height={PITCH_HEIGHT} opacity="0.18" width={PITCH_WIDTH} />
        <PitchMarkings />
        {selected ? (
          <g key={selected.actionId} className="pitch-action-frame">
            <line
              className={cn('draw-path', `action-${selected.actionType}`)}
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
            <circle className="pitch-pulse" cx={selected.startX} cy={startY} fill="none" r="3.2" stroke="currentColor" strokeWidth="0.35" />
            <circle cx={selected.startX} cy={startY} fill="hsl(var(--background))" r="1.7" stroke="currentColor" strokeWidth="0.7" />
            <g className="pitch-ball">
              <circle cx="0" cy="0" fill="hsl(var(--background))" r="1.45" stroke="currentColor" strokeWidth="0.35" />
              <path d="M-0.5 -0.65 L0.35 -0.45 L0.62 0.25 L0 0.72 L-0.65 0.3 L-0.5 -0.65Z" fill="none" stroke="currentColor" strokeWidth="0.18" />
              <path d="M-0.5 -0.65 L-1.05 -0.25 M0.35 -0.45 L0.95 -0.72 M0.62 0.25 L1.05 0.58 M0 0.72 L-0.2 1.2 M-0.65 0.3 L-1.12 0.65" fill="none" stroke="currentColor" strokeWidth="0.16" />
              <animateTransform attributeName="transform" dur="850ms" fill="freeze" from={`translate(${selected.startX} ${startY})`} to={`translate(${selected.endX} ${endY})`} type="translate" />
            </g>
            <circle cx={selected.endX} cy={endY} fill="currentColor" r="1.4" />
          </g>
        ) : null}
        {markers.map((marker) => {
          const active = selected?.playerId === marker.playerId || hoveredPlayerId === marker.playerId;
          const faded = dim && hoveredPlayerId !== marker.playerId && selected?.playerId !== marker.playerId;
          return (
            <g
              key={marker.playerId}
              aria-label={`${marker.name}${marker.isPartner ? ', receiving player' : ''}`}
              className={cn('pitch-player cursor-pointer', marker.isPartner && 'pitch-player-partner')}
              onClick={() => {
                setPinnedPlayerId((current) => current === marker.playerId ? null : marker.playerId);
                const related = [...actions].reverse().find((action) => action.playerId === marker.playerId);
                if (related) onSelectAction?.(related.actionId);
              }}
              onMouseEnter={() => onHoverPlayer?.(marker.playerId)}
              onMouseLeave={() => onHoverPlayer?.(null)}
              opacity={faded ? 0.28 : 1}
            >
              {active ? <circle className="pitch-marker-halo" cx={marker.x} cy={marker.y} fill="none" r="4.2" stroke="currentColor" strokeWidth="0.35" /> : null}
              <circle
                cx={marker.x}
                cy={marker.y}
                fill={teamInk(marker.team)}
                r={active ? 3.15 : 2.7}
                stroke="hsl(var(--background))"
                strokeWidth="0.45"
              />
              <text
                fill="hsl(var(--primary-foreground))"
                fontFamily="system-ui, sans-serif"
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
                fontFamily="system-ui, sans-serif"
                fontSize="2.1"
                letterSpacing="0.08"
                textAnchor="middle"
                x={marker.x}
                y={marker.y + 5.2}
              >
                {playerAbbr(marker.name)}
              </text>
              {marker.isPartner ? (
                <text className="pitch-next-label" fill="currentColor" fontFamily="system-ui, sans-serif" fontSize="1.7" letterSpacing="0.12" textAnchor="middle" x={marker.x} y={marker.y - 4.8}>
                  RECEIVER
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {activeMarker ? (
        <div
          className={cn('pitch-dossier', activeMarker.x >= PITCH_WIDTH * 0.62 ? 'pitch-dossier-left' : 'pitch-dossier-right', pinnedPlayerId === activeMarker.playerId && 'pitch-dossier-pinned')}
          style={{ left: `${(activeMarker.x / PITCH_WIDTH) * 100}%`, top: `${(activeMarker.y / PITCH_HEIGHT) * 100}%` }}
        >
          <div className="pitch-dossier-card">
            <div className="pitch-dossier-head">
              <div>
                <p className="pitch-dossier-kicker">Player dossier</p>
                <p className="pitch-dossier-name">{activeMarker.name}</p>
              </div>
              <span className="pitch-dossier-number">{shirtNumber(activeMarker.playerId)}</span>
            </div>
            <p className="pitch-dossier-copy">{activeMarker.isPartner ? 'Receiving player' : 'On-ball actor'} · {activeMarker.team}</p>
            {activeDetail ? (
              <div className="pitch-dossier-stats">
                <span>{activeDetail.actions} actions</span>
                <span>{activeDetail.totalVaep >= 0 ? '+' : ''}{activeDetail.totalVaep.toFixed(3)} VAEP</span>
                <span>{activeDetail.vaepPer90 >= 0 ? '+' : ''}{activeDetail.vaepPer90.toFixed(3)} / 90</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
