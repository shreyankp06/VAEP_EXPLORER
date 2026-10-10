import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import type { Action, Match } from '@workspace/api-client-react';

import { CatalogSelect, CardGlyph, EngravedFootball, GoalGlyph, PaperPanel, SectionHeading, ShotGlyph, SubGlyph, VaepGlyph } from '@/components/archive/Ornaments';
import { EngravedPitch, MiniPitch, type PlayerPitchDetail } from '@/components/pitch/EngravedPitch';
import { KeyMoments, OnBallActivity, PlayerComparison } from '@/components/pitch/MatchInsights';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetMatchActions, useListMatches } from '@/hooks/api/useMatches';
import { formatActionTime, formatSignedVaep, titleCase } from '@/lib/format';
import { matchCompetition, matchSeason } from '@/lib/matchMeta';
import { cn } from '@/lib/utils';
import { aggregatePlayers, buildSequences, pitchZone } from '@/lib/vaep';

const SECTIONS = ['Overview', 'Timeline', 'Moments', 'Activity', 'Actions', 'Players', 'Compare', 'Sequences', 'VAEP'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABELS: Record<Section, string> = {
  Overview: 'Match report',
  Timeline: 'Match story',
  Moments: 'Key moments',
  Activity: 'Team activity',
  Actions: 'All actions',
  Players: 'Players',
  Compare: 'Compare players',
  Sequences: 'Play sequences',
  VAEP: 'Model details',
};

function TimelineGlyph({ type, result, isGoal }: { type: string; result: string; isGoal?: boolean }) {
  if (isGoal || result === 'goal') return <GoalGlyph className="h-4 w-4" />;
  if (type.includes('shot')) return <ShotGlyph className="h-4 w-4" />;
  if (type.includes('card')) return <CardGlyph className="h-4 w-4" />;
  if (type.includes('sub')) return <SubGlyph className="h-4 w-4" />;
  return <VaepGlyph className="h-4 w-4" />;
}

function isTimelineEvent(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  return action.periodId !== 5 && (
    type.includes('shot')
    || type.includes('card')
    || type.includes('sub')
    || action.isGoal
    || action.result.toLowerCase() === 'goal'
    || Math.abs(action.vaepValue) >= 0.15
  );
}

function actionIntensity(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  const attackingProgress = Math.max(0, Math.min(1, action.endX / 105));
  const value = Math.min(1, 0.18 + Math.abs(action.vaepValue) * 2.4 + attackingProgress * 0.18
    + (type.includes('shot') ? 0.28 : 0)
    + (action.isGoal || action.result.toLowerCase() === 'goal' ? 0.42 : 0));
  return Math.round(value * 12);
}

function replayPauseFor(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  const result = action.result.toLowerCase();
  if (action.isGoal || result === 'goal') return 1100;
  if (type.includes('shot')) return 650;
  if (['foul', 'throw in', 'corner', 'free kick', 'goal kick', 'offside'].some((name) => type.includes(name))) return 800;
  if (Math.abs(action.vaepValue) >= 0.08) return 450;
  return 0;
}

function IntensityMeter({ action }: { action: Action }) {
  const level = actionIntensity(action);
  return (
    <div aria-label={`Match intensity ${level} of 12`} className="replay-intensity" title="Intensity combines action value, attacking location, shots, and goals">
      <div className="flex items-center justify-between gap-3">
        <span className="label-meta">Match intensity</span>
        <span className="font-sans text-[0.65rem] tabular-nums text-muted-foreground">{String(level).padStart(2, '0')} / 12</span>
      </div>
      <div className="mt-2 flex gap-1" role="meter" aria-valuemax={12} aria-valuemin={0} aria-valuenow={level}>
        {Array.from({ length: 12 }, (_, index) => <span className={cn('replay-intensity-segment', index < level && 'replay-intensity-segment-active')} key={index} />)}
      </div>
    </div>
  );
}

function ReplayLegend({ teams }: { teams: string[] }) {
  const legendItems = [
    { mark: <span className="replay-legend-marker replay-legend-home" />, label: `${teams[0] ?? 'Home'} · Home` },
    { mark: <span className="replay-legend-marker replay-legend-away" />, label: `${teams[1] ?? 'Away'} · Away` },
    { mark: <span className="replay-legend-ring replay-legend-ring-receiver" />, label: 'Next receiver' },
    { mark: <span className="replay-legend-line replay-legend-line-pass" />, label: 'Pass / cross / through ball' },
    { mark: <span className="replay-legend-line replay-legend-line-carry" />, label: 'Carry / dribble' },
    { mark: <span className="replay-legend-line replay-legend-line-shot" />, label: 'Shot / clearance' },
    { mark: <span className="replay-legend-ball" />, label: 'Football in motion' },
    { mark: <span className="replay-legend-callout">+VAEP</span>, label: 'High-value action' },
    { mark: <span className="replay-legend-stamp">RESET</span>, label: 'Foul / restart / interruption' },
  ];

  return (
    <section aria-label="Replay legend" className="replay-legend">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-meta">Reading the plate</p>
        <p className="font-sans text-[0.65rem] text-muted-foreground">Action marks explain what happened</p>
      </div>
      <div className="replay-legend-grid">
        {legendItems.map((item) => (
          <div className="replay-legend-item" key={item.label}>
            <span className="replay-legend-mark" aria-hidden="true">{item.mark}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShotContext({ action, actions, onSelectAction }: {
  action: Action;
  actions: Action[];
  onSelectAction: (actionId: number) => void;
}) {
  const isShot = action.actionType.toLowerCase().includes('shot') && action.periodId !== 5 && !action.isGoal;
  if (!isShot) return null;

  const index = actions.findIndex((item) => item.actionId === action.actionId);
  const context = actions.slice(Math.max(0, index - 9), index + 1);
  return (
    <PaperPanel className="mt-4">
      <SectionHeading kicker="Understand the play" title="Actions before this shot" />
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Follow the selected shot and up to nine recorded actions before it. The feed can include stoppages or changes of possession, so this is context—not proof that every action built the shot.
      </p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {context.map((item, itemIndex) => (
          <li key={item.id}>
            <button
              aria-current={item.actionId === action.actionId ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 border p-3 text-left transition-colors hover:bg-accent/50',
                item.actionId === action.actionId ? 'border-primary bg-primary/5' : 'border-primary/15',
              )}
              onClick={() => onSelectAction(item.actionId)}
              type="button"
            >
              <span className="font-sans text-xs tabular-nums text-muted-foreground">{String(itemIndex + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.playerName}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.team} · {titleCase(item.actionType)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-sans text-xs tabular-nums">{formatActionTime(item.periodId, item.timeSeconds)}</span>
                <span className="block font-sans text-[0.65rem] tabular-nums text-primary">{formatSignedVaep(item.vaepValue)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </PaperPanel>
  );
}

function GoalBuildUp({ action, actions, teams }: {
  action: Action;
  actions: Action[];
  teams: string[];
}) {
  if (!action.isGoal) return null;

  const goalTeam = action.goalTeam === 'home' ? teams[0] : teams[1];
  const ownGoal = action.result.toLowerCase() === 'owngoal';
  const samePossession = action.possessionId === null
    ? []
    : actions.filter((item) => item.periodId === action.periodId
      && item.possessionId === action.possessionId
      && (item.timeSeconds < action.timeSeconds
        || (item.timeSeconds === action.timeSeconds && item.actionId <= action.actionId)));
  const goalIndex = samePossession.findIndex((item) => item.actionId === action.actionId);
  const buildup = goalIndex >= 0 ? samePossession.slice(Math.max(0, goalIndex - 9), goalIndex + 1) : [];

  return (
    <PaperPanel className="mt-4">
      <SectionHeading kicker="The moment that changed the score" title="How the goal happened" />
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3">
        <p className="font-display text-xl text-foreground">
          GOAL · {action.playerName}{ownGoal ? ' (own goal)' : ''} · {goalTeam}
        </p>
        <p className="font-display text-2xl tabular-nums text-primary">
          {action.goalScoreHome}–{action.goalScoreAway}
        </p>
        <p className="w-full text-xs text-muted-foreground">
          {formatActionTime(action.periodId, action.timeSeconds)}
          {!ownGoal ? ` · Finish model estimate ${formatSignedVaep(action.vaepValue)} VAEP` : ''}
        </p>
      </div>
      {buildup.length ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Recorded actions from the same possession, ending with the goal. This shows the sequence in the event feed; it does not prove each action caused the goal.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {buildup.map((item, index) => (
              <li
                className={cn(
                  'flex items-center gap-3 border p-3',
                  item.actionId === action.actionId ? 'border-amber-500 bg-amber-500/10' : 'border-primary/15',
                )}
                key={item.actionId}
              >
                <span className="font-sans text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.actionId === action.actionId
                      ? ownGoal ? `${item.playerName} · own goal` : `${item.playerName} · GOAL`
                      : item.playerName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.actionId === action.actionId && ownGoal ? `Own goal · scored for ${goalTeam}` : `${item.team} · ${titleCase(item.actionType)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right font-sans text-xs tabular-nums">
                  {formatActionTime(item.periodId, item.timeSeconds)}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Same-possession detail is not available for this goal in the current event feed.
        </p>
      )}
    </PaperPanel>
  );
}

function GoalStories({ actions, match, selectedActionId, teams, onSelectAction }: {
  actions: Action[];
  match: Match | undefined;
  selectedActionId: number;
  teams: string[];
  onSelectAction: (actionId: number) => void;
}) {
  const goals = actions.filter((item) => item.isGoal && item.periodId !== 5);
  if (!goals.length) {
    if (!match || match.homeScore + match.awayScore === 0) return null;

    return (
      <PaperPanel className="mt-5">
        <SectionHeading kicker="Score-changing moments" title="Goal recap unavailable" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          This match finished {match.homeScore}–{match.awayScore}, but its goal events are not in the loaded data. Apply the goal-story database migration, then import <code className="font-mono text-foreground">data/seed_data_64_goals.json</code> to show the scorers, score-after cards, and goal markers. This does not retrain the model or recalculate VAEP.
        </p>
      </PaperPanel>
    );
  }

  return (
    <PaperPanel className="mt-5">
      <SectionHeading kicker="Score-changing moments" title="Every goal" />
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Start with the goals and score. Choose one to follow the recorded actions from that possession and see the scoring moment on the pitch.
      </p>
      <ol className="grid gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const goalTeam = goal.goalTeam === 'home' ? teams[0] : teams[1];
          const ownGoal = goal.result.toLowerCase() === 'owngoal';
          return (
            <li key={goal.actionId}>
              <button
                aria-label={`Goal: ${goalTeam}, ${goal.playerName}${ownGoal ? ', own goal' : ''}, ${formatActionTime(goal.periodId, goal.timeSeconds)}, score ${goal.goalScoreHome} to ${goal.goalScoreAway}`}
                aria-pressed={goal.actionId === selectedActionId}
                className={cn(
                  'flex w-full items-center gap-4 border p-4 text-left transition-colors hover:bg-accent/50',
                  goal.actionId === selectedActionId ? 'border-amber-500 bg-amber-500/10' : 'border-primary/20',
                )}
                onClick={() => onSelectAction(goal.actionId)}
                type="button"
              >
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-black">G</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg">{goal.playerName}{ownGoal ? ' · own goal' : ''}</span>
                  <span className="block truncate text-sm text-muted-foreground">{goalTeam} · {formatActionTime(goal.periodId, goal.timeSeconds)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-2xl tabular-nums text-primary">{goal.goalScoreHome}–{goal.goalScoreAway}</span>
                  {!ownGoal && <span className="block text-xs tabular-nums text-muted-foreground">{formatSignedVaep(goal.vaepValue)} VAEP</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </PaperPanel>
  );
}

function MatchHero({ match, matches, matchId, actionCount, playerCount, highlightCount, onMatchChange, onWatchReplay }: Readonly<{
  match?: Match;
  matches: Match[];
  matchId?: number;
  actionCount: number;
  playerCount: number;
  highlightCount: number;
  onMatchChange: (id: number) => void;
  onWatchReplay: () => void;
}>) {
  return (
    <section className="match-hero relative overflow-hidden" aria-label="Selected match">
      <div className="match-hero-lines" aria-hidden="true" />
      <div className="relative grid gap-5 px-5 py-5 sm:px-7 md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:px-9 md:py-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="match-kicker">Matchday · {String(matchId ?? 1).padStart(3, '0')}</p>
            <span aria-hidden="true" className="h-px w-7 bg-white/30" />
            <p className="match-meta">{match ? `${matchCompetition(match)} · ${matchSeason(match)}` : 'Fixture archive'}</p>
          </div>
          {match ? (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
              <div className="min-w-0 text-right">
                <p className="match-team">{match.homeTeam}</p>
                <p className="match-side-label">Home</p>
              </div>
              <p className="match-score" aria-label={`${match.homeScore} to ${match.awayScore}`}>
                <span>{match.homeScore}</span><span className="match-score-divider">:</span><span>{match.awayScore}</span>
              </p>
              <div className="min-w-0">
                <p className="match-team">{match.awayTeam}</p>
                <p className="match-side-label">Away</p>
              </div>
            </div>
          ) : (
            <h1 className="match-team mt-4">No fixture selected</h1>
          )}
          <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="match-fixture-select">
              <CatalogSelect
                aria-label="Select match"
                label="Choose a fixture"
                onChange={(event) => onMatchChange(Number(event.target.value))}
                value={matchId ?? ''}
              >
                {matches.map((item) => (
                  <option key={item.matchId} value={item.matchId}>
                    {item.homeTeam} {item.homeScore}–{item.awayScore} {item.awayTeam} · {matchCompetition(item)}
                  </option>
                ))}
              </CatalogSelect>
            </div>
            <div className="match-facts" aria-label="Match data summary">
              <span><strong>{actionCount.toLocaleString()}</strong> actions</span>
              <span><strong>{playerCount}</strong> players</span>
              <span><strong>{highlightCount}</strong> key moments</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-center">
          <div className="match-ball-wrap hidden md:block" aria-hidden="true">
            <EngravedFootball className="relative h-24 w-24 opacity-80" />
          </div>
          <Button className="match-cta shrink-0" onClick={onWatchReplay} type="button">
            <Play className="h-4 w-4" /> Watch replay
          </Button>
        </div>
      </div>
    </section>
  );
}

function ActionInspector({ action }: { action: Action }) {
  const isShootoutAction = action.periodId === 5 || action.actionType.endsWith('_shootout');
  const [animatedVaep, setAnimatedVaep] = useState(0);

  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const duration = 720;
    const target = action.vaepValue;
    const animate = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedVaep(target * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [action.actionId, action.vaepValue]);

  return (
    <div className="flex h-full flex-col">
      <p className="label-meta">{action.isGoal ? 'Score-changing moment' : isShootoutAction ? 'Penalty shootout action' : 'Valued action'}</p>
      <p className="font-display mt-2 text-3xl font-semibold leading-none text-primary">{action.isGoal ? 'GOAL' : titleCase(action.actionType)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {action.playerName} → {action.isGoal ? `Score ${action.goalScoreHome}–${action.goalScoreAway}` : titleCase(action.result)} · {formatActionTime(action.periodId, action.timeSeconds)} · Period {action.periodId}
      </p>
      <p className="font-display mt-6 text-6xl font-semibold leading-none tracking-tight text-primary">
        {isShootoutAction ? '—' : formatSignedVaep(animatedVaep)}
      </p>
      {isShootoutAction ? (
        <p className="mt-2 text-sm text-muted-foreground">Shootout kicks stay visible in the replay, but are not rated as normal match actions.</p>
      ) : (
        <>
          <p className="label-meta mt-2">Estimated change in team value</p>
          <dl className="mt-6 space-y-4 border-t border-primary/20 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="label-meta">Attack contribution</dt>
                <dd className="mt-1 font-medium">{formatSignedVaep(action.offensiveValue)}</dd>
              </div>
              <div>
                <dt className="label-meta">Defence contribution</dt>
                <dd className="mt-1 font-medium">{formatSignedVaep(action.defensiveValue)}</dd>
              </div>
            </div>
            <p className="rounded-sm bg-primary/5 p-3 text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">In simple terms:</strong>{' '}
              {action.vaepValue > 0.01
                ? 'This action improved the team’s estimated chance of scoring or reduced its chance of conceding.'
                : action.vaepValue < -0.01
                  ? 'This action lowered the team’s estimated chance of scoring or increased its chance of conceding.'
                  : 'This action made little estimated difference to the team’s scoring or conceding chances.'}
              {' '}This is a model estimate, not a goal or a verdict on the player.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              VAEP considers the next ten actions when estimating outcome risk. This value is the change for the selected action; it does not prove that the action caused a later goal.
            </p>
            <p className="text-sm text-muted-foreground">
              Location {pitchZone(action.startX, action.startY)} · {action.team}
            </p>
          </dl>
        </>
      )}
    </div>
  );
}

export default function ReplayPage() {
  const matches = useListMatches();
  const [matchId, setMatchId] = useState<number | undefined>();
  const actionsQuery = useGetMatchActions(matchId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [section, setSection] = useState<Section>('Overview');
  const [hoveredPlayerId, setHoveredPlayerId] = useState<number | null>(null);
  const [playerFilter, setPlayerFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [minVaep, setMinVaep] = useState(0);
  const [selectedSequence, setSelectedSequence] = useState(0);

  const actions = useMemo(
    () => [...(actionsQuery.data ?? [])].sort((a, b) => a.timeSeconds - b.timeSeconds || a.id - b.id),
    [actionsQuery.data],
  );
  const selectedMatch = useMemo(
    () => (matches.data ?? []).find((match) => match.matchId === matchId),
    [matchId, matches.data],
  );
  const action = actions[currentIndex];
  const topActions = useMemo(
    () => [...actions].sort((a, b) => Math.abs(b.vaepValue) - Math.abs(a.vaepValue)).slice(0, 10),
    [actions],
  );
  const players = useMemo(() => aggregatePlayers(actions), [actions]);
  const playerDetails = useMemo<Record<number, PlayerPitchDetail>>(
    () => Object.fromEntries(players.map((player) => [player.playerId, {
      actions: player.actions,
      totalVaep: player.totalVaep,
      vaepPer90: player.vaepPer90,
    }])),
    [players],
  );
  const sequences = useMemo(() => buildSequences(actions), [actions]);
  const playerNames = useMemo(() => [...new Set(actions.map((item) => item.playerName))].sort(), [actions]);
  const teams = useMemo(
    () => selectedMatch ? [selectedMatch.homeTeam, selectedMatch.awayTeam] : [...new Set(actions.map((item) => item.team))].sort(),
    [actions, selectedMatch],
  );
  const types = useMemo(() => [...new Set(actions.map((item) => item.actionType))].sort(), [actions]);

  const filteredActions = useMemo(() => actions.filter((item) => {
    const zone = pitchZone(item.startX, item.startY);
    return (playerFilter === 'all' || item.playerName === playerFilter)
      && (teamFilter === 'all' || item.team === teamFilter)
      && (typeFilter === 'all' || item.actionType === typeFilter)
      && (zoneFilter === 'all' || zone.startsWith(zoneFilter))
      && Math.abs(item.vaepValue) >= minVaep;
  }), [actions, minVaep, playerFilter, teamFilter, typeFilter, zoneFilter]);
  const timelineActions = useMemo(() => actions.filter(isTimelineEvent), [actions]);
  const timelineLanes = useMemo(() => {
    const laneTimes: number[] = [];
    return timelineActions.map((item) => {
      let lane = laneTimes.findIndex((lastTime) => item.timeSeconds - lastTime >= 240);
      if (lane < 0) {
        lane = laneTimes.length;
        laneTimes.push(Number.NEGATIVE_INFINITY);
      }
      laneTimes[lane] = item.timeSeconds;
      return lane;
    });
  }, [timelineActions]);
  const timelineLaneCount = Math.max(0, ...timelineLanes) + 1;
  const timelineDuration = Math.max(
    90 * 60,
    Math.ceil(Math.max(0, ...actions.filter((item) => item.periodId !== 5).map((item) => item.timeSeconds)) / (15 * 60)) * 15 * 60,
  );
  const timelineTicks = Array.from({ length: Math.floor(timelineDuration / (15 * 60)) + 1 }, (_, index) => index * 15 * 60);

  const visibleActions = hoveredPlayerId
    ? actions.filter((item) => item.playerId === hoveredPlayerId)
    : actions;

  useEffect(() => {
    const available = matches.data ?? [];
    if (available.length && !available.some((match) => match.matchId === matchId)) {
      setMatchId(available[0].matchId);
    }
  }, [matchId, matches.data]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setSelectedSequence(0);
    setPlayerFilter('all');
    setTeamFilter('all');
    setTypeFilter('all');
  }, [matchId]);

  useEffect(() => {
    if (!isPlaying || actions.length < 2 || !action) return;
    const timeout = window.setTimeout(
      () => setCurrentIndex((index) => (index >= actions.length - 1 ? 0 : index + 1)),
      (1800 + replayPauseFor(action)) / speed,
    );
    return () => window.clearTimeout(timeout);
  }, [action, actions.length, currentIndex, isPlaying, speed]);

  useEffect(() => {
    if (selectedSequence >= sequences.length) setSelectedSequence(0);
  }, [selectedSequence, sequences.length]);

  const selectActionId = (actionId: number) => {
    const index = actions.findIndex((item) => item.actionId === actionId);
    if (index >= 0) {
      if (actions[index].isGoal) setSection('Overview');
      setCurrentIndex(index);
      setIsPlaying(false);
    }
  };

  if (matches.isLoading || actionsQuery.isLoading) return <Skeleton className="h-[40rem] w-full" />;
  if (matches.isError || actionsQuery.isError) {
    return (
      <PaperPanel className="py-16 text-center">
        <p className="font-display text-3xl text-primary">The archive could not be opened.</p>
        <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
      </PaperPanel>
    );
  }

  const sequence = sequences[selectedSequence];

  return (
    <div className="space-y-8">
      <MatchHero
        actionCount={actions.length}
        highlightCount={actions.filter((item) => item.result.toLowerCase() === 'goal' || item.actionType.toLowerCase().includes('shot') || Math.abs(item.vaepValue) >= 0.08).length}
        match={selectedMatch}
        matchId={matchId}
        matches={matches.data ?? []}
        onMatchChange={setMatchId}
        onWatchReplay={() => {
          setSection('Overview');
          window.setTimeout(() => document.getElementById('replay-pitch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
        }}
        playerCount={players.length}
      />

      <aside className="border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">First time here?</strong> The score is the result. VAEP is a separate estimate of how each action changes the team’s chances of scoring and conceding; positive is better for that team, negative is worse. It is a guide to the match, not a replacement for watching it.
      </aside>

      <nav aria-label="Match sections" className="blueprint-band flex gap-1 overflow-x-auto border-y border-primary/25 py-2">
        {SECTIONS.map((item) => (
          <button
            key={item}
            className={cn(
              'shrink-0 px-4 py-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em]',
              section === item ? 'text-primary' : 'text-muted-foreground hover:text-primary',
            )}
            onClick={() => setSection(item)}
            type="button"
          >
            <span className={cn('border-b pb-1', section === item ? 'border-primary' : 'border-transparent')}>{SECTION_LABELS[item]}</span>
          </button>
        ))}
      </nav>

      {!action ? (
        <PaperPanel className="py-20 text-center">
          <p className="font-display text-3xl text-primary">No actions are catalogued for this fixture.</p>
        </PaperPanel>
      ) : (
        <>
          {section === 'Moments' && (
            <KeyMoments actions={actions} onSelectAction={selectActionId} selectedActionId={action.actionId} />
          )}

          {section === 'Activity' && <OnBallActivity actions={actions} teams={teams} />}

          {section === 'Compare' && <PlayerComparison players={players} />}

          {(section === 'Overview' || section === 'VAEP') && (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
              <div id="replay-pitch" className="scroll-mt-5 min-w-0">
                <SectionHeading aside="Thin linework, player marks, and the selected trajectory." kicker="Tactical plate" title="Interactive pitch" />
                <EngravedPitch
                  actions={visibleActions}
                  homeTeam={selectedMatch?.homeTeam}
                  hoveredPlayerId={hoveredPlayerId}
                  onHoverPlayer={setHoveredPlayerId}
                  onSelectAction={selectActionId}
                  playerDetails={playerDetails}
                  selected={action}
                />
                <ReplayLegend teams={teams} />
                <div className="mt-4 border border-primary/20 p-4">
                  <Slider
                    aria-label="Replay progress"
                    disabled={actions.length < 2}
                    max={Math.max(actions.length - 1, 0)}
                    min={0}
                    onValueChange={([value]) => { setCurrentIndex(value); setIsPlaying(false); }}
                    step={1}
                    value={[currentIndex]}
                  />
                  <IntensityMeter action={action} />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button aria-label="Restart replay" onClick={() => { setCurrentIndex(0); setIsPlaying(false); }} size="icon" variant="outline"><RotateCcw /></Button>
                      <Button aria-label="Previous action" disabled={currentIndex === 0} onClick={() => { setCurrentIndex((index) => index - 1); setIsPlaying(false); }} size="icon" variant="outline"><ChevronLeft /></Button>
                      <Button aria-label={isPlaying ? 'Pause replay' : 'Play replay'} onClick={() => setIsPlaying((playing) => !playing)} size="icon">{isPlaying ? <Pause /> : <Play />}</Button>
                      <Button aria-label="Next action" disabled={currentIndex === actions.length - 1} onClick={() => { setCurrentIndex((index) => index + 1); setIsPlaying(false); }} size="icon" variant="outline"><ChevronRight /></Button>
                    </div>
                    <label className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
                      Speed
                      <select className="border border-primary/30 bg-background px-2 py-1 text-foreground" onChange={(event) => setSpeed(Number(event.target.value))} value={speed}>
                        <option value={0.5}>0.5×</option>
                        <option value={1}>1×</option>
                        <option value={2}>2×</option>
                      </select>
                    </label>
                  </div>
                  <ShotContext action={action} actions={actions} onSelectAction={selectActionId} />
                  <GoalBuildUp action={action} actions={actions} teams={teams} />
                </div>
              </div>
              <PaperPanel>
                <ActionInspector action={action} />
              </PaperPanel>
            </section>
          )}

          {(section === 'Overview' || section === 'Timeline') && (
            <section>
              <SectionHeading aside={`${timelineActions.length} notable actions shown. Select a mark to inspect it.`} kicker="Match story" title="Key-action timeline" />
              <div aria-label="Key match actions" className="match-timeline">
                <div aria-hidden="true" className="match-timeline-axis">
                  {timelineTicks.map((tick) => (
                    <span className="match-timeline-tick" key={tick} style={{ left: `${(tick / timelineDuration) * 100}%` }}>
                      <span>{formatActionTime(1, tick)}</span>
                    </span>
                  ))}
                </div>
                <div className="match-timeline-events" style={{ height: `${Math.max(84, timelineLaneCount * 18 + 12)}px` }}>
                  {timelineActions.map((item, index) => {
                    const teamIndex = item.isGoal && item.goalTeam
                      ? item.goalTeam === 'home' ? 0 : 1
                      : teams.indexOf(item.team);
                    const type = item.actionType.toLowerCase().replace(/[-_]/g, ' ');
                    const label = item.isGoal ? 'Goal'
                      : type.includes('shot') ? 'Shot'
                      : type.includes('card') ? 'Card'
                        : type.includes('sub') ? 'Substitution'
                          : 'High-impact action';
                    return (
                      <button
                        aria-label={`${label}: ${item.playerName}, ${item.goalTeam ? teams[item.goalTeam === 'home' ? 0 : 1] : item.team}, ${formatActionTime(item.periodId, item.timeSeconds)}${item.isGoal ? `, score ${item.goalScoreHome} to ${item.goalScoreAway}` : `, VAEP ${formatSignedVaep(item.vaepValue)}`}`}
                        className={cn(
                          'match-timeline-event',
                          teamIndex === 1 ? 'match-timeline-away' : 'match-timeline-home',
                          item.isGoal && 'match-timeline-goal',
                          type.includes('shot') && 'match-timeline-shot',
                          Math.abs(item.vaepValue) >= 0.15 && 'match-timeline-high-value',
                          item.actionId === action.actionId && 'match-timeline-selected',
                        )}
                        key={item.id}
                        onClick={() => selectActionId(item.actionId)}
                        style={{
                          left: `${Math.min((item.timeSeconds / timelineDuration) * 100, 100)}%`,
                          top: `${9 + timelineLanes[index] * 18}px`,
                        }}
                        title={item.isGoal
                          ? `GOAL · ${item.playerName}${item.result.toLowerCase() === 'owngoal' ? ' (own goal)' : ''} · ${item.goalTeam === 'home' ? teams[0] : teams[1]} · ${formatActionTime(item.periodId, item.timeSeconds)} · ${item.goalScoreHome}–${item.goalScoreAway}`
                          : `${label} · ${item.playerName} · ${item.team} · ${formatActionTime(item.periodId, item.timeSeconds)} · ${formatSignedVaep(item.vaepValue)} VAEP`}
                        type="button"
                      >
                        {item.isGoal ? 'G' : type.includes('shot') ? 'S' : type.includes('card') ? 'C' : type.includes('sub') ? '↔' : 'V'}
                      </button>
                    );
                  })}
                </div>
                <div className="match-timeline-legend">
                  <span><i className="match-timeline-key match-timeline-home" />{teams[0] ?? 'Home'} (home)</span>
                  <span><i className="match-timeline-key match-timeline-away" />{teams[1] ?? 'Away'} (away)</span>
                  <span><i className="match-timeline-key match-timeline-goal">G</i>Goal</span>
                  <span><i className="match-timeline-key match-timeline-shot">S</i>Shot (not a goal)</span>
                  <span><i className="match-timeline-key match-timeline-high-value">V</i>Large model-estimated change</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Goals are marked first and show the score after they were scored. Other shots did not necessarily result in goals. Select a goal to see the recorded actions from that possession. The timeline is selective; use the replay controls above to move through every action. Shootout kicks are separate from the match clock.
              </p>
              <GoalStories actions={actions} match={selectedMatch} onSelectAction={selectActionId} selectedActionId={action.actionId} teams={teams} />
              <PaperPanel className="mt-5">
                <SectionHeading kicker="New to VAEP?" title="How to read this match" />
                <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground md:grid-cols-3">
                  <p><strong className="text-foreground">Start with the goals.</strong> Each goal card shows the scorer, time, and score at that moment. Select it to follow the actions in that possession.</p>
                  <p><strong className="text-foreground">A shot is not always a goal.</strong> Goal markers come from the recorded event outcome; other shots stay separate, even if their VAEP is high.</p>
                  <p><strong className="text-foreground">Read VAEP as context.</strong> Positive means the model estimates the action helped the team; negative means it hurt the estimate. It is not a goal count, a causal claim, or a complete player rating.</p>
                </div>
              </PaperPanel>
            </section>
          )}

          {(section === 'Overview' || section === 'Actions') && (
            <section>
              <SectionHeading aside="Ranked by absolute VAEP. Bookmark plates from the tactical archive." kicker="Index" title="Top actions" />
              {section === 'Actions' && (
                <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <CatalogSelect label="Player" onChange={(event) => setPlayerFilter(event.target.value)} value={playerFilter}>
                    <option value="all">All players</option>
                    {playerNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </CatalogSelect>
                  <CatalogSelect label="Team" onChange={(event) => setTeamFilter(event.target.value)} value={teamFilter}>
                    <option value="all">All teams</option>
                    {teams.map((name) => <option key={name} value={name}>{name}</option>)}
                  </CatalogSelect>
                  <CatalogSelect label="Action type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                    <option value="all">All types</option>
                    {types.map((name) => <option key={name} value={name}>{titleCase(name)}</option>)}
                  </CatalogSelect>
                  <CatalogSelect label="Pitch zone" onChange={(event) => setZoneFilter(event.target.value)} value={zoneFilter}>
                    <option value="all">All zones</option>
                    <option value="Defensive third">Defensive third</option>
                    <option value="Middle third">Middle third</option>
                    <option value="Attacking third">Attacking third</option>
                  </CatalogSelect>
                  <label className="grid gap-1.5">
                    <span className="label-meta">Minimum |VAEP|</span>
                    <input className="accent-primary" max={0.4} min={0} onChange={(event) => setMinVaep(Number(event.target.value))} step={0.01} type="range" value={minVaep} />
                    <span className="font-sans text-xs text-muted-foreground">{minVaep.toFixed(2)}</span>
                  </label>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {(section === 'Actions' ? filteredActions : topActions).map((item, index) => (
                  <button
                    className={cn(
                      'bookmark-card relative flex gap-4 border border-primary/25 bg-card p-4 text-left transition-colors hover:bg-accent/60',
                      item.actionId === action.actionId && 'border-primary',
                    )}
                    key={item.id}
                    onClick={() => selectActionId(item.actionId)}
                    type="button"
                  >
                    <div className="w-14 shrink-0">
                      <p className="font-display text-3xl leading-none text-primary">{String(index + 1).padStart(2, '0')}</p>
                      <p className="mt-2 font-sans text-xs tabular-nums">{formatActionTime(item.periodId, item.timeSeconds)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl leading-tight">{item.playerName}</p>
                      <p className="text-sm text-muted-foreground">{titleCase(item.actionType)}</p>
                      <p className="mt-2 font-display text-2xl text-primary">{formatSignedVaep(item.vaepValue)} <span className="font-sans text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">VAEP</span></p>
                    </div>
                    <MiniPitch action={item} className="h-16 w-24 shrink-0 border border-primary/15" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {(section === 'Overview' || section === 'Players') && (
            <section>
              <SectionHeading aside="Aggregated from the selected match only." kicker="Ledger" title="Player analysis" />
              <div className="overflow-x-auto border border-primary/20">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="label-meta h-12">Player</TableHead>
                      <TableHead className="label-meta">Team</TableHead>
                      <TableHead className="label-meta text-right">Actions</TableHead>
                      <TableHead className="label-meta hidden text-right sm:table-cell">Successful</TableHead>
                      <TableHead className="label-meta text-right">VAEP</TableHead>
                      <TableHead className="label-meta hidden text-right md:table-cell">VAEP/90</TableHead>
                      <TableHead className="label-meta hidden text-right lg:table-cell">Off.</TableHead>
                      <TableHead className="label-meta hidden text-right lg:table-cell">Def.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((row) => (
                      <TableRow
                        className="cursor-pointer"
                        key={row.playerId}
                        onClick={() => {
                          setHoveredPlayerId(row.playerId);
                          const related = actions.find((item) => item.playerId === row.playerId);
                          if (related) selectActionId(related.actionId);
                        }}
                        onMouseEnter={() => setHoveredPlayerId(row.playerId)}
                        onMouseLeave={() => setHoveredPlayerId(null)}
                      >
                        <TableCell className="font-display text-lg">{row.name}</TableCell>
                        <TableCell>{row.team}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.actions}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.successful}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatSignedVaep(row.totalVaep)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatSignedVaep(row.vaepPer90)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatSignedVaep(row.offensive)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatSignedVaep(row.defensive)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {section === 'Sequences' && (
            <section className="grid gap-6 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <SectionHeading kicker="Manuscript" title="Sequences of play" />
                <ul className="space-y-2">
                  {sequences.map((item, index) => (
                    <li key={item.id}>
                      <button
                        className={cn(
                          'w-full border border-primary/20 px-4 py-3 text-left hover:bg-accent/50',
                          index === selectedSequence && 'border-primary bg-accent/70',
                        )}
                        onClick={() => {
                          setSelectedSequence(index);
                          selectActionId(item.actions[item.peakIndex].actionId);
                        }}
                        type="button"
                      >
                        <p className="label-meta">Plate {String(index + 1).padStart(2, '0')} · Peak {formatSignedVaep(item.peakVaep)}</p>
                        <p className="mt-1 font-display text-xl">{item.actions.map((step) => titleCase(step.actionType)).join(' → ')}</p>
                      </button>
                    </li>
                  ))}
                  {!sequences.length && <li className="text-sm text-muted-foreground">Not enough chained actions to form a sequence.</li>}
                </ul>
              </div>
              <div>
                {sequence ? (
                  <>
                    <EngravedPitch
                      actions={sequence.actions}
                      onSelectAction={selectActionId}
                      playerDetails={playerDetails}
                      selected={sequence.actions[sequence.peakIndex]}
                    />
                    <ol className="mt-5 space-y-0 border-l border-primary/30 pl-5">
                      <li className="label-meta mb-3">Start</li>
                      {sequence.actions.map((step, index) => (
                        <li className="relative pb-5" key={step.id}>
                          <span className="absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full bg-primary" />
                          <button className="text-left" onClick={() => selectActionId(step.actionId)} type="button">
                            <p className={cn('font-display text-2xl', index === sequence.peakIndex && 'text-primary')}>
                              {titleCase(step.actionType)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {step.playerName} · {formatActionTime(step.periodId, step.timeSeconds)} · {formatSignedVaep(step.vaepValue)}
                              {index === sequence.peakIndex ? ' · largest change' : ''}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a sequence from the manuscript list.</p>
                )}
              </div>
            </section>
          )}

          {section === 'VAEP' && (
            <PaperPanel>
              <SectionHeading aside="A scientific appendix for the selected action, not a developer console." kicker="Appendix" title="Model inspector" />
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="label-meta">Model</p>
                  <p className="mt-2 font-display text-2xl">VAEP</p>
                  <p className="mt-1 text-sm text-muted-foreground">Decroos et al. valuation of on-the-ball actions from estimated scoring and conceding probabilities.</p>
                </div>
                <div>
                  <p className="label-meta">Observed features</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Type · {titleCase(action.actionType)}</li>
                    <li>Result · {titleCase(action.result)}</li>
                    <li>Location · ({action.startX.toFixed(1)}, {action.startY.toFixed(1)}) → ({action.endX.toFixed(1)}, {action.endY.toFixed(1)})</li>
                    <li>Time · period {action.periodId}, {formatActionTime(action.periodId, action.timeSeconds)}</li>
                  </ul>
                </div>
                <div>
                  <p className="label-meta">Identity</p>
                  <p className="mt-2 text-sm">{action.playerName} · {action.team}</p>
                  <p className="mt-3 label-meta">Calculation</p>
                  <p className="mt-1 font-display text-xl">ΔP(scores) − ΔP(concedes)</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Offensive {formatSignedVaep(action.offensiveValue)} · defensive {formatSignedVaep(action.defensiveValue)} · composite {formatSignedVaep(action.vaepValue)}
                  </p>
                </div>
              </div>
            </PaperPanel>
          )}
        </>
      )}
    </div>
  );
}
