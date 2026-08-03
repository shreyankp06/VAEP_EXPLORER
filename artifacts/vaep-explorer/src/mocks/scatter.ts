import type { ScatterPoint } from '@workspace/api-client-react';
import { mockTopPlayers } from './players';

export const mockScatterData: ScatterPoint[] = mockTopPlayers.map(p => ({
  playerId: p.playerId,
  name: p.name,
  team: p.team,
  position: p.position,
  vaepPerAction: p.vaepPerAction,
  totalActions: p.totalActions,
  totalVaep: p.totalVaep,
}));
