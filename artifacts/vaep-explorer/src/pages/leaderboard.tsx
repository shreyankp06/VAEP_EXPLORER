import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { CatalogSelect, PaperPanel, SectionHeading } from '@/components/archive/Ornaments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetLeaderboard } from '@/hooks/api/useLeaderboard';
import { formatVaep } from '@/lib/format';

type SortKey = 'totalVaep' | 'vaepPerAction' | 'offensiveVaep' | 'defensiveVaep';
type SortDirection = 'ascending' | 'descending';

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
  const pageSize = 8;

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
      setSortDirection((direction) => (direction === 'descending' ? 'ascending' : 'descending'));
      return;
    }
    setSortKey(key);
    setSortDirection('descending');
  };

  if (leaderboard.isLoading) return <Skeleton className="h-[32rem] w-full" />;

  if (leaderboard.isError) {
    return (
      <PaperPanel className="py-16 text-center">
        <p className="font-display text-3xl text-primary">Rankings could not be loaded.</p>
        <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
      </PaperPanel>
    );
  }

  const sortButton = (label: string, key: SortKey) => (
    <button className="inline-flex items-center hover:text-primary" onClick={() => changeSort(key)} type="button">
      {label}<SortIcon active={sortKey === key} direction={sortDirection} />
    </button>
  );

  return (
    <div className="space-y-8">
      <PaperPanel>
        <p className="label-meta">Player register</p>
        <h1 className="font-display mt-2 text-5xl font-semibold text-primary">VAEP rankings</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          An editorial table of cumulative value added. Filter the catalogue; sort the columns; keep the type as the ranking device.
        </p>
      </PaperPanel>

      <PaperPanel>
        <SectionHeading aside={`${filteredPlayers.length} players in view`} kicker="Catalogue controls" title="Player rankings" />
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="grid gap-1.5">
            <span className="label-meta">Search</span>
            <Input aria-label="Search players" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Player, team, or position" value={query} />
          </label>
          <CatalogSelect aria-label="Filter by team" label="Team" onChange={(event) => { setTeam(event.target.value); setPage(1); }} value={team}>
            <option value="all">All teams</option>
            {teams.map((name) => <option key={name} value={name}>{name}</option>)}
          </CatalogSelect>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-meta">Rank</TableHead>
              <TableHead className="label-meta">Player</TableHead>
              <TableHead className="label-meta">Team</TableHead>
              <TableHead className="label-meta hidden md:table-cell">Position</TableHead>
              <TableHead className="label-meta text-right">{sortButton('Total VAEP', 'totalVaep')}</TableHead>
              <TableHead className="label-meta hidden text-right lg:table-cell">{sortButton('Offensive', 'offensiveVaep')}</TableHead>
              <TableHead className="label-meta hidden text-right lg:table-cell">{sortButton('Defensive', 'defensiveVaep')}</TableHead>
              <TableHead className="label-meta text-right">{sortButton('VAEP / action', 'vaepPerAction')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePlayers.map((player, index) => (
              <TableRow key={player.playerId}>
                <TableCell className="tabular-nums">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</TableCell>
                <TableCell className="font-display text-lg">{player.name}</TableCell>
                <TableCell>{player.team}</TableCell>
                <TableCell className="hidden md:table-cell">{player.position}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatVaep(player.totalVaep)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatVaep(player.offensiveVaep)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatVaep(player.defensiveVaep)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVaep(player.vaepPerAction)}</TableCell>
              </TableRow>
            ))}
            {!visiblePlayers.length && (
              <TableRow>
                <TableCell className="py-12 text-center text-muted-foreground" colSpan={8}>No players match the catalogue filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-5 flex items-center justify-between border-t border-primary/15 pt-4">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button disabled={page === 1} onClick={() => setPage((current) => current - 1)} size="sm" variant="outline">Previous</Button>
            <Button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} size="sm" variant="outline">Next</Button>
          </div>
        </div>
      </PaperPanel>
    </div>
  );
}
