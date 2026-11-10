import type { Config, DomainId, Stats, Axis, HarmEvent } from './config.ts';
import type { GameEvent, TreatyAgenda } from './events.ts';
import {
  pickRoundEvent,
  getTreatyForRound,
  calculateEventImpact,
  TREATY_AGENDAS,
} from './events.ts';

const AXES: Axis[] = ['health', 'ecology', 'society'];

export interface Harm {
  eventId: string;
  domain: DomainId | 'combo';
  level: number;
  from: number;
  to: number;
  fromRound: number;
  arrivalRound: number;
  amount: Stats;
  spill: boolean;
  devCost: number;
  arrived: boolean;
  applied: Stats;
  repaired: boolean;
}

export interface RoundReport {
  round: number;
  moneyStart: number;
  dev: { domain: DomainId; level: number; success: boolean; cost: number; refund: number }[];
  appro?: { level: number; success: boolean; cost: number };
  income: { domain: DomainId; amount: number }[];
  fees: { domain: DomainId; amount: number; to?: number[]; unpaid?: number }[];
  royaltyIn: { domain: DomainId; from: number; amount: number }[];
  debt: number;
  bankrupt: boolean;
  upkeep: number;
  sent: { eventId: string; to: number; total: number; spill: boolean }[];
  supportDelta: number;
  supportEffects: string[];
}

export interface Country {
  id: number;
  money: number;
  stats: Stats;
  held: Partial<Record<DomainId, { level: number; firstRound: number }>>;
  shield: number;
  locks: Partial<Record<DomainId, number>>;
  investigations: number;
  approSpent: number;
  devSpent: number;
  repairs: number;
  ignoredWarnings: number;
  moneyHistory: number[];
  pressure: Record<DomainId, number>;
  support: number;
  lostToCrisis: number;
  lastCrisisDamage?: Partial<Stats>;
  lastSupportReasons?: string[];
  lastDecision?: Decision;
  lastReport?: RoundReport;
  debt?: number;
  frozen?: number;
  bankruptcies?: number;
  regimeChangeHappened?: boolean;
  demandedDomain?: DomainId | null;
  protested?: boolean;
  eventChoices?: { round: number; eventId: string; choiceId: string }[];
}

export interface Decision {
  levels: Record<DomainId, number>;
  appropriate: number;
  investigate?: { domain: DomainId; level: number };
  repair: number[];
}

export interface GameState {
  cfg: Config;
  round: number;
  countries: Country[];
  harms: Harm[];
  log: string[];
  activeTreaties?: string[];
  currentEvent?: GameEvent | null;
  currentTreaty?: TreatyAgenda | null;
  treatyVotes?: Record<number, boolean>;
  treatyHistory?: { round: number; treatyId: string; passed: boolean; yesVotes: number[]; noVotes: number[] }[];
}

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const zero = (): Stats => ({ health: 0, ecology: 0, society: 0 });

export function createGame(cfg: Config): GameState {
  const countries: Country[] = [];
  const startPressure = cfg.crisis?.enabled && cfg.crisis.start
    ? { ...cfg.crisis.start }
    : { bio: 0, agri: 0, ai: 0 };
  const startSupport = cfg.support?.enabled ? cfg.support.start : 60;

  for (let i = 0; i < cfg.countries; i++) {
    countries.push({
      id: i,
      money: cfg.startMoney,
      stats: { ...cfg.startStats },
      held: {},
      shield: 0,
      locks: {},
      investigations: 0,
      approSpent: 0,
      devSpent: 0,
      repairs: 0,
      ignoredWarnings: 0,
      moneyHistory: [cfg.startMoney],
      pressure: { ...startPressure },
      support: startSupport,
      lostToCrisis: 0,
      debt: 0,
      frozen: 0,
      bankruptcies: 0,
      lastCrisisDamage: {},
      lastSupportReasons: [],
      regimeChangeHappened: false,
      demandedDomain: null,
      protested: false,
      eventChoices: [],
    });
  }
  return {
    cfg,
    round: 0,
    countries,
    harms: [],
    log: [],
    activeTreaties: [],
    currentEvent: null,
    currentTreaty: null,
    treatyVotes: {},
    treatyHistory: [],
  };
}

function shieldMult(state: GameState, c: Country): number {
  const a = state.cfg.appropriate;
  const others = state.countries.reduce((s, x) => s + (x.id === c.id ? 0 : x.shield), 0);
  const patentBonus = state.activeTreaties?.includes('treaty_patent_commons') ? 1.3 : 1.0;
  return 1 - Math.min(a.maxShield, (a.selfShield * c.shield + a.worldShield * others) * patentBonus);
}

export function beginRound(state: GameState): void {
  state.round += 1;

  // Check if a treaty should be proposed this round
  if (state.cfg.treaties?.enabled && state.cfg.treaties.rounds.includes(state.round)) {
    const used = state.treatyHistory?.map((t) => t.treatyId) || [];
    state.currentTreaty = getTreatyForRound(state.round, used, state.round * 101);
  } else {
    state.currentTreaty = null;
  }

  // Check if an emergent event occurs this round
  if (state.cfg.events?.enabled) {
    const used = state.countries.flatMap((c) => c.eventChoices?.map((ec) => ec.eventId) || []);
    state.currentEvent = pickRoundEvent(state.round * 313 + 7, state.round, state.cfg.events.chance, used);
  } else {
    state.currentEvent = null;
  }
  for (const h of state.harms) {
    if (h.arrived || h.arrivalRound !== state.round) continue;
    const c = state.countries[h.to];
    const m = shieldMult(state, c);
    for (const ax of AXES) {
      const v = h.amount[ax] * m;
      h.applied[ax] = v;
      c.stats[ax] = Math.max(0, c.stats[ax] - v);
    }
    h.arrived = true;
    const ev = findEvent(state.cfg, h.eventId);
    if (ev?.lock !== undefined && h.domain !== 'combo' && !h.spill) {
      c.locks[h.domain] = Math.max(c.locks[h.domain] ?? 0, ev.lock);
    }
  }

  // Background Crisis Growth & Damage
  if (state.cfg.crisis?.enabled) {
    for (const c of state.countries) {
      c.lastCrisisDamage = {};

      // Pressure grows starting from round 2
      if (state.round > 1) {
        for (const dom of state.cfg.domains) {
          const d = dom.id;
          const baseGrowth =
            state.cfg.crisis.growth[d] +
            (state.round >= state.cfg.diseaseSurgeRound && d === 'bio'
              ? state.cfg.crisis.surgeBonus
              : 0);
          const heldLevel = c.held[d]?.level ?? 0;
          const heldDamp = state.cfg.crisis.heldGrowthDamp[heldLevel] ?? 0;
          const approDamp = Math.min(
            state.cfg.crisis.approGrowthDampMax,
            c.shield * 0.1
          );
          const netGrowth = Math.max(
            1,
            Math.round(baseGrowth * (1 - heldDamp) * (1 - approDamp))
          );
          c.pressure[d] = Math.min(
            100,
            Math.max(0, (c.pressure[d] ?? 0) + netGrowth)
          );
        }
      }

      // Damage applied if pressure > threshold
      for (const dom of state.cfg.domains) {
        const d = dom.id;
        if (c.pressure[d] > state.cfg.crisis.threshold) {
          const excess = c.pressure[d] - state.cfg.crisis.threshold;
          const rates = state.cfg.crisis.damageRate[d];
          for (const [ax, rate] of Object.entries(rates)) {
            const dmg = Math.round(excess * (rate as number) * 10) / 10;
            if (dmg > 0) {
              c.stats[ax as Axis] = Math.max(0, c.stats[ax as Axis] - dmg);
              c.lostToCrisis += dmg;
              c.lastCrisisDamage[ax as Axis] =
                (c.lastCrisisDamage[ax as Axis] ?? 0) + dmg;
            }
          }
        }
      }
    }
  }
}

export function findEvent(cfg: Config, id: string): HarmEvent | null {
  for (const d of cfg.domains) for (const e of d.events) if (e && e.id === id) return e;
  for (const cb of cfg.combos) if (cb.event.id === id) return cb.event;
  return null;
}

export function repairCost(cfg: Config, h: Harm): number {
  const frac = h.spill ? cfg.domains.find((d) => d.id === h.domain)?.spill[h.level] ?? 0.2 : 1;
  return Math.round(cfg.repairCostMult * h.devCost * frac);
}

export function repairable(state: GameState, countryId: number): number[] {
  const out: number[] = [];
  state.harms.forEach((h, i) => {
    if (h.to === countryId && h.arrived && !h.repaired) out.push(i);
  });
  return out;
}

export function decisionCost(cfg: Config, d: Decision): number {
  let sum = 0;
  for (const dom of cfg.domains) sum += dom.cost[d.levels[dom.id]];
  sum += cfg.appropriate.cost[d.appropriate];
  if (d.investigate) sum += cfg.investigateCost;
  return sum;
}

export function sanitize(state: GameState, c: Country, d: Decision): Decision {
  const cfg = state.cfg;
  const out: Decision = {
    levels: { ...d.levels },
    appropriate: d.appropriate,
    investigate: d.investigate,
    repair: [...d.repair],
  };
  for (const dom of cfg.domains) {
    const lock = c.locks[dom.id] ?? 0;
    // 기술 트리: 지금 가진 단계보다 techStepLimit 단계까지만 한 번에 올릴 수 있다
    const cap = (c.held[dom.id]?.level ?? 0) + (cfg.techStepLimit ?? 99);
    out.levels[dom.id] = Math.max(lock, Math.min(dom.cost.length - 1, cap, out.levels[dom.id]));
  }
  // 재정 파탄 직후 라운드: 신규 투자 불가
  if ((c.frozen ?? 0) > 0) {
    for (const dom of cfg.domains) out.levels[dom.id] = 0;
    out.appropriate = 0;
    out.investigate = undefined;
  }
  // Enforce active treaties restrictions
  if (state.activeTreaties && state.activeTreaties.length > 0) {
    for (const tId of state.activeTreaties) {
      const treaty = TREATY_AGENDAS.find((t) => t.id === tId);
      if (treaty?.prohibitedLevels) {
        for (const [dom, limit] of Object.entries(treaty.prohibitedLevels)) {
          if (limit !== undefined && out.levels[dom as DomainId] >= limit) {
            out.levels[dom as DomainId] = Math.max(0, limit - 1);
          }
        }
      }
    }
  }
  let budget = c.money;
  out.repair = out.repair.filter((i) => {
    const h = state.harms[i];
    if (!h || h.to !== c.id || !h.arrived || h.repaired) return false;
    const rc = repairCost(cfg, h);
    if (rc > budget) return false;
    budget -= rc;
    return true;
  });
  if (out.investigate && cfg.investigateCost > budget) out.investigate = undefined;
  else if (out.investigate) budget -= cfg.investigateCost;
  const cost = () => decisionCost(cfg, { ...out, investigate: undefined }) ;
  while (cost() > budget) {
    let worst: { kind: 'dom' | 'app'; id?: DomainId; c: number } | null = null;
    for (const dom of cfg.domains) {
      const l = out.levels[dom.id];
      const lock = c.locks[dom.id] ?? 0;
      if (l > lock && (!worst || dom.cost[l] > worst.c)) worst = { kind: 'dom', id: dom.id, c: dom.cost[l] };
    }
    if (out.appropriate > 0 && (!worst || cfg.appropriate.cost[out.appropriate] > worst.c)) {
      worst = { kind: 'app', c: cfg.appropriate.cost[out.appropriate] };
    }
    if (!worst) {
      for (const dom of cfg.domains) out.levels[dom.id] = 0;
      out.appropriate = 0;
      break;
    }
    if (worst.kind === 'dom') out.levels[worst.id!] -= 1;
    else out.appropriate -= 1;
  }
  return out;
}

export interface Investigation {
  severity: '낮음' | '중간' | '높음';
  axes: Axis[];
}

export function investigate(cfg: Config, domain: DomainId, level: number): Investigation {
  const dom = cfg.domains.find((d) => d.id === domain)!;
  const ev = dom.events[level];
  if (!ev) return { severity: '낮음', axes: [] };
  const total = AXES.reduce((s, ax) => s + (ev.harm[ax] ?? 0), 0);
  const axes = AXES.filter((ax) => (ev.harm[ax] ?? 0) >= 3);
  return { severity: total >= 12 ? '높음' : total >= 6 ? '중간' : '낮음', axes };
}

function schedule(state: GameState, ev: HarmEvent, domain: DomainId | 'combo', level: number, from: number, spill: number, devCost: number): void {
  const cfg = state.cfg;
  const arrival = state.round + cfg.harmDelay;
  let effectiveSpill = spill;
  if (domain === 'agri' && state.activeTreaties?.includes('treaty_lmo_safeguard')) {
    effectiveSpill *= 0.7; // 30% reduction in LMO agriculture cross-border spill
  }
  for (const c of state.countries) {
    const self = c.id === from;
    const f = self ? 1 : effectiveSpill;
    if (f <= 0) continue;
    const amount = zero();
    for (const ax of AXES) amount[ax] = (ev.harm[ax] ?? 0) * f * cfg.harmScale;
    state.harms.push({
      eventId: ev.id,
      domain,
      level,
      from,
      to: c.id,
      fromRound: state.round,
      arrivalRound: arrival,
      amount,
      spill: !self,
      devCost,
      arrived: false,
      applied: zero(),
      repaired: false,
    });
  }
}

export function endRound(state: GameState, decisions: Decision[], rng: Rng): Decision[] {
  const cfg = state.cfg;
  const final: Decision[] = [];
  const succeeded: Record<number, Partial<Record<DomainId, number>>> = {};

  state.countries.forEach((c, i) => {
    let rawDecision = decisions[i];
    const report: RoundReport = { round: state.round, moneyStart: c.money, dev: [], income: [], fees: [], royaltyIn: [], debt: c.debt ?? 0, bankrupt: false, upkeep: 0, sent: [], supportDelta: 0, supportEffects: [] };
    c.lastReport = report;
    // Check Regime Change (< 10):
    // "10 미만: '정권 교체' — 이번 라운드 투표 결과가 무효가 되고(이전 라운드와 같은 결정으로 대체), 돈 −10%. 한 게임에 최대 1회."
    if (
      cfg.support?.enabled &&
      c.support < cfg.support.regimeChangeThreshold &&
      !c.regimeChangeHappened
    ) {
      c.regimeChangeHappened = true;
      c.money = Math.max(0, Math.round(c.money * (1 - cfg.support.regimeChangePenalty)));
      rawDecision = c.lastDecision ?? {
        levels: { bio: 0, agri: 0, ai: 0 },
        appropriate: 0,
        repair: [],
      };
      report.supportEffects.push('정권 교체: 국민 불신임으로 이번 투표 무효화 및 자금 10% 삭감');
    }

    // 유지비: 이미 가진 기술의 단계 합계 x upkeepPerLevel. 못 내면 빚이 된다
    const heldSum = cfg.domains.reduce((s, dm) => s + (c.held[dm.id]?.level ?? 0), 0);
    const upkeep = Math.round(heldSum * (cfg.upkeepPerLevel ?? 0));
    if (upkeep > 0) {
      const pay = Math.min(Math.max(0, c.money), upkeep);
      c.money -= pay;
      if (upkeep > pay) c.debt = (c.debt ?? 0) + (upkeep - pay);
    }
    report.upkeep = upkeep;

    const d = sanitize(state, c, rawDecision);
    if ((c.frozen ?? 0) > 0) {
      c.frozen = (c.frozen ?? 1) - 1;
      report.supportEffects.push('재정 파탄 여파: 이번 라운드는 신규 투자를 할 수 없었어요');
    }
    final.push(d);
    c.lastDecision = d;

    for (const idx of d.repair) {
      const h = state.harms[idx];
      const cost = repairCost(cfg, h);
      c.money -= cost;
      h.repaired = true;
      c.repairs += 1;
      for (const ax of AXES) {
        c.stats[ax] = Math.min(cfg.startStats[ax], c.stats[ax] + h.applied[ax] * cfg.repairRestore);
      }
    }
    if (d.investigate) {
      c.money -= cfg.investigateCost;
      c.investigations += 1;
    }
    succeeded[i] = {};
    for (const dom of cfg.domains) {
      const L = d.levels[dom.id];
      if (L <= 0) continue;
      c.money -= dom.cost[L];
      c.devSpent += dom.cost[L];
      const ok = rng() < dom.success[L];
      // 실패해도 비용의 일부를 돌려받는다 (실패 리스크 완화)
      const refund = ok ? 0 : Math.round(dom.cost[L] * (cfg.failRefund ?? 0));
      c.money += refund;
      report.dev.push({ domain: dom.id, level: L, success: ok, cost: dom.cost[L], refund });
      if (ok) {
        succeeded[i][dom.id] = L;
        const cur = c.held[dom.id];
        c.held[dom.id] = { level: Math.max(cur?.level ?? 0, L), firstRound: cur?.firstRound ?? state.round };
        const ev = dom.events[L];
        if (ev) schedule(state, ev, dom.id, L, i, dom.spill[L], dom.cost[L]);
      }
    }
    const a = d.appropriate;
    if (a > 0) {
      c.money -= cfg.appropriate.cost[a];
      c.approSpent += cfg.appropriate.cost[a];
      const aok = rng() < cfg.appropriate.success[a];
      if (aok) c.shield += a;
      report.appro = { level: a, success: aok, cost: cfg.appropriate.cost[a] };
    }
    for (const cb of cfg.combos) {
      const ok = Object.entries(cb.needs).every(([k, v]) => (succeeded[i][k as DomainId] ?? 0) >= (v as number));
      if (ok) schedule(state, cb.event, 'combo', 0, i, 0.2, 0);
    }
    report.sent = state.harms
      .filter((h) => h.from === c.id && h.fromRound === state.round)
      .map((h) => ({ eventId: h.eventId, to: h.to, total: Math.round(statSum(h.amount) * 10) / 10, spill: h.spill }));

    // Crisis pressure reduction upon success
    if (cfg.crisis?.enabled) {
      for (const dom of cfg.domains) {
        if (succeeded[i][dom.id]) {
          const L = succeeded[i][dom.id]!;
          const relief = cfg.crisis.resolveReduction[L] ?? 0;
          c.pressure[dom.id] = Math.max(0, c.pressure[dom.id] - relief);
        }
      }
    }

    // Support update
    if (cfg.support?.enabled) {
      const reasons: string[] = [];
      let delta = 0;

      // 1. Neglect of high crisis (pressure > threshold and no investment)
      for (const dom of cfg.domains) {
        if (c.pressure[dom.id] > cfg.crisis.threshold && d.levels[dom.id] === 0) {
          delta -= cfg.support.neglectPenalty;
          reasons.push(`${dom.label} 위기 방치 (-${cfg.support.neglectPenalty}%)`);
        }
      }

      // 2. Successful crisis resolution
      for (const dom of cfg.domains) {
        if (succeeded[i][dom.id]) {
          delta += cfg.support.successBonus;
          reasons.push(`${dom.label} 위기 완화 성공 (+${cfg.support.successBonus}%)`);
        }
      }

      // 3. Arrived harm penalty in this round
      const arrivedHarmSum = state.harms
        .filter((h) => h.to === c.id && h.arrived && h.arrivalRound === state.round)
        .reduce((sum, h) => sum + statSum(h.applied), 0);
      if (arrivedHarmSum > 0) {
        const harmLoss = Math.min(cfg.support.harmPenaltyCap ?? 99, Math.round(arrivedHarmSum * cfg.support.harmPenaltyMultiplier));
        if (harmLoss > 0) {
          delta -= harmLoss;
          reasons.push(`기술 부작용 피해 발생 (-${harmLoss}%)`);
        }
      }

      // 4. Bold action / high risk choice (level 3~4 immediate relief approval)
      const hasHighRisk = Object.values(d.levels).some((L) => L >= 3);
      if (hasHighRisk) {
        delta += cfg.support.highRiskBonus;
        reasons.push(`적극적 위기 대응 지지 (+${cfg.support.highRiskBonus}%)`);
      }

      // 5. Investigation and repair bonus
      if (d.investigate) {
        delta += cfg.support.investigateBonus;
        reasons.push(`사전 위험 조사 (+${cfg.support.investigateBonus}%)`);
      }
      if (d.repair.length > 0) {
        delta += cfg.support.repairBonus;
        reasons.push(`피해 복구 노력 (+${cfg.support.repairBonus}%)`);
      }

      c.support = Math.max(0, Math.min(100, c.support + delta));
      report.supportDelta = delta;

      // Consequences of low support:
      c.protested = false;
      c.demandedDomain = null;

      // Protest (< 40): next round money -5%
      if (c.support < cfg.support.protestThreshold) {
        c.protested = true;
        const lost = Math.round(c.money * cfg.support.protestPenalty);
        c.money = Math.max(0, c.money - lost);
        const soc = cfg.support.protestSocietyLoss ?? 0;
        if (soc > 0) c.stats.society = Math.max(0, c.stats.society - soc);
        report.supportEffects.push('시위 발생: 자금 -' + lost + (soc ? ', 사회 -' + soc : ''));
      } else if (c.support >= (cfg.support.highThreshold ?? 101)) {
        // 높은 지지도: 세금·투자 협조로 자금 보너스
        const gain = Math.round(c.money * (cfg.support.highBonusRate ?? 0));
        c.money += gain;
        if (gain > 0) report.supportEffects.push('높은 지지도 보너스: 자금 +' + gain);
      }

      // Public Demand (< 25): force min level 1 development on highest pressure domain
      if (c.support < cfg.support.demandThreshold) {
        let maxP = -1;
        let highestDom: DomainId = 'bio';
        for (const dom of cfg.domains) {
          if (c.pressure[dom.id] > maxP) {
            maxP = c.pressure[dom.id];
            highestDom = dom.id;
          }
        }
        c.locks[highestDom] = Math.max(c.locks[highestDom] ?? 0, 1);
        c.demandedDomain = highestDom;
        report.supportEffects.push('국민 요구: 가장 위험한 영역에 최소 1단계 투자가 강제돼요');
      }
      c.lastSupportReasons = [...reasons, ...report.supportEffects];
    }
  });

  const royaltyReceived: Record<number, number> = {};
  for (const dom of cfg.domains) {
    const holders = state.countries.filter((c) => c.held[dom.id]);
    if (!holders.length) continue;
    const weight = (c: Country) => {
      const h = c.held[dom.id]!;
      return h.level * h.level * (1 + cfg.timeBonusPerRound * Math.max(0, cfg.rounds - h.firstRound));
    };
    const totalW = holders.reduce((s, c) => s + weight(c), 0);
    const surge = state.round >= cfg.diseaseSurgeRound && dom.id === 'bio' ? cfg.diseaseFeeMult : 1;
    // 시장 수익: 기술을 가진 나라끼리 단계·선점 가중치로 나눈다
    for (const c of holders) {
      const gain = (dom.pool * weight(c)) / totalW;
      c.money += gain;
      c.lastReport?.income.push({ domain: dom.id, amount: Math.round(gain) });
    }
    // 로열티: 나보다 높은 단계의 기술을 가진 나라에 "단계 차이"만큼 사용료를 낸다
    for (const c of state.countries) {
      const own = c.held[dom.id]?.level ?? 0;
      const higher = holders.filter((h) => h.id !== c.id && h.held[dom.id]!.level > own);
      if (!higher.length) continue;
      const top = Math.max(...higher.map((h) => h.held[dom.id]!.level));
      const due = Math.round(dom.importFee * surge * cfg.royaltyPerGap * (top - own));
      const pay = Math.min(Math.max(0, c.money), due);
      const unpaid = due - pay;
      c.money -= pay;
      if (unpaid > 0) c.debt = (c.debt ?? 0) + unpaid; // 못 낸 로열티는 빚이 된다
      const hw = higher.reduce((s, h) => s + weight(h), 0);
      let actual = 0;
      for (const h of higher) {
        // 한 나라가 한 라운드에 받을 수 있는 로열티 상한 (독주 방지). 넘는 몫은 낸 나라에 돌려준다
        const room = Math.max(0, cfg.royaltyReceiveCap - (royaltyReceived[h.id] ?? 0));
        const share = Math.min((pay * weight(h)) / hw, room);
        royaltyReceived[h.id] = (royaltyReceived[h.id] ?? 0) + share;
        h.money += share;
        actual += share;
        h.lastReport?.royaltyIn.push({ domain: dom.id, from: c.id, amount: Math.round(share) });
      }
      c.money += pay - actual;
      c.lastReport?.fees.push({ domain: dom.id, amount: Math.round(actual), to: higher.map((h) => h.id), unpaid });
    }
  }

  // 재정 적자 → 빚 → 재정 파탄
  state.countries.forEach((c) => {
    const report = c.lastReport;
    c.money = isNaN(c.money) ? 0 : c.money;
    c.debt = c.debt ?? 0;
    if (c.debt > 0 && c.money > 0) {
      const repay = Math.min(c.money, c.debt);
      c.money -= repay;
      c.debt -= repay;
    }
    if (c.debt > 0) c.debt = Math.round(c.debt * (1 + cfg.debtInterest));
    if (c.debt >= cfg.bankruptcyDebt) {
      for (const ax of AXES) c.stats[ax] = Math.max(0, c.stats[ax] - cfg.bankruptcyStatLoss);
      if (cfg.support?.enabled) c.support = Math.max(0, c.support - cfg.bankruptcySupportLoss);
      c.money = 0;
      c.debt = 0;
      c.frozen = 1;
      c.bankruptcies = (c.bankruptcies ?? 0) + 1;
      if (report) {
        report.bankrupt = true;
        report.supportEffects.push(
          '재정 파탄! 빚을 못 갚아 모든 스탯 -' + cfg.bankruptcyStatLoss + ', 지지도 -' + cfg.bankruptcySupportLoss + ', 다음 라운드 신규 투자 불가'
        );
      }
    }
    if (report) report.debt = c.debt;
  });

  // Ensure money is non-negative and not NaN
  state.countries.forEach((c) => {
    c.money = Math.max(0, Math.round(isNaN(c.money) ? 0 : c.money));
    c.moneyHistory.push(c.money);
  });
  return final;
}

export function resolveTreatyVote(
  state: GameState,
  votes: Record<number, boolean>
): { passed: boolean; yesVotes: number[]; noVotes: number[] } {
  state.treatyVotes = votes;
  const treaty = state.currentTreaty;
  if (!treaty) return { passed: false, yesVotes: [], noVotes: [] };

  const yesVotes: number[] = [];
  const noVotes: number[] = [];
  for (let i = 0; i < state.countries.length; i++) {
    if (votes[i]) yesVotes.push(i);
    else noVotes.push(i);
  }

  const passThreshold = state.cfg.treaties?.passThreshold ?? 4;
  const passed = yesVotes.length >= passThreshold;

  if (passed) {
    if (!state.activeTreaties) state.activeTreaties = [];
    if (!state.activeTreaties.includes(treaty.id)) {
      state.activeTreaties.push(treaty.id);
    }
    // Apply global treaty bonuses
    if (treaty.globalStatsBonus) {
      for (const c of state.countries) {
        for (const [ax, val] of Object.entries(treaty.globalStatsBonus)) {
          c.stats[ax as Axis] = Math.min(100, Math.max(0, c.stats[ax as Axis] + (val || 0)));
        }
      }
    }
    if (treaty.globalSupportBonus) {
      for (const c of state.countries) {
        c.support = Math.min(100, Math.max(0, c.support + treaty.globalSupportBonus));
      }
    }
  }

  if (!state.treatyHistory) state.treatyHistory = [];
  state.treatyHistory.push({
    round: state.round,
    treatyId: treaty.id,
    passed,
    yesVotes,
    noVotes,
  });

  return { passed, yesVotes, noVotes };
}

export function applyEventChoices(
  state: GameState,
  choices: Record<number, string>
): void {
  const ev = state.currentEvent;
  if (!ev) return;

  state.countries.forEach((c) => {
    const choiceId = choices[c.id] || ev.choices[0].id;
    const impact = calculateEventImpact(ev, c, choiceId);

    // Apply stats
    for (const ax of AXES) {
      c.stats[ax] = Math.min(100, Math.max(0, c.stats[ax] + impact.statsDelta[ax]));
    }
    // Apply support
    c.support = Math.min(100, Math.max(0, c.support + impact.supportDelta));
    // Apply money
    c.money = Math.max(0, Math.round(c.money + impact.moneyDelta));

    if (!c.eventChoices) c.eventChoices = [];
    c.eventChoices.push({
      round: state.round,
      eventId: ev.id,
      choiceId,
    });
  });
}

export function worldStats(state: GameState, includePending: boolean): Stats[] {
  return state.countries.map((c) => {
    const s = { ...c.stats };
    if (includePending) {
      for (const h of state.harms) {
        if (h.to !== c.id || h.arrived) continue;
        const m = shieldMult(state, c);
        for (const ax of AXES) s[ax] = Math.max(0, s[ax] - h.amount[ax] * m);
      }
    }
    return s;
  });
}

export function statSum(s: Stats): number {
  return s.health + s.ecology + s.society;
}

export type EarthEnding = 'race' | 'field' | 'designed' | 'matched' | 'islands' | 'together';

export const ENDING_NAMES: Record<EarthEnding, string> = {
  race: '모두가 진 경주',
  field: '침묵하는 들판',
  designed: '설계된 사람들',
  matched: '맞춰 주는 세상',
  islands: '부자 나라의 섬들',
  together: '함께 건넌 2075',
};

export function earthEnding(state: GameState): { ending: EarthEnding; avg: Stats; top2: number; appro: number } {
  const cfg = state.cfg;
  const fin = worldStats(state, true);
  const avg = zero();
  for (const s of fin) for (const ax of AXES) avg[ax] += s[ax] / fin.length;
  const total = state.countries.reduce((s, c) => s + Math.max(0, c.money), 0) || 1;
  const sorted = state.countries.map((c) => Math.max(0, c.money)).sort((a, b) => b - a);
  const top2 = (sorted[0] + sorted[1]) / total;
  const appro = state.countries.reduce((s, c) => s + c.shield, 0);
  const collapsed = AXES.filter((ax) => avg[ax] < cfg.ending.collapseLine);
  let ending: EarthEnding;
  if (collapsed.length >= 2) ending = 'race';
  else if (collapsed[0] === 'ecology') ending = 'field';
  else if (collapsed[0] === 'health') ending = 'designed';
  else if (collapsed[0] === 'society') ending = 'matched';
  else if (top2 >= cfg.ending.wealthTop2Share) ending = 'islands';
  else if (AXES.every((ax) => avg[ax] >= cfg.ending.shakyLine) && appro >= cfg.ending.approTotalGood && top2 < cfg.ending.gapGood * 1.0) ending = 'together';
  else ending = 'islands';
  return { ending, avg, top2, appro };
}

export type Verdict = 'unseen' | 'ignored' | 'exported' | 'sold' | 'unaware' | 'rider' | 'abandon' | 'clear';

export const VERDICT_NAMES: Record<Verdict, string> = {
  unseen: '알 수 있었는데 보지 않은 죄',
  ignored: '경고를 무시한 죄',
  exported: '남에게 떠넘긴 죄',
  sold: '미래를 판 죄',
  unaware: '모른 척한 죄',
  rider: '남의 기술에 얹혀 간 죄',
  abandon: '손 놓고 지켜본 죄',
  clear: '미래를 먼저 본 나라',
};

export function court(state: GameState): { verdicts: Verdict[]; mercy: boolean }[] {
  const cfg = state.cfg;
  const fin = worldStats(state, true).map(statSum);
  const moneyRank = state.countries.map((c) => state.countries.filter((o) => o.money > c.money).length);
  const statRank = fin.map((v) => fin.filter((o) => o > v).length);
  return state.countries.map((c) => {
    const own = state.harms.filter((h) => h.from === c.id && h.to === c.id).reduce((s, h) => s + statSum(h.amount), 0);
    const exported = state.harms.filter((h) => h.from === c.id && h.to !== c.id).reduce((s, h) => s + statSum(h.amount), 0);
    const verdicts: Verdict[] = [];
    if (c.investigations <= 1 && own >= cfg.court.unseenHarm) verdicts.push('unseen');
    if (c.ignoredWarnings > 0) verdicts.push('ignored');
    if (exported >= cfg.court.exportedHarm) verdicts.push('exported');
    if (moneyRank[c.id] <= 1 && statRank[c.id] >= state.countries.length - 2) verdicts.push('sold');
    if (moneyRank[c.id] <= 2 && c.approSpent === 0) verdicts.push('unaware');
    if (c.devSpent < cfg.court.riderSpend && c.approSpent === 0) verdicts.push('rider');
    // 손 놓고 지켜본 죄: 어느 영역 압력이 마지막에 70 이상인데 그 영역 투자와 적정기술 투자가 모두 0인 나라.
    if (cfg.crisis?.enabled) {
      const hasAbandoned = cfg.domains.some((dom) => {
        const p = c.pressure[dom.id] ?? 0;
        const heldL = c.held[dom.id]?.level ?? 0;
        return p >= 70 && heldL === 0 && c.approSpent === 0;
      });
      if (hasAbandoned) verdicts.push('abandon');
    }
    const mercy = c.investigations >= cfg.court.mercyInvestigations || c.approSpent > 0 || c.repairs > 0;
    if (!verdicts.length) verdicts.push('clear');
    return { verdicts, mercy };
  });
}

export function exportState(state: GameState): string {
  const { cfg: _cfg, ...rest } = state;
  return JSON.stringify(rest);
}

export function importState(cfg: Config, json: string): GameState {
  const parsed = JSON.parse(json) as Omit<GameState, 'cfg'>;
  const isCrisis = cfg.crisis?.enabled ?? false;
  const countries = parsed.countries.map((c) => ({
    ...c,
    pressure: c.pressure ?? (isCrisis ? { ...cfg.crisis.start } : { bio: 0, agri: 0, ai: 0 }),
    support: c.support ?? (cfg.support?.enabled ? cfg.support.start : 60),
    lostToCrisis: c.lostToCrisis ?? 0,
    lastCrisisDamage: c.lastCrisisDamage ?? {},
    lastSupportReasons: c.lastSupportReasons ?? [],
    regimeChangeHappened: c.regimeChangeHappened ?? false,
    demandedDomain: c.demandedDomain ?? null,
    protested: c.protested ?? false,
    eventChoices: c.eventChoices ?? [],
  }));
  return {
    ...parsed,
    countries,
    cfg,
    activeTreaties: parsed.activeTreaties ?? [],
    currentEvent: parsed.currentEvent ?? null,
    currentTreaty: parsed.currentTreaty ?? null,
    treatyVotes: parsed.treatyVotes ?? {},
    treatyHistory: parsed.treatyHistory ?? [],
  };
}
