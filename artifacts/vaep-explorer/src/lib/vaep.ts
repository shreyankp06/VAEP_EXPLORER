import type { Action } from '@workspace/api-client-react';

export const PITCH_WIDTH = 105;
export const PITCH_HEIGHT = 68;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type ActionProbabilities = {
  scoresBefore: number;
  scoresAfter: number;
  concedesBefore: number;
  concedesAfter: number;
};

/** Presentation-layer reconstruction of P(scores)/P(concedes) from stored VAEP parts. */
export function deriveProbabilities(action: Action): ActionProbabilities {
  const progress = clamp(action.startX / PITCH_WIDTH, 0, 1);
  const scoresBefore = clamp(0.028 + progress * 0.16 + action.periodId * 0.004, 0.006, 0.72);
  const concedesBefore = clamp(0.062 - progress * 0.038 + (1 - progress) * 0.01, 0.008, 0.28);
  return {
    scoresBefore,
    scoresAfter: clamp(scoresBefore + action.offensiveValue, 0.002, 0.97),
    concedesBefore,
    concedesAfter: clamp(concedesBefore - action.defensiveValue, 0.002, 0.55),
  };
}

export function pitchZone(x: number, y: number) {
  const third = x < PITCH_WIDTH / 3 ? 'Defensive third' : x < (PITCH_WIDTH * 2) / 3 ? 'Middle third' : 'Attacking third';
  const corridor = y < PITCH_HEIGHT / 3 ? 'Left' : y < (PITCH_HEIGHT * 2) / 3 ? 'Centre' : 'Right';
  return `${third} · ${corridor}`;
}

export type PlaySequence = {
  id: string;
  actions: Action[];
  peakIndex: number;
  peakVaep: number;
};

export function buildSequences(actions: Action[], gapSeconds = 18): PlaySequence[] {
  const ordered = [...actions].sort((a, b) => a.timeSeconds - b.timeSeconds || a.id - b.id);
  const groups: Action[][] = [];
  for (const action of ordered) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    const chained =
      previous &&
      action.timeSeconds - previous.timeSeconds <= gapSeconds &&
      previous.result !== 'goal';
    if (!chained) groups.push([action]);
    else current.push(action);
  }

  return groups
    .filter((group) => group.length >= 2)
    .map((group, index) => {
      const peakIndex = group.reduce((best, action, i) => (Math.abs(action.vaepValue) > Math.abs(group[best].vaepValue) ? i : best), 0);
      return {
        id: `seq-${index}-${group[0].actionId}`,
        actions: group,
        peakIndex,
        peakVaep: group[peakIndex].vaepValue,
      };
    });
}

export type PlayerMatchRow = {
  playerId: number;
  name: string;
  team: string;
  actions: number;
  successful: number;
  totalVaep: number;
  offensive: number;
  defensive: number;
  vaepPer90: number;
};

export function aggregatePlayers(actions: Action[]): PlayerMatchRow[] {
  const map = new Map<number, PlayerMatchRow>();
  for (const action of actions) {
    const existing = map.get(action.playerId) ?? {
      playerId: action.playerId,
      name: action.playerName,
      team: action.team,
      actions: 0,
      successful: 0,
      totalVaep: 0,
      offensive: 0,
      defensive: 0,
      vaepPer90: 0,
    };
    existing.actions += 1;
    if (action.result === 'success' || action.result === 'goal') existing.successful += 1;
    existing.totalVaep += action.vaepValue;
    existing.offensive += action.offensiveValue;
    existing.defensive += action.defensiveValue;
    map.set(action.playerId, existing);
  }

  return [...map.values()]
    .map((row) => ({ ...row, vaepPer90: row.totalVaep }))
    .sort((a, b) => b.totalVaep - a.totalVaep);
}

export const TEAM_INK: Record<string, string> = {
  Barcelona: '#2238c4',
  'Real Madrid': '#4b5ed0',
  'Manchester City': '#6d7bdc',
  Liverpool: '#182c8f',
  PSG: '#3149bd',
  'Bayern Munich': '#0d1e72',
};

export function teamInk(team: string) {
  return TEAM_INK[team] ?? '#2238c4';
}
