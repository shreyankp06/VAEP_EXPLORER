import { Activity, Award, BarChart3, Goal, Trophy, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetActionTypeBreakdown, useGetStatsOverview, useGetTopPlayers } from '@/hooks/api/useStats';
import { useGetMatchActions, useListMatches } from '@/hooks/api/useMatches';

const actionChartConfig = {
  totalVaep: { label: 'Total VAEP', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatVaep = (value: number) => value.toFixed(3);
const formatSignedVaep = (value: number) => `${value >= 0 ? '+' : ''}${formatVaep(value)}`;

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-32" key={index} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-96 xl:col-span-3" />
        <Skeleton className="h-96 xl:col-span-2" />
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
      <Card className="border-destructive/40">
        <CardContent className="py-12 text-center">
          <p className="font-medium">Dashboard data could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p>
        </CardContent>
      </Card>
    );
  }

  const stats = overview.data;
  if (!stats) return null;

  const actions = [...(recentActions.data ?? [])]
    .sort((left, right) => right.vaepValue - left.vaepValue)
    .slice(0, 4);

  const kpis = [
    { label: 'Players analysed', value: formatNumber(stats.totalPlayers), icon: Users },
    { label: 'Matches analysed', value: formatNumber(stats.totalMatches), icon: Goal },
    { label: 'Actions valued', value: formatNumber(stats.totalActions), icon: Activity },
    { label: 'Average VAEP / action', value: formatVaep(stats.avgVaepPerAction), icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Overview statistics">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between p-5">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div>
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>VAEP contribution by action type</CardTitle><p className="text-sm text-muted-foreground">Total action value across the selected matches.</p></CardHeader>
          <CardContent>
            <ChartContainer config={actionChartConfig} className="h-72 w-full aspect-auto">
              <BarChart data={actionTypes.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} /><XAxis dataKey="actionType" tickLine={false} axisLine={false} tickMargin={8} /><YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} /><Bar dataKey="totalVaep" fill="var(--color-totalVaep)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Leading player</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg bg-primary/10 p-4"><p className="text-sm text-muted-foreground">Highest cumulative VAEP</p><p className="mt-2 text-2xl font-semibold">{stats.topPlayer}</p><p className="mt-1 text-sm font-medium text-primary">{formatVaep(stats.topPlayerVaep)} VAEP</p></div>
            <div className="space-y-3">
              {(topPlayers.data ?? []).slice(0, 3).map((player, index) => <div className="flex items-center justify-between" key={player.playerId}><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><div><p className="text-sm font-medium">{player.name}</p><p className="text-xs text-muted-foreground">{player.team}</p></div></div><span className="text-sm font-semibold">{formatVaep(player.totalVaep)}</span></div>)}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>Top players</CardTitle></CardHeader>
          <CardContent><Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Total VAEP</TableHead><TableHead className="text-right">VAEP / action</TableHead></TableRow></TableHeader><TableBody>
            {(topPlayers.data ?? []).map((player, index) => <TableRow key={player.playerId}><TableCell className="font-medium">{index + 1}</TableCell><TableCell><div className="font-medium">{player.name}</div><div className="text-xs text-muted-foreground">{player.position}</div></TableCell><TableCell>{player.team}</TableCell><TableCell className="text-right font-medium">{formatVaep(player.totalVaep)}</TableCell><TableCell className="text-right">{formatVaep(player.vaepPerAction)}</TableCell></TableRow>)}
          </TableBody></Table></CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Recent high-value actions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {actions.map((action) => <div className="flex items-start justify-between gap-3 border-b pb-4 last:border-0 last:pb-0" key={action.id}><div><p className="font-medium capitalize">{action.actionType}</p><p className="text-sm text-muted-foreground">{action.playerName} · {action.team}</p><p className="mt-1 text-xs text-muted-foreground">{action.result} in period {action.periodId}</p></div><div className="flex items-center gap-1 text-sm font-semibold text-primary"><Award className="h-4 w-4" />{formatSignedVaep(action.vaepValue)}</div></div>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
