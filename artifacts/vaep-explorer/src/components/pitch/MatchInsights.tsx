import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { Action, Match } from '@workspace/api-client-react';

import { CatalogSelect, PaperPanel, SectionHeading } from '@/components/archive/Ornaments';
import { Button } from '@/components/ui/button';
import { MiniPitch } from '@/components/pitch/EngravedPitch';
import { formatActionTime, formatSignedVaep, titleCase } from '@/lib/format';
import { PITCH_HEIGHT, PITCH_WIDTH, type PlayerMatchRow } from '@/lib/vaep';

type TeamMatchStats = {
  goals: number;
  shots: number;
  passes: number;
  completedPasses: number;
  corners: number;
  fouls: number;
  defensiveActions: number;
  vaep: number;
};

function collectTeamMatchStats(actions: Action[], team: string, goals: number): TeamMatchStats {
  const teamActions = actions.filter((action) => action.periodId !== 5 && action.team === team);
  const isType = (action: Action, type: string) =>
    action.actionType.toLowerCase().replace(/[-_]/g, ' ').includes(type);
  const count = (predicate: (action: Action) => boolean) => teamActions.filter(predicate).length;

  return {
    goals,
    shots: count((action) => isType(action, 'shot')),
    passes: count((action) => isType(action, 'pass')),
    completedPasses: count((action) => isType(action, 'pass') && action.result.toLowerCase() === 'success'),
    corners: count((action) => isType(action, 'corner')),
    fouls: count((action) => isType(action, 'foul')),
    defensiveActions: count((action) =>
      isType(action, 'tackle') || isType(action, 'interception') || isType(action, 'clearance')),
    vaep: teamActions.reduce((total, action) => total + action.vaepValue, 0),
  };
}

export function MatchScorecard({ actions, match, players }: Readonly<{
  actions: Action[];
  match: Match | undefined;
  players: PlayerMatchRow[];
}>) {
  if (!match) return null;

  const sides = [
    { key: 'home', name: match.homeTeam, score: match.homeScore, colorClass: 'scorecard-home' },
    { key: 'away', name: match.awayTeam, score: match.awayScore, colorClass: 'scorecard-away' },
  ] as const;
  const teamStats = sides.map((side) =>
    collectTeamMatchStats(actions, side.name, side.score));
  const statRows: { label: string; value: (stats: TeamMatchStats) => string; amount: (stats: TeamMatchStats) => number }[] = [
    { label: 'Goals', value: (stats) => String(stats.goals), amount: (stats) => stats.goals },
    { label: 'Shots', value: (stats) => String(stats.shots), amount: (stats) => stats.shots },
    {
      label: 'Passes completed',
      value: (stats) => `${stats.completedPasses} / ${stats.passes}`,
      amount: (stats) => stats.completedPasses,
    },
    {
      label: 'Pass completion',
      value: (stats) => `${stats.passes ? Math.round((stats.completedPasses / stats.passes) * 100) : 0}%`,
      amount: (stats) => stats.passes ? stats.completedPasses / stats.passes : 0,
    },
    { label: 'Corners', value: (stats) => String(stats.corners), amount: (stats) => stats.corners },
    { label: 'Fouls', value: (stats) => String(stats.fouls), amount: (stats) => stats.fouls },
    {
      label: 'Tackles · interceptions · clearances',
      value: (stats) => String(stats.defensiveActions),
      amount: (stats) => stats.defensiveActions,
    },
    { label: 'Team VAEP', value: (stats) => formatSignedVaep(stats.vaep), amount: (stats) => Math.abs(stats.vaep) },
  ];
  const matchMvp = players[0];

  return (
    <section aria-label="Match scorecard" className="scorecard">
      <div className="scorecard-heading">
        <div>
          <p className="label-meta">The match at a glance</p>
          <h2 className="font-display text-3xl text-primary">Matchday scorecard</h2>
        </div>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Team figures are counted from the recorded on-ball actions. The MVP badge marks this match’s highest summed VAEP, not an official award.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.6fr)]">
        <div className="scorecard-mvp">
          <p className="label-meta">VAEP match MVP</p>
          {matchMvp ? (
            <>
              <p className="mt-5 font-display text-3xl leading-tight">{matchMvp.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{matchMvp.team}</p>
              <p className="mt-6 font-display text-4xl text-primary">{formatSignedVaep(matchMvp.totalVaep)}</p>
              <p className="label-meta mt-1">Total VAEP · {matchMvp.actions.toLocaleString()} actions</p>
              <p className="mt-4 border-t border-primary/15 pt-3 text-xs leading-relaxed text-muted-foreground">
                Highest match-level sum of action VAEP. This is a model-based contribution indicator, not a goals-only award or complete player rating.
              </p>
            </>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No standard-play player actions are available for this match.</p>
          )}
        </div>

        <div className="scorecard-stats">
          <div className="scorecard-team-headings">
            {sides.map((side, index) => (
              <div className={`scorecard-team-name ${side.colorClass}`} key={side.key}>
                <span>{side.key === 'home' ? 'Home' : 'Away'}</span>
                <strong>{side.name}</strong>
                <b>{side.score}</b>
                <span className="sr-only">{teamStats[index].goals} goals</span>
              </div>
            ))}
          </div>
          <div className="scorecard-rows">
            {statRows.map((row) => {
              const values = teamStats.map(row.amount);
              const max = Math.max(...values, 0.001);
              return (
                <div className="scorecard-stat-row" key={row.label}>
                  <div className="scorecard-stat-values">
                    <strong className="scorecard-stat-home">{row.value(teamStats[0])}</strong>
                    <span>{row.label}</span>
                    <strong className="scorecard-stat-away">{row.value(teamStats[1])}</strong>
                  </div>
                  <div aria-hidden="true" className="scorecard-bars">
                    <span className="scorecard-bar-home" style={{ width: `${values[0] / max * 100}%` }} />
                    <span className="scorecard-bar-away" style={{ width: `${values[1] / max * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="scorecard-note">
            Stats reflect the available event feed; possession, shots on target, and card totals are not inferred when they are not explicitly available.
          </p>
        </div>
      </div>
    </section>
  );
}

function isKeyMoment(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  return action.result.toLowerCase() === 'goal' || type.includes('shot') || Math.abs(action.vaepValue) >= 0.08;
}

export function KeyMoments({ actions, selectedActionId, onSelectAction }: Readonly<{
  actions: Action[];
  selectedActionId: number;
  onSelectAction: (actionId: number) => void;
}>) {
  const moments = useMemo(() => actions.filter((action) => action.periodId !== 5 && isKeyMoment(action)), [actions]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
  }, [actions]);

  useEffect(() => {
    if (!isPlaying || moments.length < 2) return;
    const timeout = window.setTimeout(() => {
      const nextIndex = (activeIndex + 1) % moments.length;
      setActiveIndex(nextIndex);
      onSelectAction(moments[nextIndex].actionId);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, isPlaying, moments, onSelectAction]);

  const visibleIndex = Math.max(0, moments.findIndex((item) => item.actionId === selectedActionId));
  const activeMoment = moments[activeIndex] ?? moments[0];
  const selectMoment = (index: number) => {
    if (!moments.length) return;
    const nextIndex = (index + moments.length) % moments.length;
    setActiveIndex(nextIndex);
    onSelectAction(moments[nextIndex].actionId);
  };

  return (
    <section aria-label="Key moments reel">
      <SectionHeading aside="Goals, shots, and actions that made the biggest VAEP change." kicker="Matchday reel" title="Key moments" />
      {!activeMoment ? (
        <PaperPanel className="py-12 text-center text-sm text-muted-foreground">No shots, goals, or high-value actions in this fixture.</PaperPanel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
          <PaperPanel className="moment-feature">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)] sm:items-center">
              <div>
                <p className="label-meta">Moment {String(activeIndex + 1).padStart(2, '0')} of {moments.length}</p>
                <p className="font-display mt-3 text-3xl font-semibold text-primary">{titleCase(activeMoment.actionType)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{activeMoment.playerName} · {activeMoment.team} · {formatActionTime(activeMoment.periodId, activeMoment.timeSeconds)}</p>
                <p className="font-display mt-5 text-4xl text-primary">{formatSignedVaep(activeMoment.vaepValue)} <span className="font-sans text-xs uppercase tracking-[0.16em] text-muted-foreground">VAEP</span></p>
              </div>
              <MiniPitch action={activeMoment} className="aspect-[105/68] w-full border border-primary/20" />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-primary/15 pt-4">
              <div className="flex items-center gap-2">
                <Button aria-label="Previous key moment" onClick={() => selectMoment(activeIndex - 1)} size="icon" variant="outline"><ChevronLeft /></Button>
                <Button aria-label={isPlaying ? 'Pause key moments' : 'Play key moments'} onClick={() => setIsPlaying((playing) => !playing)} size="icon"><span className="sr-only">{isPlaying ? 'Pause key moments' : 'Play key moments'}</span>{isPlaying ? <Pause /> : <Play />}</Button>
                <Button aria-label="Next key moment" onClick={() => selectMoment(activeIndex + 1)} size="icon" variant="outline"><ChevronRight /></Button>
              </div>
              <p className="label-meta">Replay advances every 2.8 seconds</p>
            </div>
          </PaperPanel>
          <div className="moment-list" aria-label="Select a key moment">
            {moments.map((item, index) => (
              <button
                aria-current={index === activeIndex ? 'true' : undefined}
                className={`moment-row${index === activeIndex ? ' moment-row-active' : ''}`}
                key={item.id}
                onClick={() => selectMoment(index)}
                type="button"
              >
                <span className="moment-row-time">{formatActionTime(item.periodId, item.timeSeconds)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.playerName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{titleCase(item.actionType)} · {item.team}</span>
                </span>
                <span className="font-sans text-sm font-semibold tabular-nums text-primary">{formatSignedVaep(item.vaepValue)}</span>
              </button>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">Selected key moment {visibleIndex + 1} of {moments.length}</p>
        </div>
      )}
    </section>
  );
}

const ZONE_ROWS = ['Left', 'Centre', 'Right'];
const ZONE_COLUMNS = ['Defensive third', 'Middle third', 'Attacking third'];

export function OnBallActivity({ actions, teams }: Readonly<{ actions: Action[]; teams: string[] }>) {
  const [team, setTeam] = useState('all');
  const teamActions = useMemo(() => team === 'all' ? actions : actions.filter((action) => action.team === team), [actions, team]);
  const zones = useMemo(() => {
    const counts = Array.from({ length: 9 }, () => 0);
    for (const action of teamActions) {
      const column = Math.min(2, Math.floor(Math.max(0, action.startX) / (PITCH_WIDTH / 3)));
      const row = Math.min(2, Math.floor(Math.max(0, action.startY) / (PITCH_HEIGHT / 3)));
      counts[row * 3 + column] += 1;
    }
    return counts;
  }, [teamActions]);
  const peak = Math.max(1, ...zones);
  const hottestIndex = zones.indexOf(peak);
  const activityTeam = team === 'all' ? 'Both teams' : team;

  return (
    <section aria-label="On-ball activity by pitch zone">
      <SectionHeading aside="Action start locations, grouped into nine pitch zones. This is event data, not player-tracking pressure." kicker="Territory & pressure" title="On-ball activity" />
      <PaperPanel>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-lg text-sm text-muted-foreground">Where play was recorded most often for {activityTeam.toLowerCase()}. Coordinates are shown as recorded; they do not represent possession duration.</p>
          <div className="w-full sm:max-w-xs">
            <CatalogSelect label="Team focus" onChange={(event) => setTeam(event.target.value)} value={team}>
              <option value="all">Both teams</option>
              {teams.map((name) => <option key={name} value={name}>{name}</option>)}
            </CatalogSelect>
          </div>
        </div>
        <div className="activity-map-wrap">
          <div aria-hidden="true" className="activity-row-labels"><span>Left</span><span>Centre</span><span>Right</span></div>
          <div className="activity-map" role="grid" aria-label={`${teamActions.length} on-ball actions across nine pitch zones`}>
            {zones.map((count, index) => {
              const share = teamActions.length ? Math.round((count / teamActions.length) * 100) : 0;
              const row = Math.floor(index / 3);
              const column = index % 3;
              return (
                <div
                  aria-label={`${ZONE_COLUMNS[column]}, ${ZONE_ROWS[row]}: ${count.toLocaleString()} actions, ${share}% of total`}
                  className={`activity-zone${index === hottestIndex && count ? ' activity-zone-peak' : ''}`}
                  key={`${ZONE_ROWS[row]}-${ZONE_COLUMNS[column]}`}
                  role="gridcell"
                >
                  <span aria-hidden="true" className="activity-zone-fill" style={{ '--zone-fill': `${Math.round((count / peak) * 100)}%` } as CSSProperties} />
                  <span className="activity-zone-name">{ZONE_COLUMNS[column]}</span>
                  <strong className="activity-zone-count">{count.toLocaleString()}</strong>
                  <span className="activity-zone-share">{share}% of actions</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-3">
          <p className="label-meta">{teamActions.length.toLocaleString()} on-ball actions mapped</p>
          <p className="text-sm text-muted-foreground">Most active: {ZONE_COLUMNS[hottestIndex % 3]} · {ZONE_ROWS[Math.floor(hottestIndex / 3)]}</p>
        </div>
      </PaperPanel>
    </section>
  );
}

const COMPARISON_METRICS: { key: 'actions' | 'successful' | 'totalVaep' | 'offensive' | 'defensive'; label: string; format: (player: PlayerMatchRow) => string }[] = [
  { key: 'actions', label: 'Actions', format: (player) => player.actions.toLocaleString() },
  { key: 'successful', label: 'Successful actions', format: (player) => `${player.successful.toLocaleString()} (${player.actions ? Math.round((player.successful / player.actions) * 100) : 0}%)` },
  { key: 'totalVaep', label: 'Total VAEP', format: (player) => formatSignedVaep(player.totalVaep) },
  { key: 'offensive', label: 'Offensive VAEP', format: (player) => formatSignedVaep(player.offensive) },
  { key: 'defensive', label: 'Defensive VAEP', format: (player) => formatSignedVaep(player.defensive) },
];

export function PlayerComparison({ players }: Readonly<{ players: PlayerMatchRow[] }>) {
  const [firstPlayerId, setFirstPlayerId] = useState<number | undefined>();
  const [secondPlayerId, setSecondPlayerId] = useState<number | undefined>();

  useEffect(() => {
    if (!players.length) {
      setFirstPlayerId(undefined);
      setSecondPlayerId(undefined);
      return;
    }
    const firstAvailable = players.some((player) => player.playerId === firstPlayerId) ? firstPlayerId : players[0].playerId;
    const firstRow = players.find((player) => player.playerId === firstAvailable);
    const secondAvailable = players.find((player) => player.playerId !== firstAvailable && player.playerId === secondPlayerId)?.playerId
      ?? players.find((player) => player.playerId !== firstAvailable && player.team !== firstRow?.team)?.playerId
      ?? players.find((player) => player.playerId !== firstAvailable)?.playerId;
    if (firstAvailable !== firstPlayerId) setFirstPlayerId(firstAvailable);
    if (secondAvailable !== secondPlayerId) setSecondPlayerId(secondAvailable);
  }, [firstPlayerId, players, secondPlayerId]);

  const firstPlayer = players.find((player) => player.playerId === firstPlayerId);
  const secondPlayer = players.find((player) => player.playerId === secondPlayerId);

  if (!firstPlayer || !secondPlayer) {
    return (
      <section aria-label="Player comparison">
        <SectionHeading kicker="Head to head" title="Compare players" />
        <PaperPanel className="py-12 text-center text-sm text-muted-foreground">Two players with recorded actions are needed for a comparison.</PaperPanel>
      </section>
    );
  }

  const chooseFirst = (playerId: number) => {
    setFirstPlayerId(playerId);
    if (playerId === secondPlayerId) setSecondPlayerId(players.find((player) => player.playerId !== playerId)?.playerId);
  };
  const chooseSecond = (playerId: number) => {
    setSecondPlayerId(playerId);
    if (playerId === firstPlayerId) setFirstPlayerId(players.find((player) => player.playerId !== playerId)?.playerId);
  };

  return (
    <section aria-label="Player comparison">
      <SectionHeading aside="Match-level totals from the selected fixture only." kicker="Head to head" title="Compare players" />
      <PaperPanel>
        <div className="compare-controls grid gap-3 sm:grid-cols-2">
          <CatalogSelect label="Player one" onChange={(event) => chooseFirst(Number(event.target.value))} value={firstPlayer.playerId}>
            {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name} · {player.team}</option>)}
          </CatalogSelect>
          <CatalogSelect label="Player two" onChange={(event) => chooseSecond(Number(event.target.value))} value={secondPlayer.playerId}>
            {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name} · {player.team}</option>)}
          </CatalogSelect>
        </div>
        <div className="compare-headings" aria-hidden="true">
          <p>{firstPlayer.name}<span>{firstPlayer.team}</span></p>
          <span className="compare-versus">VS</span>
          <p>{secondPlayer.name}<span>{secondPlayer.team}</span></p>
        </div>
        <div className="compare-metrics">
          {COMPARISON_METRICS.map(({ key, label, format }) => {
            const firstValue = firstPlayer[key];
            const secondValue = secondPlayer[key];
            const maxValue = Math.max(Math.abs(firstValue), Math.abs(secondValue), 0.001);
            return (
              <div className="compare-metric" key={key}>
                <div className="compare-metric-values">
                  <span className="compare-value compare-value-left">{format(firstPlayer)}</span>
                  <span className="compare-metric-label">{label}</span>
                  <span className="compare-value compare-value-right">{format(secondPlayer)}</span>
                </div>
                <div className="compare-meter" role="img" aria-label={`${label}: ${firstPlayer.name} ${format(firstPlayer)}, ${secondPlayer.name} ${format(secondPlayer)}`}>
                  <span className="compare-bar compare-bar-left" style={{ width: `${Math.max(3, Math.abs(firstValue) / maxValue * 100)}%` }} />
                  <span className="compare-bar compare-bar-right" style={{ width: `${Math.max(3, Math.abs(secondValue) / maxValue * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </PaperPanel>
    </section>
  );
}