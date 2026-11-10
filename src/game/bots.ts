import type { Config, DomainId } from './config.ts';
import type { Ballot } from './vote.ts';

const STYLES: Record<string, { levels: number[]; appropriate: number }> = {
  greedy: { levels: [4, 4, 4], appropriate: 0 },
  moderate: { levels: [3, 2, 2], appropriate: 1 },
  cautious: { levels: [1, 1, 1], appropriate: 2 },
};

export function botBallot(cfg: Config, seat: number, round: number): Ballot {
  const names = Object.keys(STYLES);
  const style = STYLES[names[(seat + round) % names.length]];
  const order: DomainId[] = cfg.domains.map((d) => d.id);
  const levels = {} as Record<DomainId, number>;
  order.forEach((id, i) => {
    levels[id] = style.levels[i];
  });
  return {
    levels,
    appropriate: style.appropriate,
    investigate: seat % 3 === 2 && round <= 3 ? { domain: order[round % order.length], level: 4 } : null,
    repair: seat % 2 === 0,
    worst: '봇이 적은 최악의 예측',
  };
}
