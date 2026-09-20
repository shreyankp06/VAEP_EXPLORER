import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetLeaderboard } from '@/hooks/api/useLeaderboard';

type SortKey = 'totalVaep' | 'vaepPerAction' | 'offensiveVaep' | 'defensiveVaep';
type SortDirection = 'ascending' | 'descending';

const formatVaep = (value: number) => value.toFixed(3);

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5" />;
  return direction === 'ascending' ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />;
}

export default function LeaderboardPage() {
  const leaderboard = useGetLeaderboard();
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('totalVaep');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const teams = useMemo(
    () => Array.from(new Set((leaderboard.data?.players ?? []).map((player) => player.team))).sort(),
    [leaderboard.data],
  );

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (leaderboard.data?.players ?? [])
      .filter((player) => team === 'all' || player.team === team)
      .filter((player) => !normalizedQuery || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const difference = left[sortKey] - right[sortKey];
        return sortDirection === 'ascending' ? difference : -difference;
      });
  }, [leaderboard.data, query, sortDirection, sortKey, team]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const visiblePlayers = filteredPlayers.slice((page - 1) * pageSize, page * pageSize);

  const changeSort = (key: SortKey) => {
    setPage(1);
    if (key === sortKey) {
      setSortDirection((direction) => direction === 'descending' ? 'ascending' : 'descending');
      return;
    }
    setSortKey(key);
    setSortDirection('descending');
  };

  if (leaderboard.isLoading) {
    return <Skeleton className="h-[32rem] w-full" />;
  }

  if (leaderboard.isError) {
    return <Card className="border-destructive/40"><CardContent className="py-12 text-center"><p className="font-medium">Leaderboard data could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">Refresh the page to try again.</p></CardContent></Card>;
  }

  const sortButton = (label: string, key: SortKey) => (
    <button className="inline-flex items-center hover:text-foreground" onClick={() => changeSort(key)} type="button">
      {label}<SortIcon active={sortKey === key} direction={sortDirection} />
    </button>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Player rankings</CardTitle><p className="mt-1 text-sm text-muted-foreground">Ranked by cumulative value added across all recorded actions.</p></div>
          <Badge variant="secondary">{filteredPlayers.length} players</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search players" className="pl-9" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by player, team, or position" value={query} /></div>
            <select aria-label="Filter by team" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={(event) => { setTeam(event.target.value); setPage(1); }} value={team}>
              <option value="all">All teams</option>
              {teams.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead>Team</TableHead><TableHead className="hidden md:table-cell">Position</TableHead><TableHead className="text-right">{sortButton('Total VAEP', 'totalVaep')}</TableHead><TableHead className="hidden text-right lg:table-cell">{sortButton('Offensive', 'offensiveVaep')}</TableHead><TableHead className="hidden text-right lg:table-cell">{sortButton('Defensive', 'defensiveVaep')}</TableHead><TableHead className="text-right">{sortButton('VAEP / action', 'vaepPerAction')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {visiblePlayers.map((player, index) => <TableRow key={player.playerId}><TableCell className="font-semibold">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-medium">{player.name}</TableCell><TableCell>{player.team}</TableCell><TableCell className="hidden md:table-cell"><Badge variant="outline">{player.position}</Badge></TableCell><TableCell className="text-right font-semibold">{formatVaep(player.totalVaep)}</TableCell><TableCell className="hidden text-right lg:table-cell">{formatVaep(player.offensiveVaep)}</TableCell><TableCell className="hidden text-right lg:table-cell">{formatVaep(player.defensiveVaep)}</TableCell><TableCell className="text-right">{formatVaep(player.vaepPerAction)}</TableCell></TableRow>)}
              {!visiblePlayers.length && <TableRow><TableCell className="py-12 text-center text-muted-foreground" colSpan={8}>No players match your filters.</TableCell></TableRow>}
            </TableBody>
          </Table>

          <div className="mt-5 flex items-center justify-between"><p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button disabled={page === 1} onClick={() => setPage((current) => current - 1)} size="sm" variant="outline">Previous</Button><Button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} size="sm" variant="outline">Next</Button></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
