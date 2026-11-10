import type { Config, DomainId } from './config.ts';
import type { Country, Decision } from './engine.ts';

export interface Ballot {
  levels: Record<DomainId, number>;
  appropriate: number;
  investigate: { domain: DomainId; level: number } | null;
  repair: boolean;
  worst: string;
}

export interface Tally {
  decision: Decision;
  ties: string[];
  counts: Record<string, number[]>;
  buried: { domain: DomainId; level: number }[];
  investigateYes: number;
  repairYes: number;
}

// 동률이면 공동 1위 중 무작위로 하나를 고른다 (재투표 없음).
function plurality(values: number[], size: number): { value: number; tied: boolean; counts: number[] } {
  const counts = new Array(size).fill(0);
  for (const v of values) counts[v] += 1;
  const top = Math.max(...counts);
  const winners = counts.map((c, i) => (c === top ? i : -1)).filter((i) => i >= 0);
  const value = winners[Math.floor(Math.random() * winners.length)];
  return { value, tied: winners.length > 1, counts };
}

export function tally(cfg: Config, c: Country, ballots: Ballot[], repairIdx: number[], _revote = false): Tally {
  // ties: 동률이었다가 무작위로 결정된 항목 (정보용, 재투표를 일으키지 않음)
  const ties: string[] = [];
  const counts: Record<string, number[]> = {};
  const levels = {} as Record<DomainId, number>;
  for (const dom of cfg.domains) {
    const lock = c.locks[dom.id] ?? 0;
    const r = plurality(ballots.map((b) => Math.max(lock, b.levels[dom.id])), dom.steps.length);
    levels[dom.id] = r.value;
    counts[dom.id] = r.counts;
    if (r.tied) ties.push(dom.id);
  }
  const ap = plurality(ballots.map((b) => b.appropriate), cfg.appropriate.steps.length);
  counts.appropriate = ap.counts;
  if (ap.tied) ties.push('appropriate');

  const yes = ballots.filter((b) => b.investigate);
  const investigateWins = yes.length * 2 > ballots.length;
  let investigate: Decision['investigate'];
  const buried: Tally['buried'] = [];
  if (investigateWins) {
    const keyed = new Map<string, { domain: DomainId; level: number; n: number }>();
    for (const b of yes) {
      const k = `${b.investigate!.domain}:${b.investigate!.level}`;
      const cur = keyed.get(k);
      if (cur) cur.n += 1;
      else keyed.set(k, { ...b.investigate!, n: 1 });
    }
    const best = [...keyed.values()].sort((a, b) => b.n - a.n || b.level - a.level)[0];
    investigate = { domain: best.domain, level: best.level };
  } else {
    for (const b of yes) buried.push({ domain: b.investigate!.domain, level: b.investigate!.level });
  }
  const repairYes = ballots.filter((b) => b.repair).length;
  const repair = repairYes * 2 > ballots.length ? repairIdx : [];
  return {
    decision: { levels, appropriate: ap.value, ...(investigate ? { investigate } : {}), repair },
    ties,
    counts,
    buried,
    investigateYes: yes.length,
    repairYes,
  };
}

export function recordBuried(c: Country, decision: Decision, buried: Tally['buried']): number {
  let n = 0;
  for (const w of buried) {
    if (decision.levels[w.domain] >= w.level) n += 1;
  }
  c.ignoredWarnings += n;
  return n;
}
