import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from 'recharts';
import type { ScatterPoint } from '@workspace/api-client-react';

import { CatalogSelect, PaperPanel, SectionHeading } from '@/components/archive/Ornaments';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetScatterData } from '@/hooks/api/useScatter';
import { formatVaep } from '@/lib/format';

const scatterChartConfig = {
  players: { label: 'Players', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

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
    return (
      <PaperPanel className="py-16 text-center">
        <p className="font-display text-3xl text-primary">The scatter plate could not be loaded.</p>
        <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
      </PaperPanel>
    );
  }

  return (
    <div className="space-y-8">
      <PaperPanel>
        <p className="label-meta">Comparative plate</p>
        <h1 className="font-display mt-2 text-5xl font-semibold text-primary">Quality against quantity</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Efficiency on the vertical axis, volume on the horizontal. A player high and right is both busy and valuable.
        </p>
      </PaperPanel>

      <PaperPanel>
        <SectionHeading kicker="Catalogue controls" title="Filter the field" />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <CatalogSelect label="Team" onChange={(event) => setTeam(event.target.value)} value={team}>
            <option value="all">All teams</option>
            {teams.map((name) => <option key={name} value={name}>{name}</option>)}
          </CatalogSelect>
          <CatalogSelect label="Position" onChange={(event) => setPosition(event.target.value)} value={position}>
            <option value="all">All positions</option>
            {positions.map((name) => <option key={name} value={name}>{name}</option>)}
          </CatalogSelect>
          <label className="grid gap-1.5">
            <span className="label-meta">Minimum actions</span>
            <span className="flex items-center gap-3">
              <input className="accent-primary w-full" max="100" min="0" onChange={(event) => setMinActions(Number(event.target.value))} type="range" value={minActions} />
              <span className="min-w-8 text-right font-sans text-sm text-muted-foreground">{minActions}</span>
            </span>
          </label>
        </div>

        <ChartContainer config={scatterChartConfig} className="h-[25rem] w-full aspect-auto">
          <ScatterChart margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--primary) / 0.18)" strokeDasharray="2 6" />
            <XAxis dataKey="totalActions" name="Total actions" tickLine={false} axisLine={false} label={{ value: 'Total actions', position: 'insideBottom', offset: -4 }} type="number" />
            <YAxis dataKey="vaepPerAction" name="VAEP per action" tickFormatter={(value) => Number(value).toFixed(2)} tickLine={false} axisLine={false} label={{ value: 'VAEP / action', angle: -90, position: 'insideLeft' }} type="number" />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={players} fill="var(--color-players)" name="Players" onClick={(_entry, index) => setSelectedPlayer(players[index])} />
          </ScatterChart>
        </ChartContainer>
      </PaperPanel>

      <section className="grid gap-6 lg:grid-cols-3">
        <PaperPanel className="lg:col-span-2">
          <SectionHeading kicker="Reading" title="How to interpret the plate" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-primary/15 p-4 hatch-fill">
              <p className="font-display text-2xl text-primary">Higher</p>
              <p className="mt-1 text-sm text-muted-foreground">Actions carry more average VAEP — quality of involvement.</p>
            </div>
            <div className="border border-primary/15 p-4 hatch-fill">
              <p className="font-display text-2xl text-primary">Further right</p>
              <p className="mt-1 text-sm text-muted-foreground">More recorded on-ball actions — quantity of involvement.</p>
            </div>
          </div>
        </PaperPanel>
        <PaperPanel>
          <SectionHeading kicker="Specimen" title="Selected player" />
          {selectedPlayer ? (
            <div>
              <p className="font-display text-3xl text-primary">{selectedPlayer.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPlayer.team} · {selectedPlayer.position}</p>
              <p className="mt-5 label-meta">{selectedPlayer.totalActions} actions</p>
              <p className="font-display mt-2 text-4xl">{formatVaep(selectedPlayer.vaepPerAction)}</p>
              <p className="label-meta mt-1">VAEP / action</p>
              <p className="mt-3 text-sm">Total VAEP {formatVaep(selectedPlayer.totalVaep)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Adjust the filters to select a player.</p>
          )}
        </PaperPanel>
      </section>
    </div>
  );
}
