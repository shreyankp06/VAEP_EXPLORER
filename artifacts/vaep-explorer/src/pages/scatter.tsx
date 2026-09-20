import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Filter, TrendingUp } from 'lucide-react';
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from 'recharts';
import type { ScatterPoint } from '@workspace/api-client-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetScatterData } from '@/hooks/api/useScatter';

const scatterChartConfig = {
  players: { label: 'Players', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const formatVaep = (value: number) => value.toFixed(3);

export default function ScatterPage() {
  const [team, setTeam] = useState('all');
  const [position, setPosition] = useState('all');
  const [minActions, setMinActions] = useState(0);
  const dataQuery = useGetScatterData({
    team: team === 'all' ? undefined : team,
    position: position === 'all' ? undefined : position,
    minActions,
  });

  const teams = useMemo(() => Array.from(new Set((dataQuery.data ?? []).map((player) => player.team))).sort(), [dataQuery.data]);
  const positions = useMemo(() => Array.from(new Set((dataQuery.data ?? []).map((player) => player.position))).sort(), [dataQuery.data]);
  const players = useMemo(() => (dataQuery.data ?? [])
    .filter((player) => team === 'all' || player.team === team)
    .filter((player) => position === 'all' || player.position === position)
    .filter((player) => player.totalActions >= minActions), [dataQuery.data, minActions, position, team]);
  const [selectedPlayer, setSelectedPlayer] = useState<ScatterPoint | null>(null);

  useEffect(() => {
    setSelectedPlayer((current) => players.find((player) => player.playerId === current?.playerId) ?? players[0] ?? null);
  }, [players]);

  if (dataQuery.isLoading) return <Skeleton className="h-[32rem] w-full" />;

  if (dataQuery.isError) {
    return <Card className="border-destructive/40"><CardContent className="py-12 text-center"><p className="font-medium">Scatter data could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Quality vs quantity</CardTitle><p className="text-sm text-muted-foreground">Compare player efficiency (VAEP per action) against total action volume.</p></CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">Team<select className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal" onChange={(event) => setTeam(event.target.value)} value={team}><option value="all">All teams</option>{teams.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium">Position<select className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal" onChange={(event) => setPosition(event.target.value)} value={position}><option value="all">All positions</option>{positions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium">Minimum actions<span className="flex items-center gap-3"><input className="accent-primary" max="100" min="0" onChange={(event) => setMinActions(Number(event.target.value))} type="range" value={minActions} /><span className="min-w-8 text-right font-normal text-muted-foreground">{minActions}</span></span></label>
          </div>

          <ChartContainer config={scatterChartConfig} className="h-[25rem] w-full aspect-auto">
            <ScatterChart margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="totalActions" name="Total actions" tickLine={false} axisLine={false} label={{ value: 'Total actions', position: 'insideBottom', offset: -4 }} type="number" />
              <YAxis dataKey="vaepPerAction" name="VAEP per action" tickFormatter={(value) => Number(value).toFixed(2)} tickLine={false} axisLine={false} label={{ value: 'VAEP / action', angle: -90, position: 'insideLeft' }} type="number" />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={players} fill="var(--color-players)" name="Players" onClick={(_entry, index) => setSelectedPlayer(players[index])} />
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Interpretation</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-muted/60 p-4"><p className="font-medium">Higher on the chart</p><p className="mt-1 text-sm text-muted-foreground">Players whose individual actions carry more average VAEP value.</p></div><div className="rounded-lg bg-muted/60 p-4"><p className="font-medium">Further right</p><p className="mt-1 text-sm text-muted-foreground">Players involved in more recorded on-ball actions.</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary" />Selected player</CardTitle></CardHeader><CardContent>{selectedPlayer ? <div className="space-y-3"><div><p className="text-lg font-semibold">{selectedPlayer.name}</p><p className="text-sm text-muted-foreground">{selectedPlayer.team} · {selectedPlayer.position}</p></div><div className="flex gap-2"><Badge variant="secondary">{selectedPlayer.totalActions} actions</Badge><Badge variant="outline">{formatVaep(selectedPlayer.totalVaep)} total VAEP</Badge></div><p className="text-2xl font-semibold text-primary">{formatVaep(selectedPlayer.vaepPerAction)} <span className="text-sm font-medium text-muted-foreground">VAEP / action</span></p></div> : <p className="text-sm text-muted-foreground">Adjust the filters to select a player.</p>}</CardContent></Card>
      </section>
    </div>
  );
}
