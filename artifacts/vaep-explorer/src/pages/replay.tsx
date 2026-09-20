import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, RotateCcw } from 'lucide-react';
import type { Action } from '@workspace/api-client-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { useGetMatchActions, useListMatches } from '@/hooks/api/useMatches';

const PITCH_WIDTH = 105;
const PITCH_HEIGHT = 68;
const formatVaep = (value: number) => value.toFixed(3);
const formatSignedVaep = (value: number) => `${value >= 0 ? '+' : ''}${formatVaep(value)}`;
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

function FootballPitch({ action }: { action: Action }) {
  const actionColor = action.vaepValue > 0.005
    ? 'hsl(var(--primary))'
    : action.vaepValue < -0.005
      ? 'hsl(var(--destructive))'
      : '#94a3b8';
  const startY = PITCH_HEIGHT - action.startY;
  const endY = PITCH_HEIGHT - action.endY;

  return (
    <div className="overflow-hidden rounded-xl border bg-[#175c35] p-2 shadow-inner">
      <svg aria-label={`Pitch replay showing ${action.playerName}'s ${action.actionType}`} className="h-auto w-full" viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}>
        <defs><marker id="action-arrow" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5"><path d="M0,0 L5,2.5 L0,5 z" fill={actionColor} /></marker></defs>
        <rect fill="#1d7241" height={PITCH_HEIGHT} width={PITCH_WIDTH} x="0" y="0" />
        <g fill="none" opacity="0.9" stroke="white" strokeWidth="0.55"><rect height="66" width="103" x="1" y="1" /><line x1="52.5" x2="52.5" y1="1" y2="67" /><circle cx="52.5" cy="34" r="9.15" /><circle cx="52.5" cy="34" r="0.65" /><rect height="30.2" width="16.5" x="1" y="18.9" /><rect height="30.2" width="16.5" x="88.5" y="18.9" /><rect height="12.5" width="5.5" x="1" y="27.75" /><rect height="12.5" width="5.5" x="98.5" y="27.75" /><circle cx="12" cy="34" r="0.65" /><circle cx="93" cy="34" r="0.65" /></g>
        <line markerEnd="url(#action-arrow)" stroke={actionColor} strokeLinecap="round" strokeWidth="1.1" x1={action.startX} x2={action.endX} y1={startY} y2={endY} />
        <circle cx={action.startX} cy={startY} fill="white" r="1.8" stroke={actionColor} strokeWidth="0.8" />
        <circle cx={action.endX} cy={endY} fill={actionColor} r="1.4" stroke="white" strokeWidth="0.45" />
      </svg>
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
  const actions = actionsQuery.data ?? [];
  const selectedMatch = useMemo(() => (matches.data ?? []).find((match) => match.matchId === matchId), [matchId, matches.data]);
  const action = actions[currentIndex];

  useEffect(() => {
    const availableMatches = matches.data ?? [];
    if (availableMatches.length && !availableMatches.some((match) => match.matchId === matchId)) {
      setMatchId(availableMatches[0].matchId);
    }
  }, [matchId, matches.data]);
  useEffect(() => { setCurrentIndex(0); setIsPlaying(false); }, [matchId]);
  useEffect(() => {
    if (!isPlaying || actions.length < 2) return;
    const timeout = window.setTimeout(() => setCurrentIndex((index) => index >= actions.length - 1 ? 0 : index + 1), 1800 / speed);
    return () => window.clearTimeout(timeout);
  }, [actions.length, currentIndex, isPlaying, speed]);

  if (matches.isLoading || actionsQuery.isLoading) return <Skeleton className="h-[35rem] w-full" />;
  if (matches.isError || actionsQuery.isError) return <Card className="border-destructive/40"><CardContent className="py-12 text-center"><p className="font-medium">Replay data could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Match action replay</CardTitle><p className="mt-1 text-sm text-muted-foreground">Step through the sequence and see how each action changes value.</p></div><select aria-label="Select match" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={(event) => setMatchId(Number(event.target.value))} value={matchId ?? ''}>{(matches.data ?? []).map((match) => <option key={match.matchId} value={match.matchId}>{match.homeTeam} {match.homeScore}–{match.awayScore} {match.awayTeam}</option>)}</select></CardHeader>
        <CardContent>
          {selectedMatch && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-4 py-3"><Badge variant="secondary">{selectedMatch.competition}</Badge><span className="font-semibold">{selectedMatch.homeTeam} {selectedMatch.homeScore} – {selectedMatch.awayScore} {selectedMatch.awayTeam}</span><span className="text-sm text-muted-foreground">{selectedMatch.season}</span></div>}
          {!action ? <div className="rounded-lg border border-dashed py-20 text-center"><p className="font-medium">No replay actions are available for this match yet.</p><p className="mt-1 text-sm text-muted-foreground">This state will be replaced by real match data later.</p></div> : <div className="grid gap-6 xl:grid-cols-5"><div className="xl:col-span-3"><FootballPitch action={action} /><div className="mt-4 rounded-lg border bg-card p-4"><Slider aria-label="Replay progress" disabled={actions.length < 2} max={Math.max(actions.length - 1, 0)} min={0} onValueChange={([value]) => { setCurrentIndex(value); setIsPlaying(false); }} step={1} value={[currentIndex]} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button aria-label="Restart replay" onClick={() => { setCurrentIndex(0); setIsPlaying(false); }} size="icon" variant="outline"><RotateCcw /></Button><Button aria-label="Previous action" disabled={currentIndex === 0} onClick={() => { setCurrentIndex((index) => index - 1); setIsPlaying(false); }} size="icon" variant="outline"><ChevronLeft /></Button><Button aria-label={isPlaying ? 'Pause replay' : 'Play replay'} onClick={() => setIsPlaying((playing) => !playing)} size="icon">{isPlaying ? <Pause /> : <Play />}</Button><Button aria-label="Next action" disabled={currentIndex === actions.length - 1} onClick={() => { setCurrentIndex((index) => index + 1); setIsPlaying(false); }} size="icon" variant="outline"><ChevronRight /></Button></div><label className="flex items-center gap-2 text-sm text-muted-foreground">Speed<select className="rounded border bg-background px-2 py-1 text-foreground" onChange={(event) => setSpeed(Number(event.target.value))} value={speed}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div></div></div>
            <Card className="xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" />Action value</CardTitle></CardHeader><CardContent className="space-y-5"><div><Badge>{action.actionType}</Badge><p className="mt-3 text-2xl font-semibold">{action.playerName}</p><p className="text-sm text-muted-foreground">{action.team} · Period {action.periodId} · {formatTime(action.timeSeconds)}</p></div><div className="rounded-lg bg-primary/10 p-4"><p className="text-sm text-muted-foreground">Composite VAEP value</p><p className="mt-1 text-3xl font-semibold text-primary">{formatSignedVaep(action.vaepValue)}</p></div><dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-md bg-muted/60 p-3"><dt className="text-muted-foreground">Offensive</dt><dd className="mt-1 font-semibold">{formatSignedVaep(action.offensiveValue)}</dd></div><div className="rounded-md bg-muted/60 p-3"><dt className="text-muted-foreground">Defensive</dt><dd className="mt-1 font-semibold">{formatSignedVaep(action.defensiveValue)}</dd></div></dl><p className="border-t pt-4 text-sm text-muted-foreground">Result: <span className="font-medium capitalize text-foreground">{action.result}</span></p></CardContent></Card></div>}
        </CardContent>
      </Card>

      {!!actions.length && <Card><CardHeader><CardTitle>Action timeline</CardTitle></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{actions.map((item, index) => <button className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${index === currentIndex ? 'border-primary bg-primary/10' : 'hover:bg-muted/60'}`} key={item.id} onClick={() => { setCurrentIndex(index); setIsPlaying(false); }} type="button"><span><span className="font-medium capitalize">{item.actionType}</span><span className="ml-2 text-sm text-muted-foreground">{item.playerName} · {formatTime(item.timeSeconds)}</span></span><span className="font-semibold text-primary">{formatSignedVaep(item.vaepValue)}</span></button>)}</div></CardContent></Card>}
    </div>
  );
}
