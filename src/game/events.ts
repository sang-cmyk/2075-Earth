import type { DomainId, Stats } from './config.ts';
import type { Country } from './engine.ts';

export type EventKind = 'accident' | 'discovery' | 'disaster';

export interface EventChoice {
  id: string;
  label: string;
  desc: string;
  effect: {
    support?: number;
    money?: number;
    stats?: Partial<Stats>;
  };
}

export interface GameEvent {
  id: string;
  title: string;
  desc: string;
  domain: DomainId | 'common';
  kind: EventKind;
  effectDesc: string;
  choices: [EventChoice, EventChoice];
}

export interface TreatyAgenda {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  prohibitedLevels?: Partial<Record<DomainId, number>>;
  aiCostMultiplier?: number;
  spillReduction?: number;
  approBonus?: number;
  globalStatsBonus?: Partial<Stats>;
  globalSupportBonus?: number;
}

export const GAME_EVENTS: GameEvent[] = [
  {
    id: 'lab_leak',
    title: '국책 연구소 생체 변형체 유출 의혹',
    desc: '국책 생명공학 연구소 주변 생태계에서 변형 유전 균주가 검출되어 인근 주민과 언론이 긴급 조사를 요구하고 있습니다.',
    domain: 'bio',
    kind: 'accident',
    effectDesc: '생명공학 보유 단계가 높을수록 의혹이 커집니다. 위험 조사를 한 국가는 빠른 원인 파악으로 피해를 줄입니다.',
    choices: [
      {
        id: 'quarantine',
        label: '투명 공개 및 전면 방역',
        desc: '즉시 정보를 공개하고 30원의 방역 예산을 투입합니다.',
        effect: { support: 8, money: -30, stats: { health: 5, ecology: -5 } },
      },
      {
        id: 'coverup',
        label: '내부 비밀 수습 및 연구 지속',
        desc: '예산을 쓰지 않고 조용히 봉합을 시도합니다.',
        effect: { support: -12, money: 0, stats: { health: -12, society: -8 } },
      },
    ],
  },
  {
    id: 'ai_runaway',
    title: '기간 물류 AI 알고리즘 오작동',
    desc: '전국 식량과 의료 물류 배분을 통제하던 중앙 AI가 데이터 편향 오류를 일으켜 공급망에 병목이 발생했습니다.',
    domain: 'ai',
    kind: 'accident',
    effectDesc: 'AI 개발 단계가 높을수록 사회적 혼선이 큽니다. 적정 기술 투자가 있으면 수동 분배망으로 피해를 막습니다.',
    choices: [
      {
        id: 'manual_override',
        label: '수동 안전망 전환 및 인력 보강',
        desc: 'AI 비중을 일시 축소하고 청년 인력을 긴급 채용합니다.',
        effect: { support: 6, money: -25, stats: { society: 6 } },
      },
      {
        id: 'online_patch',
        label: '온라인 실시간 재부팅 강행',
        desc: '추가 예산 없이 알고리즘 자율 패치를 실행합니다.',
        effect: { support: -10, money: 0, stats: { society: -14 } },
      },
    ],
  },
  {
    id: 'serendipity_cure',
    title: '우연한 광범위 치료 인자 발견',
    desc: '기초 바이오 연구 과정에서 변종 호흡기 질환을 획기적으로 억제하는 친환경 천연 단백질이 우연히 분리되었습니다.',
    domain: 'bio',
    kind: 'discovery',
    effectDesc: '이 발견을 어떻게 다룰지에 따라 국민 지지도와 국제적 신뢰가 크게 요동칩니다.',
    choices: [
      {
        id: 'free_commons',
        label: '글로벌 공공재로 전면 무상 공개',
        desc: '인류 공영을 위해 특허를 포기하고 전 세계에 나눕니다.',
        effect: { support: 16, money: 0, stats: { health: 10, society: 6 } },
      },
      {
        id: 'monopoly_profit',
        label: '국가 특허 등록 및 상업 판매',
        desc: '치료제를 독점 생산하여 막대한 국고 수익을 창출합니다.',
        effect: { support: -8, money: 45, stats: { health: 4, society: -6 } },
      },
    ],
  },
  {
    id: 'extreme_drought',
    title: '백년 만의 극한 가뭄과 수자원 고갈',
    desc: '수개월간 이어진 가뭄으로 저수지가 바닥을 드러내고 주요 곡창지대의 농업용수가 절대적으로 부족합니다.',
    domain: 'agri',
    kind: 'disaster',
    effectDesc: '적정 기술(물 정수·보관)에 투자해 둔 나라는 안정적으로 버텨냅니다.',
    choices: [
      {
        id: 'emergency_ration',
        label: '수자원 비상 배급 및 긴급 급수 지원',
        desc: '예산을 긴급 투입하여 취약 계층과 농가에 물을 배급합니다.',
        effect: { support: 10, money: -25, stats: { ecology: -6, society: 6 } },
      },
      {
        id: 'market_price',
        label: '물 가격 시장 자율화',
        desc: '예산 지출을 아끼고 절수를 유도하기 위해 가격 인상을 허용합니다.',
        effect: { support: -16, money: 0, stats: { ecology: -10, society: -15 } },
      },
    ],
  },
  {
    id: 'pandemic_alert',
    title: '신종 인수공통 감염병 발생 경보',
    desc: '국경 지대 야생 동물 밀렵지 인근에서 기존 치료제가 듣지 않는 변종 바이러스 환자가 다수 확인되었습니다.',
    domain: 'bio',
    kind: 'disaster',
    effectDesc: '선제적 예방에 나설 것인지, 경제 타격을 우려해 관망할 것인지 결정해야 합니다.',
    choices: [
      {
        id: 'preemptive_lock',
        label: '선제적 역학 조사 및 집중 방역망 가동',
        desc: '방역 예산을 투입해 국경 차단과 조기 치료에 나섭니다.',
        effect: { support: 8, money: -20, stats: { health: 8 } },
      },
      {
        id: 'economic_first',
        label: '경제 활동 유지 및 단계적 관망',
        desc: '자금을 아끼기 위해 조치 수위를 최소화합니다.',
        effect: { support: -14, money: 0, stats: { health: -18, society: -6 } },
      },
    ],
  },
  {
    id: 'cyber_attack',
    title: '국가 핵심 인프라 사이버 테러',
    desc: '미확인 조직이 전력망과 금융 결제망을 공격해 일부 지역에서 정전과 통신 마비가 이어졌습니다.',
    domain: 'ai',
    kind: 'accident',
    effectDesc: '복구 경험과 사회 안정성에 따라 복구 속도가 달라집니다.',
    choices: [
      {
        id: 'system_rebuild',
        label: '전면 보안 개편 및 백업 복원',
        desc: '비용을 들여 시스템 근본 취약점을 수리합니다.',
        effect: { support: 8, money: -28, stats: { society: 8 } },
      },
      {
        id: 'quick_bypass',
        label: '임시 우회망 연결 및 타협',
        desc: '비용을 아끼고 임시방편으로 망을 재개합니다.',
        effect: { support: -10, money: -10, stats: { society: -14 } },
      },
    ],
  },
  {
    id: 'eco_restoration',
    title: '토양 미생물 생태 복원 성공',
    desc: '농업 생태 연구팀이 황폐해진 오염 토양을 친환경적으로 재생시키는 복합 미생물 균주 배양에 성공했습니다.',
    domain: 'agri',
    kind: 'discovery',
    effectDesc: '환경 개선 성과를 이웃 나라와 나눌지, 국토 내부에만 집중할지 선택합니다.',
    choices: [
      {
        id: 'share_with_neighbors',
        label: '이웃 국가와 기술 공유 및 국경 협력',
        desc: '주변국 오염 정화에 기술을 보급해 상생합니다.',
        effect: { support: 14, money: -15, stats: { ecology: 14, society: 6 } },
      },
      {
        id: 'domestic_only',
        label: '자국 농경지 우선 집중 상용화',
        desc: '자국 영토 내에만 기술을 적용하고 비용을 아낍니다.',
        effect: { support: 4, money: 20, stats: { ecology: 8 } },
      },
    ],
  },
  {
    id: 'smart_grid_algo',
    title: '초효율 자원 분배 알고리즘 완성',
    desc: '공공 빅데이터를 분석해 잉여 식량과 에너지를 실시간으로 필요한 곳에 연결해 주는 알고리즘이 개발되었습니다.',
    domain: 'ai',
    kind: 'discovery',
    effectDesc: '사회적 불평등을 줄이는 데 쓸 것인지 국고를 채우는 데 쓸 것인지 결정합니다.',
    choices: [
      {
        id: 'social_safety',
        label: '취약 계층 사회 안전망 전액 배정',
        desc: '빈곤층과 노약자의 생활 안정에 알고리즘을 적용합니다.',
        effect: { support: 15, money: 0, stats: { society: 14 } },
      },
      {
        id: 'industry_fund',
        label: '국가 산업 펀드 전환 및 국고 편입',
        desc: '산업 생산성 향상에 투입해 재정을 확보합니다.',
        effect: { support: 5, money: 35, stats: { society: 4 } },
      },
    ],
  },
  {
    id: 'brain_drain',
    title: '해외 거대 자본의 기술 인재 스카우트',
    desc: '자금력이 막강한 외국 기업들이 우리 나라의 유능한 과학자와 엔지니어들을 공격적으로 영입하려 합니다.',
    domain: 'common',
    kind: 'accident',
    effectDesc: '연구 환경 개선에 투자할지, 강제적인 규제로 묶어둘지 선택해야 합니다.',
    choices: [
      {
        id: 'fund_researchers',
        label: '연구원 처우 개선 및 연구비 증액',
        desc: '예산을 투입해 젊은 연구자들이 머물 수 있는 환경을 만듭니다.',
        effect: { support: 10, money: -25, stats: { society: 6 } },
      },
      {
        id: 'restrict_leaving',
        label: '해외 취업 규제 및 의무 복무 강화',
        desc: '예산 없이 법적 강제로 이탈을 막습니다.',
        effect: { support: -15, money: 0, stats: { society: -12 } },
      },
    ],
  },
  {
    id: 'microplastic_storm',
    title: '식수원 나노 입자 오염 경보',
    desc: '미세 플라스틱 및 나노 폐기물이 지하수와 수돗물에서 검출되어 건강 불안이 전국적으로 번지고 있습니다.',
    domain: 'agri',
    kind: 'accident',
    effectDesc: '정수 기술과 사전 조사가 되어 있는 국가는 주민 불안을 빠르게 해소합니다.',
    choices: [
      {
        id: 'clean_water_kits',
        label: '전국 정수 필터 및 진단 키트 긴급 공급',
        desc: '재정을 즉각 투입하여 안전한 물을 확보합니다.',
        effect: { support: 10, money: -28, stats: { health: 8, ecology: 4 } },
      },
      {
        id: 'individual_filter',
        label: '개별 구매 권고 및 지침 공표',
        desc: '예산 지원 없이 가정별 자율 대응을 안내합니다.',
        effect: { support: -14, money: 0, stats: { health: -14, society: -8 } },
      },
    ],
  },
  {
    id: 'climate_refugees',
    title: '기후 해수면 상승 이재민의 피난 요청',
    desc: '해수면 상승으로 국토가 침수된 이웃 저지대 주민 수천 명이 우리 나라에 긴급 수용을 간청하고 있습니다.',
    domain: 'common',
    kind: 'disaster',
    effectDesc: '인도주의적 연대와 자국 재정 부담 사이에서 도덕적 선택을 내립니다.',
    choices: [
      {
        id: 'accept_refugees',
        label: '인도주의적 수용 및 임시 정착 지원',
        desc: '공동체의 온정을 나누고 국제 사회의 존경을 받습니다.',
        effect: { support: 12, money: -22, stats: { society: 8 } },
      },
      {
        id: 'block_refugees',
        label: '국경 통제 및 입국 거부',
        desc: '재정 부담을 피하기 위해 난민 유입을 전면 차단합니다.',
        effect: { support: -16, money: 0, stats: { society: -12 } },
      },
    ],
  },
  {
    id: 'resource_strife',
    title: '핵심 에너지 광물 공급망 단절',
    desc: '주요 자원 보유국 간 분쟁으로 희귀 광물과 청정 에너지 부품 가격이 3배 이상 폭등했습니다.',
    domain: 'common',
    kind: 'disaster',
    effectDesc: '취약 계층의 생활비를 보조할 것인지, 기업과 개인이 알아서 견디게 둘 것인지 결정합니다.',
    choices: [
      {
        id: 'subsidize_energy',
        label: '국가 에너지 바우처 전액 지원',
        desc: '재정을 풀어 서민들의 에너지 고통을 덜어줍니다.',
        effect: { support: 12, money: -30, stats: { society: 8 } },
      },
      {
        id: 'cut_budget',
        label: '비용 소비자 전가 및 재정 비축',
        desc: '정부 재정을 아끼고 시장 충격을 수용합니다.',
        effect: { support: -16, money: 0, stats: { society: -16 } },
      },
    ],
  },
];

export const TREATY_AGENDAS: TreatyAgenda[] = [
  {
    id: 'treaty_gene_editing',
    title: '출산 시 인간 유전자 편집 금지 협약',
    subtitle: '맞춤형 아기와 우생학적 대물림 방지',
    desc: '출산 목적의 인간 배아 유전자 편집과 강제 유전자 변형을 전면 금지합니다. 가결 시 생명공학 4단계 개발이 금지됩니다.',
    prohibitedLevels: { bio: 4 },
    globalStatsBonus: { society: 6 },
    globalSupportBonus: 6,
  },
  {
    id: 'treaty_ai_oversight',
    title: 'AI 중대 판정 인간 승인 의무화 협약',
    subtitle: '의료·사법·군사 알고리즘의 인간 통제권 확립',
    desc: '생명과 인권에 직결된 AI의 자동 판정 시 인간 전문가의 서명 확인을 의무화합니다. AI 3·4단계 개발 비용이 20% 늘어나지만, AI로 인한 사회 혼선 피해가 대폭 줄어듭니다.',
    aiCostMultiplier: 1.2,
    globalStatsBonus: { society: 8 },
    globalSupportBonus: 8,
  },
  {
    id: 'treaty_lmo_safeguard',
    title: 'LMO 농산물 국경 간 위해성 사전 평가 협약',
    subtitle: '주변국 생태계 오염 방지 및 수출입 표시 의무',
    desc: '유전자 변형 작물 수출 시 인접국 생태계에 미치는 영향을 사전에 검증하고 의무적으로 통보합니다. 가결 시 모든 농업 피해의 국경 전파(spill)가 30% 감소합니다.',
    spillReduction: 0.3,
    globalStatsBonus: { ecology: 8 },
    globalSupportBonus: 6,
  },
  {
    id: 'treaty_defense_cap',
    title: '글로벌 군비 상한 및 평화 유지 협약',
    subtitle: '파괴적 군사 경쟁 억제와 신뢰 구축',
    desc: '국가 간 불신과 군비 경쟁을 멈추고 복지와 생태 보전에 재정을 집중합니다. 전 국가의 사회적 불신이 완화되고 사회 지표가 향상됩니다.',
    globalStatsBonus: { society: 10, health: 5 },
    globalSupportBonus: 10,
  },
  {
    id: 'treaty_patent_commons',
    title: '필수 보건·적정 기술 특허 개방 협약',
    subtitle: '생명 보호를 위한 독점 제한과 기술 나눔',
    desc: '치명적 질병과 물·식량 재난에 대응하는 핵심 기초 기술은 특허를 독점하지 않고 전 세계에 나눕니다. 가결 시 적정 기술 효과가 30% 증가합니다.',
    approBonus: 1.3,
    globalStatsBonus: { health: 6, ecology: 6 },
    globalSupportBonus: 8,
  },
];

// Seed 기반으로 특정 라운드에 발생할 돌발 사건 선택 (라운드당 최대 1개)
export function pickRoundEvent(
  seed: number,
  round: number,
  chance: number,
  usedEventIds: string[] = []
): GameEvent | null {
  const s = Math.abs(Math.sin(seed * 7919 + round * 1013)) * 10000;
  const roll = s - Math.floor(s);
  if (roll > chance) return null;

  const pool = GAME_EVENTS.filter((e) => !usedEventIds.includes(e.id));
  const available = pool.length > 0 ? pool : GAME_EVENTS;
  const idx = Math.floor(((s * 97) % 1) * available.length);
  return available[idx] || available[0];
}

// 국가별 사건 영향 계산 (개발 수준에 따른 사고 가중 및 조사·적정기술·복구 완화)
export function calculateEventImpact(
  event: GameEvent,
  country: Country,
  choiceId: string
): {
  supportDelta: number;
  moneyDelta: number;
  statsDelta: Stats;
  mitigationDesc: string;
} {
  const choice = event.choices.find((c) => c.id === choiceId) || event.choices[0];
  let supportDelta = choice.effect.support || 0;
  let moneyDelta = choice.effect.money || 0;
  const statsDelta: Stats = {
    health: choice.effect.stats?.health || 0,
    ecology: choice.effect.stats?.ecology || 0,
    society: choice.effect.stats?.society || 0,
  };

  let mitigationDesc = '';

  if (event.kind === 'accident' && event.domain !== 'common') {
    const heldLvl = country.held[event.domain]?.level || 0;
    const mitigationPoints = country.investigations * 0.15 + (country.approSpent > 0 ? 0.2 : 0) + country.repairs * 0.1;
    const clampedMitigation = Math.min(0.6, mitigationPoints);

    if (heldLvl >= 3) {
      if (statsDelta.society < 0) statsDelta.society -= 2;
      if (statsDelta.health < 0) statsDelta.health -= 2;
    }

    if (clampedMitigation > 0) {
      if (statsDelta.health < 0) statsDelta.health = Math.round(statsDelta.health * (1 - clampedMitigation));
      if (statsDelta.ecology < 0) statsDelta.ecology = Math.round(statsDelta.ecology * (1 - clampedMitigation));
      if (statsDelta.society < 0) statsDelta.society = Math.round(statsDelta.society * (1 - clampedMitigation));
      mitigationDesc = `사전 위험 조사와 윤리적 노력으로 피해 ${Math.round(clampedMitigation * 100)}% 경감`;
    }
  }

  if (country.money + moneyDelta < 0) {
    moneyDelta = -Math.round(country.money);
  }

  return { supportDelta, moneyDelta, statsDelta, mitigationDesc };
}

// 특정 라운드에 상정할 협약 안건 가져오기
export function getTreatyForRound(
  round: number,
  usedTreatyIds: string[],
  seed: number
): TreatyAgenda | null {
  const unused = TREATY_AGENDAS.filter((t) => !usedTreatyIds.includes(t.id));
  if (unused.length === 0) return null;
  const idx = Math.abs(Math.floor((seed + round * 31) % unused.length));
  return unused[idx];
}

// 활성화된 협약에 의해 특정 선택이 금지되었는지 확인
export function isChoiceViolatingTreaties(
  activeTreatyIds: string[] = [],
  domain: DomainId,
  level: number
): { violated: boolean; reason?: string } {
  for (const tId of activeTreatyIds) {
    const treaty = TREATY_AGENDAS.find((t) => t.id === tId);
    if (!treaty) continue;
    if (treaty.prohibitedLevels && treaty.prohibitedLevels[domain] !== undefined) {
      if (level >= treaty.prohibitedLevels[domain]!) {
        return {
          violated: true,
          reason: `국제 협약 '${treaty.title}'에 따라 ${domain.toUpperCase()} ${treaty.prohibitedLevels[domain]}단계 이상은 금지되었습니다.`,
        };
      }
    }
  }
  return { violated: false };
}
