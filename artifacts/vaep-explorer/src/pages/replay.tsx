import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import type { Action, Match } from '@workspace/api-client-react';

import { CatalogSelect, CardGlyph, EngravedFootball, GoalGlyph, PaperPanel, SectionHeading, ShotGlyph, SubGlyph, VaepGlyph } from '@/components/archive/Ornaments';
import { EngravedPitch, MiniPitch, type PlayerPitchDetail } from '@/components/pitch/EngravedPitch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetMatchActions, useListMatches } from '@/hooks/api/useMatches';
import { formatPercent, formatSignedVaep, formatTime, titleCase } from '@/lib/format';
import { matchCompetition, matchSeason } from '@/lib/matchMeta';
import { cn } from '@/lib/utils';
import { aggregatePlayers, buildSequences, deriveProbabilities, pitchZone } from '@/lib/vaep';

const SECTIONS = ['Overview', 'Timeline', 'Actions', 'Players', 'Sequences', 'VAEP'] as const;
type Section = (typeof SECTIONS)[number];

function TimelineGlyph({ type, result }: { type: string; result: string }) {
  if (result === 'goal') return <GoalGlyph className="h-4 w-4" />;
  if (type.includes('shot')) return <ShotGlyph className="h-4 w-4" />;
  if (type.includes('card')) return <CardGlyph className="h-4 w-4" />;
  if (type.includes('sub')) return <SubGlyph className="h-4 w-4" />;
  return <VaepGlyph className="h-4 w-4" />;
}

function actionIntensity(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  const attackingProgress = Math.max(0, Math.min(1, action.endX / 105));
  const value = Math.min(1, 0.18 + Math.abs(action.vaepValue) * 2.4 + attackingProgress * 0.18
    + (type.includes('shot') ? 0.28 : 0)
    + (action.result.toLowerCase() === 'goal' ? 0.42 : 0));
  return Math.round(value * 12);
}

function replayPauseFor(action: Action) {
  const type = action.actionType.toLowerCase().replace(/[-_]/g, ' ');
  const result = action.result.toLowerCase();
  if (result === 'goal') return 1100;
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
    { mark: <span className="replay-legend-marker replay-legend-home" />, label: teams[0] ?? 'Team one' },
    { mark: <span className="replay-legend-marker replay-legend-away" />, label: teams[1] ?? 'Team two' },
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

function MatchHero({ match, matches, matchId, onMatchChange }: {
  match?: Match;
  matches: Match[];
  matchId?: number;
  onMatchChange: (id: number) => void;
}) {
  return (
    <PaperPanel className="match-hero overflow-hidden p-0">
      <div className="grid items-center gap-8 p-5 md:p-8 lg:grid-cols-[1fr_auto] lg:p-10">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="label-meta">Match report · plate {String(matchId ?? 1).padStart(3, '0')}</p>
            <span className="h-px w-12 bg-primary/30" />
            <span className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-secondary">90 minutes catalogued</span>
          </div>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            {match ? `${matchCompetition(match)} · ${matchSeason(match)}` : 'Select a fixture from the catalogue'}
          </p>
          {match ? (
            <>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <h1 className="font-display text-right text-4xl font-semibold leading-none tracking-tight text-primary sm:text-5xl md:text-6xl">
                  {match.homeTeam}
                </h1>
                <p className="font-display text-4xl font-medium tabular-nums text-foreground sm:text-5xl md:text-6xl">
                  {match.homeScore} — {match.awayScore}
                </p>
                <h1 className="font-display text-4xl font-semibold leading-none tracking-tight text-primary sm:text-5xl md:text-6xl">
                  {match.awayTeam}
                </h1>
              </div>
            </>
          ) : (
            <h1 className="font-display mt-4 text-4xl text-primary">No fixture selected</h1>
          )}
          <div className="mt-7 max-w-sm">
            <CatalogSelect
              aria-label="Select match"
              label="Catalogue"
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
        </div>
        <div className="relative hidden lg:block">
          <span className="absolute -inset-5 rounded-full border border-dashed border-primary/20" />
          <EngravedFootball className="relative mx-auto h-44 w-44 opacity-80 xl:h-56 xl:w-56" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/20 bg-primary/[0.035] px-5 py-3 md:px-8">
        <p className="label-meta">Home advantage · {match ? `${match.homeTeam} / ${match.awayTeam}` : 'select a fixture'}</p>
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted-foreground">Select a match from the catalogue to begin</p>
      </div>
    </PaperPanel>
  );
}

function ActionInspector({ action }: { action: Action }) {
  const probs = deriveProbabilities(action);
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
      <p className="label-meta">Valued action</p>
      <p className="font-display mt-2 text-3xl font-semibold leading-none text-primary">{titleCase(action.actionType)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {action.playerName} → {titleCase(action.result)} · {formatTime(action.timeSeconds)} · Period {action.periodId}
      </p>
      <p className="font-display mt-6 text-6xl font-semibold leading-none tracking-tight text-primary">
        {formatSignedVaep(animatedVaep)}
      </p>
      <p className="label-meta mt-2">VAEP value</p>
      <dl className="mt-6 space-y-4 border-t border-primary/20 pt-4">
        <div>
          <dt className="label-meta">Scoring probability</dt>
          <dd className="mt-1 font-display text-2xl">{formatPercent(probs.scoresBefore)} → {formatPercent(probs.scoresAfter)}</dd>
        </div>
        <div>
          <dt className="label-meta">Conceding probability</dt>
          <dd className="mt-1 font-display text-2xl">{formatPercent(probs.concedesBefore)} → {formatPercent(probs.concedesAfter)}</dd>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <dt className="label-meta">Offensive</dt>
            <dd className="mt-1 font-medium">{formatSignedVaep(action.offensiveValue)}</dd>
          </div>
          <div>
            <dt className="label-meta">Defensive</dt>
            <dd className="mt-1 font-medium">{formatSignedVaep(action.defensiveValue)}</dd>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Location {pitchZone(action.startX, action.startY)} · {action.team}
        </p>
      </dl>
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
  const teams = useMemo(() => [...new Set(actions.map((item) => item.team))].sort(), [actions]);
  const types = useMemo(() => [...new Set(actions.map((item) => item.actionType))].sort(), [actions]);

  const filteredActions = useMemo(() => actions.filter((item) => {
    const zone = pitchZone(item.startX, item.startY);
    return (playerFilter === 'all' || item.playerName === playerFilter)
      && (teamFilter === 'all' || item.team === teamFilter)
      && (typeFilter === 'all' || item.actionType === typeFilter)
      && (zoneFilter === 'all' || zone.startsWith(zoneFilter))
      && Math.abs(item.vaepValue) >= minVaep;
  }), [actions, minVaep, playerFilter, teamFilter, typeFilter, zoneFilter]);

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
      <MatchHero match={selectedMatch} matchId={matchId} matches={matches.data ?? []} onMatchChange={setMatchId} />

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
            <span className={cn('border-b pb-1', section === item ? 'border-primary' : 'border-transparent')}>{item}</span>
          </button>
        ))}
      </nav>

      {!action ? (
        <PaperPanel className="py-20 text-center">
          <p className="font-display text-3xl text-primary">No actions are catalogued for this fixture.</p>
        </PaperPanel>
      ) : (
        <>
          {(section === 'Overview' || section === 'VAEP') && (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
              <div>
                <SectionHeading aside="Thin linework, player marks, and the selected trajectory." kicker="Tactical plate" title="Interactive pitch" />
                <EngravedPitch
                  actions={visibleActions}
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
                </div>
              </div>
              <PaperPanel>
                <ActionInspector action={action} />
              </PaperPanel>
            </section>
          )}

          {(section === 'Overview' || section === 'Timeline') && (
            <section>
              <SectionHeading aside="Goals, shots and high-value actions along the ninety." kicker="Chronology" title="Match timeline" />
              <div className="relative overflow-x-auto border border-primary/20 py-8">
                <div className="absolute left-6 right-6 top-1/2 h-px bg-primary/30" />
                <ol className="relative flex min-w-[46rem] gap-2 px-6">
                  {actions.map((item, index) => (
                    <li className="flex min-w-0 flex-1 justify-center" key={item.id}>
                      <button
                        className={cn(
                          'group flex flex-col items-center gap-1 text-primary',
                          index === currentIndex ? 'opacity-100' : 'opacity-55 hover:opacity-100',
                        )}
                        onClick={() => selectActionId(item.actionId)}
                        title={`${titleCase(item.actionType)} · ${item.playerName} · ${formatSignedVaep(item.vaepValue)}`}
                        type="button"
                      >
                        <span className="label-meta">{formatTime(item.timeSeconds)}</span>
                        <span className={cn('flex h-8 w-8 items-center justify-center border border-primary/40 bg-card', index === currentIndex && 'bg-primary text-primary-foreground')}>
                          <TimelineGlyph result={item.result} type={item.actionType} />
                        </span>
                        <span className="hidden max-w-16 truncate font-sans text-[10px] uppercase tracking-wider group-hover:block">{item.playerName}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
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
                      <p className="mt-2 font-sans text-xs tabular-nums">{formatTime(item.timeSeconds)}</p>
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
                              {step.playerName} · {formatTime(step.timeSeconds)} · {formatSignedVaep(step.vaepValue)}
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
                    <li>Time · period {action.periodId}, {formatTime(action.timeSeconds)}</li>
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
