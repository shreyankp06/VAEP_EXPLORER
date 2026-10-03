import { useEffect, useState } from 'react';
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

function trajectoryFor(action: Action) {
  const startX = action.startX;
  const startY = PITCH_HEIGHT - action.startY;
  const endX = action.endX;
  const endY = PITCH_HEIGHT - action.endY;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  const isCross = type.includes('cross') || type.includes('corner');
  const isThroughBall = type.includes('through ball');
  const isCarry = type.includes('dribble') || type.includes('carry') || type.includes('run');
  const isShot = type.includes('shot');
  const isClearance = type.includes('clearance');
  const isGoal = action.result.toLowerCase() === 'goal';
  const isInterruption = ['foul', 'throw in', 'corner', 'free kick', 'goal kick', 'offside'].some((name) => type.includes(name));
  const isLong = distance > 25 || isCross;
  const bend = isCross ? 0.24 : isThroughBall ? 0.15 : isLong ? 0.1 : 0.035;
  const normalX = -dy / (distance || 1);
  const normalY = dx / (distance || 1);
  const controlX = (startX + endX) / 2 + normalX * distance * bend;
  const controlY = (startY + endY) / 2 + normalY * distance * bend;
  const d = `M ${startX.toFixed(2)} ${startY.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  return { d, startX, startY, endX, endY, controlX, controlY, isLong, isThroughBall, isCross, isCarry, isShot, isClearance, isGoal, isInterruption };
}

function cameraBox(action?: Action, trajectory?: ReturnType<typeof trajectoryFor>) {
  if (!action || !trajectory || (!trajectory.isShot && !trajectory.isGoal)) return `0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`;
  const width = 82;
  const height = 56;
  const x = Math.min(Math.max(action.endX - width * 0.58, 0), PITCH_WIDTH - width);
  const y = Math.min(Math.max(PITCH_HEIGHT - action.endY - height * 0.5, 0), PITCH_HEIGHT - height);
  return `${x.toFixed(2)} ${y.toFixed(2)} ${width} ${height}`;
}

function teamTone(team: string, actions: Action[]) {
  const teams = [...new Set(actions.map((action) => action.team))];
  return teams.indexOf(team) === 1 ? 'away' : 'home';
}

function parseViewBox(viewBox: string) {
  return viewBox.split(' ').map(Number);
}

function formatViewBox(values: number[]) {
  return values.map((value) => value.toFixed(2)).join(' ');
}

function AnimatedFootball({ actionId, trajectory }: { actionId: number; trajectory: ReturnType<typeof trajectoryFor> }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const duration = 950;
    const animate = (now: number) => {
      const elapsed = Math.min((now - started) / duration, 1);
      setProgress(1 - Math.pow(1 - elapsed, 2.2));
      if (elapsed < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [actionId]);

  const inverse = 1 - progress;
  const x = inverse * inverse * trajectory.startX + 2 * inverse * progress * trajectory.controlX + progress * progress * trajectory.endX;
  const y = inverse * inverse * trajectory.startY + 2 * inverse * progress * trajectory.controlY + progress * progress * trajectory.endY;
  const tangentX = 2 * inverse * (trajectory.controlX - trajectory.startX) + 2 * progress * (trajectory.endX - trajectory.controlX);
  const tangentY = 2 * inverse * (trajectory.controlY - trajectory.startY) + 2 * progress * (trajectory.endY - trajectory.controlY);
  const angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI) + progress * 360;

  return (
    <g className="pitch-ball" pointerEvents="none" transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)})`}>
      <circle cx="0" cy="0" fill="hsl(var(--background))" r="2.15" stroke="currentColor" strokeWidth="0.58" />
      <path d="M-0.62 -0.82 L0.44 -0.58 L0.76 0.32 L0 0.94 L-0.82 0.38 L-0.62 -0.82Z" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
      <path d="M-0.62 -0.82 L-1.48 -0.36 M0.44 -0.58 L1.4 -0.9 M0.76 0.32 L1.48 0.82 M0 0.94 L-0.28 1.7 M-0.82 0.38 L-1.5 0.92" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="0.22" />
    </g>
  );
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
  const [freezeFrame, setFreezeFrame] = useState(false);
  const markers = uniqueMarkers(actions, selected);
  const teams = [...new Set(actions.map((action) => action.team))].slice(0, 2);
  const startY = selected ? PITCH_HEIGHT - selected.startY : 0;
  const endY = selected ? PITCH_HEIGHT - selected.endY : 0;
  const dim = hoveredPlayerId != null;
  const activePlayerId = pinnedPlayerId ?? hoveredPlayerId;
  const activeMarker = markers.find((marker) => marker.playerId === activePlayerId);
  const activeDetail = activeMarker ? playerDetails?.[activeMarker.playerId] : undefined;
  const trajectory = selected ? trajectoryFor(selected) : undefined;
  const isHighValue = Boolean(selected && (Math.abs(selected.vaepValue) >= 0.08 || trajectory?.isShot || trajectory?.isGoal));
  const targetViewBox = cameraBox(selected, trajectory);
  const [activeViewBox, setActiveViewBox] = useState(targetViewBox);

  useEffect(() => {
    const from = parseViewBox(activeViewBox);
    const to = parseViewBox(targetViewBox);
    const started = performance.now();
    const duration = 420;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setActiveViewBox(formatViewBox(from.map((value, index) => value + (to[index] - value) * eased)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetViewBox]);

  useEffect(() => {
    if (!isHighValue) {
      setFreezeFrame(false);
      return;
    }
    setFreezeFrame(true);
    const timeout = window.setTimeout(() => setFreezeFrame(false), trajectory?.isGoal ? 720 : 480);
    return () => window.clearTimeout(timeout);
  }, [selected?.actionId, isHighValue, trajectory?.isGoal]);

  return (
    <div className={cn('relative overflow-visible border border-primary/30 bg-background text-primary', isHighValue && 'pitch-high-value', trajectory?.isShot && 'pitch-shot-frame', trajectory?.isGoal && 'pitch-goal-frame', freezeFrame && 'pitch-freeze-frame')}>
      <svg
        aria-label={selected ? `Pitch diagram for ${selected.playerName}'s ${selected.actionType}` : 'Engraved tactical pitch'}
        className="h-auto w-full"
        viewBox={activeViewBox}
      >
        <defs>
          <pattern height="3" id="pitch-hatch" patternUnits="userSpaceOnUse" width="3">
            <path d="M0 3 L3 0" stroke="currentColor" strokeWidth="0.18" />
          </pattern>
          <marker id="vaep-arrow" markerHeight="4" markerWidth="4" orient="auto" refX="3.2" refY="2">
            <path d="M0,0 L4,2 L0,4 z" fill="currentColor" opacity="0.6" />
          </marker>
        </defs>
        <rect fill="hsl(var(--background))" height={PITCH_HEIGHT} width={PITCH_WIDTH} />
        <rect fill="url(#pitch-hatch)" height={PITCH_HEIGHT} opacity="0.18" width={PITCH_WIDTH} />
        <PitchMarkings />
        {selected ? (
          <g key={selected.actionId} className="pitch-action-frame">
            <path
              className={cn(
                'draw-path',
                `action-${selected.actionType}`,
                trajectory?.isLong && 'trajectory-long',
                trajectory?.isThroughBall && 'trajectory-through-ball',
                trajectory?.isCross && 'trajectory-cross',
                trajectory?.isCarry && 'trajectory-carry',
                trajectory?.isShot && 'trajectory-shot',
                trajectory?.isClearance && 'trajectory-clearance',
              )}
              markerEnd="url(#vaep-arrow)"
              pathLength={1}
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="0.9"
              d={trajectory?.d}
              fill="none"
            />
            <circle className="pitch-pulse" cx={selected.startX} cy={startY} fill="none" r="3.2" stroke="currentColor" strokeWidth="0.35" />
            <circle cx={selected.startX} cy={startY} fill="hsl(var(--background))" r="1.7" stroke="currentColor" strokeWidth="0.7" />
            {!trajectory?.isCarry && !trajectory?.isInterruption ? (
              <line
                className="pitch-kick-cue"
                x1={selected.startX}
                x2={selected.startX + ((selected.endX - selected.startX) / (Math.hypot(selected.endX - selected.startX, selected.endY - selected.startY) || 1)) * 3.1}
                y1={startY}
                y2={startY + ((endY - startY) / (Math.hypot(selected.endX - selected.startX, endY - startY) || 1)) * 3.1}
              />
            ) : null}
            {isHighValue ? (
              <g className="pitch-vaep-callout" transform={`translate(${Math.min(selected.startX + 4, PITCH_WIDTH - 18)} ${Math.max(startY - 5, 5)})`}>
                <rect height="4.2" rx="0.5" width="17" x="-1" y="-3.3" />
                <text fill="hsl(var(--primary-foreground))" fontFamily="Geist, system-ui, sans-serif" fontSize="2.15" fontWeight="600" textAnchor="middle" x="7.5" y="-0.35">
                  {selected.vaepValue >= 0 ? '+' : ''}{selected.vaepValue.toFixed(3)} VAEP
                </text>
              </g>
            ) : null}
            {trajectory?.isGoal ? <text className="pitch-event-stamp" x={selected.endX} y={Math.max(endY - 5, 5)}>GOAL</text> : null}
            {trajectory?.isShot && !trajectory.isGoal ? <text className="pitch-event-stamp" x={selected.endX} y={Math.max(endY - 5, 5)}>SHOT</text> : null}
            {trajectory?.isInterruption ? <text className="pitch-event-stamp pitch-interruption-stamp" x={selected.endX} y={Math.max(endY - 5, 5)}>RESET</text> : null}
          </g>
        ) : null}
        {markers.map((marker) => {
          const tone = teamTone(marker.team, actions);
          const active = selected?.playerId === marker.playerId || hoveredPlayerId === marker.playerId;
          const faded = dim && hoveredPlayerId !== marker.playerId && selected?.playerId !== marker.playerId;
          return (
            <g
              key={marker.playerId}
              aria-label={`${marker.name}${marker.isPartner ? ', receiving player' : ''}`}
              className={cn('pitch-player cursor-pointer', `pitch-team-${teamTone(marker.team, actions)}`, marker.isPartner && 'pitch-player-partner pitch-player-anticipating', selected?.playerId === marker.playerId && 'pitch-player-actor')}
              onClick={() => {
                setPinnedPlayerId((current) => current === marker.playerId ? null : marker.playerId);
                const related = [...actions].reverse().find((action) => action.playerId === marker.playerId);
                if (related) onSelectAction?.(related.actionId);
              }}
              onMouseEnter={() => onHoverPlayer?.(marker.playerId)}
              onMouseLeave={() => onHoverPlayer?.(null)}
              opacity={faded ? 0.28 : 1}
            >
              {active || marker.isPartner ? <circle className={cn('pitch-marker-halo', marker.isPartner && 'pitch-receiver-ring')} cx={marker.x} cy={marker.y} fill="none" r="4.2" stroke="currentColor" strokeWidth="0.35" /> : null}
              <circle
                cx={marker.x}
                cy={marker.y}
                fill={tone === 'away' ? 'hsl(var(--background))' : teamInk(marker.team)}
                r={active ? 3.15 : 2.7}
                stroke={tone === 'away' ? '#6374d8' : 'hsl(var(--background))'}
                strokeWidth={tone === 'away' ? '0.65' : '0.45'}
                strokeDasharray={tone === 'away' ? '1.8 1.4' : undefined}
              />
              <text
                fill={tone === 'away' ? '#6374d8' : 'hsl(var(--primary-foreground))'}
                fontFamily="Geist, system-ui, sans-serif"
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
                fontFamily="Geist, system-ui, sans-serif"
                fontSize="2.1"
                letterSpacing="0.08"
                textAnchor="middle"
                x={marker.x}
                y={marker.y + 5.2}
              >
                {playerAbbr(marker.name)}
              </text>
              {marker.isPartner ? (
                <text className="pitch-next-label" fill="currentColor" fontFamily="Geist, system-ui, sans-serif" fontSize="1.7" letterSpacing="0.12" textAnchor="middle" x={marker.x} y={marker.y - 4.8}>
                  RECEIVER
                </text>
              ) : null}
              {selected && trajectory?.isCarry && selected.playerId === marker.playerId ? (
                <animateTransform
                  attributeName="transform"
                  dur="950ms"
                  fill="freeze"
                  from="translate(0 0)"
                  to={`translate(${(selected.endX - marker.x).toFixed(2)} ${(PITCH_HEIGHT - selected.endY - marker.y).toFixed(2)})`}
                  type="translate"
                />
              ) : null}
            </g>
          );
        })}
        {selected && trajectory ? <AnimatedFootball actionId={selected.actionId} key={selected.actionId} trajectory={trajectory} /> : null}
      </svg>
      {teams.length === 2 ? (
        <div aria-label="Team key" className="pitch-team-key">
          {teams.map((team, index) => (
            <span className="pitch-team-key-item" key={team}>
              <span className={cn('pitch-team-swatch', index === 1 && 'pitch-team-swatch-away')} />
              {team}
            </span>
          ))}
        </div>
      ) : null}
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
