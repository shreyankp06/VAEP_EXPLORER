import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PaperPanel, SectionHeading } from '@/components/archive/Ornaments';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetActionTypeBreakdown, useGetStatsOverview, useGetTopPlayers } from '@/hooks/api/useStats';
import { useGetMatchActions, useListMatches } from '@/hooks/api/useMatches';
import { formatActionTime, formatNumber, formatSignedVaep, formatVaep, titleCase } from '@/lib/format';

const actionChartConfig = {
  totalVaep: { label: 'Total VAEP', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-28" key={index} />)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const overview = useGetStatsOverview();
  const topPlayers = useGetTopPlayers();
  const actionTypes = useGetActionTypeBreakdown();
  const matches = useListMatches();
  const recentActions = useGetMatchActions(matches.data?.[0]?.matchId);

  if (overview.isLoading || topPlayers.isLoading || actionTypes.isLoading || matches.isLoading || recentActions.isLoading) {
    return <DashboardLoading />;
  }

  if (overview.isError || topPlayers.isError || actionTypes.isError || matches.isError || recentActions.isError) {
    return (
      <PaperPanel className="py-16 text-center">
        <p className="font-display text-3xl text-primary">The atlas could not be loaded.</p>
        <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
      </PaperPanel>
    );
  }

  const stats = overview.data;
  if (!stats) return null;

  const actions = [...(recentActions.data ?? [])]
    .sort((left, right) => right.vaepValue - left.vaepValue)
    .slice(0, 5);

  const kpis = [
    { label: 'Players analysed', value: formatNumber(stats.totalPlayers) },
    { label: 'Matches analysed', value: formatNumber(stats.totalMatches) },
    { label: 'Actions valued', value: formatNumber(stats.totalActions) },
    { label: 'Average VAEP / action', value: formatVaep(stats.avgVaepPerAction) },
  ];

  return (
    <div className="space-y-10">
      <PaperPanel>
        <p className="label-meta">Season atlas</p>
        <h1 className="font-display mt-2 text-5xl font-semibold tracking-tight text-primary md:text-6xl">
          A ledger of <span className="italic font-medium">valuable actions</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          The opening plate of the archive: how much value the catalogue has recorded, who leads it, and which actions move the probabilities of scoring and conceding.
        </p>
      </PaperPanel>

      <section className="grid gap-px border border-primary/25 bg-primary/25 md:grid-cols-2 xl:grid-cols-4" aria-label="Overview statistics">
        {kpis.map(({ label, value }) => (
          <div className="bg-card p-5 hatch-fill" key={label}>
            <p className="label-meta">{label}</p>
            <p className="font-display mt-3 text-4xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <PaperPanel className="xl:col-span-3">
          <SectionHeading kicker="Distribution" title="VAEP by action type" />
          <ChartContainer config={actionChartConfig} className="h-72 w-full aspect-auto">
            <BarChart data={actionTypes.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--primary) / 0.12)" vertical={false} />
              <XAxis dataKey="actionType" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
              <Bar dataKey="totalVaep" fill="var(--color-totalVaep)" radius={0} />
            </BarChart>
          </ChartContainer>
        </PaperPanel>

        <PaperPanel className="xl:col-span-2">
          <SectionHeading kicker="Frontispiece" title="Leading player" />
          <p className="label-meta">Highest cumulative VAEP</p>
          <p className="font-display mt-2 text-4xl text-primary">{stats.topPlayer}</p>
          <p className="mt-1 font-display text-2xl">{formatVaep(stats.topPlayerVaep)}</p>
          <ol className="mt-6 space-y-3 border-t border-primary/20 pt-4">
            {(topPlayers.data ?? []).slice(0, 3).map((player, index) => (
              <li className="flex items-baseline justify-between gap-3" key={player.playerId}>
                <span className="font-display text-xl">
                  <span className="mr-3 text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  {player.name}
                </span>
                <span className="tabular-nums">{formatVaep(player.totalVaep)}</span>
              </li>
            ))}
          </ol>
        </PaperPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <PaperPanel className="xl:col-span-3">
          <SectionHeading kicker="Table" title="Top players" />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-meta">Rank</TableHead>
                <TableHead className="label-meta">Player</TableHead>
                <TableHead className="label-meta">Team</TableHead>
                <TableHead className="label-meta text-right">Total VAEP</TableHead>
                <TableHead className="label-meta text-right">VAEP / action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topPlayers.data ?? []).map((player, index) => (
                <TableRow key={player.playerId}>
                  <TableCell className="tabular-nums">{String(index + 1).padStart(2, '0')}</TableCell>
                  <TableCell>
                    <div className="font-display text-lg">{player.name}</div>
                    <div className="text-xs text-muted-foreground">{player.position}</div>
                  </TableCell>
                  <TableCell>{player.team}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatVaep(player.totalVaep)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVaep(player.vaepPerAction)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PaperPanel>

        <PaperPanel className="xl:col-span-2">
          <SectionHeading kicker="Recent plates" title="High-value actions" />
          <div className="space-y-4">
            {actions.map((action) => (
              <div className="border-b border-primary/15 pb-4 last:border-0 last:pb-0" key={action.id}>
                <p className="label-meta">{formatActionTime(action.periodId, action.timeSeconds)} · {action.team}</p>
                <p className="font-display text-xl">{action.playerName}</p>
                <p className="text-sm text-muted-foreground">{titleCase(action.actionType)}</p>
                <p className="mt-1 font-display text-2xl text-primary">{formatSignedVaep(action.vaepValue)}</p>
              </div>
            ))}
          </div>
        </PaperPanel>
      </section>
    </div>
  );
}
