import type { Config, DomainId } from './config.ts';
import { createGame, beginRound, endRound, makeRng } from './engine.ts';
import type { Decision, GameState } from './engine.ts';

const STYLES: Record<string, (round: number) => Decision> = {
  greedy: () => ({ levels: { bio: 4, agri: 4, ai: 4 }, appropriate: 0, repair: [] }),
  moderate: (r) => ({ levels: r <= 2 ? { bio: 3, agri: 3, ai: 3 } : { bio: 2, agri: 2, ai: 2 }, appropriate: r <= 2 ? 0 : 1, repair: [] }),
  cautious: () => ({ levels: { bio: 1, agri: 1, ai: 1 }, appropriate: 2, repair: [] }),
  stingy: () => ({ levels: { bio: 0, agri: 0, ai: 0 }, appropriate: 0, repair: [] }),
};

export const SCENARIOS: Record<string, { label: string; styles: string[] }> = {
  allGreedy: { label: '모두 욕심 (모두가 진 경주가 나오기 쉬움)', styles: ['greedy', 'greedy', 'greedy', 'greedy', 'greedy', 'greedy'] },
  allCautious: { label: '모두 신중 (함께 건넌 2075가 나오기 쉬움)', styles: ['cautious', 'cautious', 'cautious', 'cautious', 'cautious', 'cautious'] },
  mixed: { label: '섞인 반 (여러 엔딩이 나옴)', styles: ['greedy', 'greedy', 'moderate', 'moderate', 'moderate', 'cautious'] },
  freeRider: { label: '무임승차 한 나라', styles: ['stingy', 'greedy', 'greedy', 'moderate', 'moderate', 'cautious'] },
};

export function playScenario(cfg: Config, key: string, seed: number, upToRound: number = cfg.rounds): GameState {
  const sc = SCENARIOS[key];
  const rng = makeRng(seed);
  const s = createGame(cfg);
  for (let r = 1; r <= Math.min(upToRound, cfg.rounds); r++) {
    beginRound(s);
    endRound(s, sc.styles.map((n) => STYLES[n](r)), rng);
  }
  return s;
}

export const SCENARIO_DOMAINS: DomainId[] = ['bio', 'agri', 'ai'];
