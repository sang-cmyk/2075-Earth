export type Axis = 'health' | 'ecology' | 'society';
export type DomainId = 'bio' | 'agri' | 'ai';
export type Stats = Record<Axis, number>;

export interface Step {
  name: string;
  desc: string;
}

export interface HarmEvent {
  id: string;
  title: string;
  desc: string;
  basis: string;
  verified: boolean;
  kind: 'real' | 'assumed';
  sources: string[];
  note?: string;
  harm: Partial<Stats>;
  lock?: number;
}

export interface Domain {
  id: DomainId;
  label: string;
  icon: string;
  steps: Step[];
  cost: number[];
  success: number[];
  events: (HarmEvent | null)[];
  spill: number[];
  pool: number;
  importFee: number;
}

export interface Config {
  rounds: number;
  countries: number;
  startMoney: number;
  startStats: Stats;
  harmDelay: number;
  harmScale: number;
  investigateCost: number;
  repairCostMult: number;
  failRefund: number;
  techStepLimit: number;
  royaltyPerGap: number;
  upkeepPerLevel: number;
  royaltyReceiveCap: number;
  debtInterest: number;
  bankruptcyDebt: number;
  bankruptcyStatLoss: number;
  bankruptcySupportLoss: number;
  repairRestore: number;
  timeBonusPerRound: number;
  diseaseSurgeRound: number;
  diseaseFeeMult: number;
  appropriate: {
    label: string;
    steps: Step[];
    cost: number[];
    success: number[];
    pool: number;
    selfShield: number;
    worldShield: number;
    maxShield: number;
  };
  domains: Domain[];
  combos: {
    id: string;
    needs: Partial<Record<DomainId, number>>;
    event: HarmEvent;
  }[];
  ending: {
    collapseLine: number;
    shakyLine: number;
    wealthTop2Share: number;
    approTotalGood: number;
    gapGood: number;
  };
  court: {
    exportedHarm: number;
    unseenHarm: number;
    riderSpend: number;
    mercyInvestigations: number;
  };
  crisis: {
    enabled: boolean;
    threshold: number;
    start: Record<DomainId, number>;
    growth: Record<DomainId, number>;
    surgeBonus: number;
    damageRate: Record<DomainId, Partial<Stats>>;
    resolveReduction: number[];
    heldGrowthDamp: number[];
    approGrowthDampMax: number;
  };
  support: {
    enabled: boolean;
    start: number;
    protestThreshold: number;
    protestPenalty: number;
    demandThreshold: number;
    regimeChangeThreshold: number;
    regimeChangePenalty: number;
    neglectPenalty: number;
    successBonus: number;
    investigateBonus: number;
    repairBonus: number;
    harmPenaltyMultiplier: number;
    harmPenaltyCap: number;
    highRiskBonus: number;
    highThreshold: number;
    highBonusRate: number;
    protestSocietyLoss: number;
  };
  events: {
    enabled: boolean;
    chance: number;
    maxPerRound: number;
  };
  treaties: {
    enabled: boolean;
    rounds: number[];
    passThreshold: number;
  };
  reflections: {
    enabled: boolean;
  };
}

export const CONFIG: Config = {
  rounds: 5,
  countries: 6,
  startMoney: 200,
  startStats: { health: 100, ecology: 100, society: 100 },
  harmDelay: 1, // 2 -> 1: 선택한 다음 라운드에 바로 피해 도착
  harmScale: 1.0, // 사건 표 피해 그대로 (원래 0.65)
  investigateCost: 30,
  repairCostMult: 2,
  techStepLimit: 2, // 기술 트리: 가진 단계보다 최대 2단계까지만 한 번에 개발
  royaltyPerGap: 0.35, // 로열티 = 사용료 x 0.35 x 단계 차이
  royaltyReceiveCap: 90, // 한 나라가 한 라운드에 받을 수 있는 로열티 상한
  upkeepPerLevel: 2, // 기술 유지비 = 보유 단계 합계 x 2 (매 라운드)
  debtInterest: 0.1,
  bankruptcyDebt: 40, // 빚이 이만큼 쌓이면 재정 파탄
  bankruptcyStatLoss: 8,
  bankruptcySupportLoss: 20,
  failRefund: 0.5, // 개발 실패 시 비용 50% 환급
  repairRestore: 0.7,
  timeBonusPerRound: 0.15,
  diseaseSurgeRound: 4,
  diseaseFeeMult: 2,
  appropriate: {
    label: '적정 기술',
    steps: [
      { name: '투자 안 함', desc: '' },
      { name: '값싼 정수·보관 기술', desc: '깨끗한 물과 식량 보관을 돕는 작고 싼 기술' },
      { name: '간이 진단 키트·소형 발전', desc: '병원이 먼 곳에서도 쓸 수 있는 진단·전기 기술' },
      { name: '기술 공유 센터', desc: '다른 나라 사람들이 직접 고쳐 쓸 수 있게 기술을 나눈다' },
    ],
    cost: [0, 6, 10, 14],
    success: [1, 0.95, 0.9, 0.9],
    pool: 10,
    selfShield: 0.05,
    worldShield: 0.012,
    maxShield: 0.6,
  },
  domains: [
    {
      id: 'bio',
      label: '생명 공학',
      icon: '🧬',
      steps: [
        { name: '개발 안 함', desc: '' },
        { name: '주요 질병 치료', desc: '암·심장병·뇌졸중·당뇨·치매 치료법을 연구한다' },
        { name: '희귀 유전병·발병 전 예방 교정', desc: '아직 병이 나타나지 않은 사람의 유전자도 고친다' },
        { name: '출산 시 유전자 편집 (질병 제거)', desc: '태어나기 전에 심각한 유전병 유전자를 없앤다' },
        { name: '출산 시 키·외모·지능 옵션', desc: '부모가 아이의 키·외모·능력을 고를 수 있다' },
      ],
      cost: [0, 16, 30, 46, 64],
      success: [1, 0.95, 0.85, 0.7, 0.55],
      events: [
        null,
        {
          id: 'b1',
          title: '비싼 치료제, 갈라진 환자들',
          desc: '새 치료제가 너무 비싸서 돈 있는 나라 환자만 치료받는다.',
          basis: '1회 투여에 수십억 원인 유전자 치료제가 이미 있다. 헴제닉스(혈우병 B) 약 350만 달러, 졸겐스마(척수성 근위축증) 출시가 약 210만 달러.',
          verified: true,
          kind: 'real',
          sources: ['https://cardiovascularbusiness.com/topics/healthcare-management/healthcare-economics/fda-approves-worlds-most-expensive-drug', 'https://www.pharmamanufacturing.com/development/drug-approvals/article/33006956/most-expensive-drugs'],
          note: '가격은 출처마다 조금 다르다. 2022~2023년 기준.',
          harm: { society: 3 },
        },
        {
          id: 'b2',
          title: '예상 못 한 부작용',
          desc: '유전자 가위가 엉뚱한 곳까지 잘라 몸에 예상 못 한 변화가 생긴다.',
          basis: '2018년 유전자 편집 아기 사건에서 편집이 세포마다 다르게 일어난 모자이시즘이 확인되었고, 의도하지 않은 곳이 편집될 위험이 지적되었다.',
          verified: false,
          kind: 'assumed',
          sources: ['https://www.technologyreview.com/2019/12/03/65024/crispr-baby-twins-lulu-and-nana-what-happened/amp/', 'https://communities.springernature.com/posts/the-blind-babymaker'],
          note: '모자이시즘은 논문 원고를 분석한 기사로 확인. 표적 외 변이는 위험 지적 수준이며 실제 발생은 확인되지 않음. CCR5 변이와 사망률을 연결한 2019년 Nature Medicine 논문은 같은 해 10월 철회되었으니 수업에서 쓰지 말 것.',
          harm: { health: 7, society: 2 },
        },
        {
          id: 'b3',
          title: '다음 세대로 이어진 변화',
          desc: '편집한 유전자가 아이의 아이에게까지 이어지고, 되돌릴 수 없다.',
          basis: '2018년 유전자 편집 아기 사건. 2019년 중국 법원이 허젠쿠이에게 징역 3년을 선고했고 국제 사회가 강하게 비판했다.',
          verified: true,
          kind: 'real',
          sources: ['https://www.npr.org/2019/12/30/792340177/chinese-researcher-who-created-gene-edited-babies-sentenced-to-3-years-in-prison'],
          note: '생식 세포 편집은 다음 세대로 유전된다는 설명은 일반 상식 수준. 쌍둥이의 현재 건강 상태는 공개된 바 없음.',
          harm: { health: 11, society: 4 },
        },
        {
          id: 'b4',
          title: '유전자 격차',
          desc: '돈이 있어야 능력 있는 아이를 낳을 수 있게 되고, 차이가 대를 이어 굳는다.',
          basis: '실제로 배아의 유전자 점수를 보고 고르는 서비스가 있고, 일부 업체는 키·지능 예측까지 내놓는다. 접근 격차와 우생학 우려가 제기된다. (학습지 「최애를 낳아 드립니다」는 지어낸 이야기)',
          verified: false,
          kind: 'assumed',
          sources: ['https://www.statnews.com/2021/07/01/researchers-raise-concerns-genetic-risk-scores-pick-healthier-embryos/', 'https://www.biorxiv.org/content/10.1101/626846.full.pdf'],
          note: '2019년 연구는 지금 기술로 키 약 2.5cm, 지능 약 2.5점 정도의 차이밖에 못 낸다고 추정했다. 키·외모·지능을 마음대로 설계하는 단계는 현실이 아니라 경고.',
          harm: { society: 14, health: 8 },
        },
      ],
      spill: [0, 0.1, 0.2, 0.25, 0.3],
      pool: 90,
      importFee: 16,
    },
    {
      id: 'agri',
      label: '유전자 변형(LMO) 농업',
      icon: '🌾',
      steps: [
        { name: '개발 안 함', desc: '' },
        { name: '사료용 작물 격리 시험', desc: '사람이 안 먹는 사료용 작물을 울타리 안에서만 시험한다' },
        { name: '주식 작물 (허가 지역·표시제)', desc: '벼·밀 같은 주식에 병충해 저항성을 넣고, 허가된 곳에서만 키운다' },
        { name: '주식 작물 전면 개방 (제초제·독소)', desc: '제초제에 견디고 해충 독소를 만드는 작물을 어디서나 키운다' },
        { name: '모든 작물 빨리 자람 전면 개방', desc: '모든 작물을 빨리 자라는 LMO로 바꾼다' },
      ],
      cost: [0, 12, 24, 38, 52],
      success: [1, 0.95, 0.85, 0.7, 0.55],
      events: [
        null,
        {
          id: 'a1',
          title: '시험장 밖의 씨앗',
          desc: '격리 시험 작물의 씨앗이 조금 새어 나갔다.',
          basis: '승인되지 않은 LMO가 유통·수입 과정에서 새어 나간 사례가 여러 번 있다. 2000년 미국 스타링크 옥수수 리콜(300개 넘는 식품), 일본 항구·도로변에 자생하는 수입 LMO 유채.',
          verified: true,
          kind: 'real',
          sources: ['https://en.wikipedia.org/wiki/StarLink_corn_recall', 'https://japanfs.org/en/news/archives/news_id025870.html'],
          note: '일본 사례는 2004년 이후 보고. 환경 영향이 작다는 정부 쪽 입장과 오염이라는 시민단체 입장이 갈린다.',
          harm: { ecology: 1 },
        },
        {
          id: 'a2',
          title: '약이 안 듣는 벌레',
          desc: '독소와 저항성에 적응한 해충이 나타났다.',
          basis: '살충 독소 Bt 작물에 저항성을 가진 해충이 현장에서 나타났다. 2009년 미국 아이오와의 옥수수뿌리벌레, 인도의 목화 붉은솜벌레.',
          verified: true,
          kind: 'real',
          sources: ['https://pmc.ncbi.nlm.nih.gov/articles/PMC7915852', 'https://www.seedworld.com/us/2025/10/15/field-data-show-rootworm-resistance-erodes-bt-rnai-protection/'],
          note: '일부 옥수수뿌리벌레 집단은 상용 Bt 형질 전부에 저항성을 보인다.',
          harm: { ecology: 6 },
        },
        {
          id: 'a3',
          title: '슈퍼 잡초와 넘어간 꽃가루',
          desc: '제초제가 안 듣는 잡초가 퍼지고, 꽃가루가 국경을 넘어 이웃 나라 들판까지 간다.',
          basis: '제초제 글리포세이트에 듣지 않는 슈퍼 잡초(아마란스)가 2011년까지 미국 10개 주에서 확인되었다. 제초제 내성 유채는 미국 노스다코타 도로변에서 스스로 번식하고(야생화한 유채의 80%가 제초제 내성 유전자 보유) 캐나다에서는 야생 친척과 교잡한 사례가 보고되었다. 2017년 태백 미승인 LMO 유채는 56곳에서 발견되었고 폐기 뒤에도 재발견되었다.',
          verified: true,
          kind: 'real',
          sources: ['https://vtechworks.lib.vt.edu/items/1c0cea12-2c49-4a2d-8c58-92502bb7b433', 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0025736', 'https://www.hankookilbo.com/news/article/201706071525621786', 'https://www.kwnews.co.kr/article/201711231210366'],
          note: '태백은 꽃가루 이동이 아니라 수입 종자 혼입 사건이다. 2017.5.15 태백산 유채꽃 축제장에서 발견, 2016.1월부터 수입된 중국산 종자 10개사 79.6t 중 4개사 32.5t에 혼입 의심, 56개소 81ha 폐기(여러 언론 보도 일치), 품종은 몬산토 GT73(제초제 내성, 식품·사료용 승인·종자용 미승인), 2017.11 조사에서 전국 28곳 재발견(강원일보). 농식품부 보도자료 원문은 접속 제한으로 열람하지 못함. 야생 친척과의 교잡 연구 중 Londo 2011은 소규모 실험이다. 국경을 넘는 이동은 이 게임이 일반화한 설정.',
          harm: { ecology: 13, society: 1 },
        },
        {
          id: 'a4',
          title: '한 가지 품종만 남은 들판',
          desc: '토종 종자가 사라지고, 새 병충해 하나에 들판이 한꺼번에 무너질 위험이 생긴다. 이제 LMO를 안 쓰는 길은 막혔다.',
          basis: '한 품종에 의존하다 큰 피해를 본 역사. 1970년 미국 옥수수의 85~90%가 같은 세포질 계통이어서 잎마름병으로 수확량이 약 15% 줄었다. FAO는 1900년대 이후 작물 유전적 다양성의 약 75%가 사라졌다고 추정한다.',
          verified: true,
          kind: 'real',
          sources: ['https://www.nsta.org/resources/risks-improvement-genetic-uniformity-and-epidemic-student-edition', 'https://sej.org/node/45201', 'https://www.fao.org/4/y5609e/y5609e02.htm'],
          note: '1970년 사례는 LMO가 아니라 일반 육종 품종의 단일화다. 손실률은 출처에 따라 15~25%로 다르다. FAO 75%는 정확히 측정한 값이 아닌 역사적 추정치이고 기간 표현도 출처마다 다르다. LMO를 안 쓰는 길이 막힌다는 부분은 이 게임의 가정.',
          harm: { ecology: 15, health: 3, society: 2 },
          lock: 2,
        },
      ],
      spill: [0, 0.1, 0.25, 0.45, 0.4],
      pool: 70,
      importFee: 12,
    },
    {
      id: 'ai',
      label: '인공지능',
      icon: '🤖',
      steps: [
        { name: '사용 안 함', desc: '' },
        { name: '쇼핑·영상 추천', desc: '좋아할 만한 물건과 영상을 골라 보여 준다' },
        { name: '뉴스·정보 추천 (몰래 실험 포함)', desc: '사람들에게 어떤 글이 더 먹히는지 몰래 비교 실험한다' },
        { name: '교육·채용 판단', desc: '입시·취업 합격 여부를 AI가 먼저 걸러 낸다' },
        { name: '의료·재판 판단 (사람 확인 없이)', desc: '감정·생체 정보까지 모아 AI가 알아서 결정한다' },
      ],
      cost: [0, 14, 28, 42, 58],
      success: [1, 0.95, 0.85, 0.7, 0.55],
      events: [
        null,
        {
          id: 'i1',
          title: '비슷한 것만 보이는 세상',
          desc: '추천만 따라가다 보니 사람들이 같은 생각만 하게 된다.',
          basis: '알고리즘이 정보를 걸러 내 사람들이 자기 취향의 거품에 갇히는 필터 버블. 엘리 파리저(Eli Pariser)가 2011년 책 The Filter Bubble과 TED 강연으로 알렸다.',
          verified: true,
          kind: 'real',
          sources: ['https://policyreview.info/concepts/filter-bubble', 'https://www.ted.com/speakers/eli_pariser'],
          note: '용어가 처음 쓰인 시점은 2010~2011로 자료마다 다르다. 학습지의 엘리 프레이저는 보통 엘리 파리저로 표기. 학습지의 2011년에 처음 사용은 2011년 책으로 널리 알려짐으로 쓰는 편이 안전.',
          harm: { society: 2 },
        },
        {
          id: 'i2',
          title: '몰래 실험이 들통났다',
          desc: '시민의 기분을 몰래 조작한 실험이 폭로되어 신뢰가 무너진다.',
          basis: '2014년 PNAS 논문으로 페이스북이 689,003명의 뉴스 피드를 조작한 감정 실험이 공개되었고, 학술지가 우려 표명(Editorial Expression of Concern)을 냈다.',
          verified: true,
          kind: 'real',
          sources: ['https://www.pnas.org/doi/10.1073/pnas.1320040111', 'https://www.pnas.org/doi/10.1073/pnas.1412469111', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4066473/', 'https://www.nbcnews.com/news/amp/wbna55572104'],
          note: '표본 수와 우려 표명은 확인. 실험 기간(2012년 1월 11~18일)은 2차 자료로만 확인했으니 논문 본문에서 확인 권장. 연구진은 이용 약관이 동의에 해당한다고 주장했고 비판자들은 반박. 새 글을 넣은 것이 아니라 감정 단어가 든 글 일부를 걸러 내는 방식.',
          harm: { society: 6 },
        },
        {
          id: 'i3',
          title: '학습된 편견',
          desc: '특정 집단이 합격에서 계속 떨어지고, 아무도 이유를 설명하지 못한다.',
          basis: '2018년 로이터 보도: 아마존이 2014년부터 개발한 AI 채용 도구가 10년치 이력서(대부분 남성)로 학습해 여성을 불리하게 평가했고 팀은 2017년 초 해체되었다. 2016년 프로퍼블리카: 재범 예측 프로그램 COMPAS는 재범하지 않은 흑인 피고인을 고위험으로 잘못 분류한 비율이 약 45%로 백인 약 23%의 거의 2배.',
          verified: true,
          kind: 'real',
          sources: ['https://www.cnbc.com/2018/10/10/amazon-scraps-a-secret-ai-recruiting-tool-that-showed-bias-against-women.html', 'https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm', 'https://www.propublica.org/article/what-algorithmic-injustice-looks-like-in-real-life'],
          note: '아마존 도구는 실제 채용 평가에는 쓰이지 않았다고 회사가 밝혔다. COMPAS 분석 대상은 플로리다 브로워드 카운티 7천여 명. 제작사 노스포인트는 같은 점수의 재범률은 인종 간 비슷하다(약 63% 대 59%)며 반박했고 공정성 기준을 두고 학계 논쟁이 있다. 수치는 프로퍼블리카의 반올림 값이며 원문은 접속 제한으로 열람하지 못함.',
          harm: { society: 7 },
        },
        {
          id: 'i4',
          title: '유출된 마음과 멈춘 판단력',
          desc: '모아 둔 감정·생체 정보가 대량 유출되고, 사람들은 스스로 판단하지 못하게 된다. 이제 AI를 줄이는 길은 막혔다.',
          basis: '지울 수 없는 생체 정보가 대량 유출된 사례가 있다. 2019년 지문 100만 건 이상과 얼굴 정보가 노출된 바이오스타2, 2023년 약 690만 명의 유전 정보가 털린 23andMe. 자동화된 조언에 지나치게 의존하는 자동화 편향은 의료 판단 지원 연구에서 체계적으로 보고되었다.',
          verified: true,
          kind: 'real',
          sources: ['https://www.technologyreview.com/f/614163/data-leak-exposes-unchangeable-biometric-data-of-over-1-million-people', 'https://www.scworld.com/news/23andme-raw-genetic-data-stolen-in-months-long-cyberattack', 'https://pubmed.ncbi.nlm.nih.gov/21685142/'],
          note: '유출과 자동화 편향은 확인. 유출 규모는 출처마다 다르다. AI를 줄이는 길이 막힌다는 부분은 이 게임의 가정이며 학습지의 자동화 의존 설명에 의존.',
          harm: { society: 8, health: 3 },
          lock: 2,
        },
      ],
      spill: [0, 0.1, 0.15, 0.2, 0.25],
      pool: 100,
      importFee: 16,
    },
  ],
  combos: [
    {
      id: 'c1',
      needs: { bio: 3, ai: 3 },
      event: {
        id: 'c1',
        title: 'AI가 골라 주는 아기 유전자',
        desc: 'AI 판단과 출산 편집이 만나, 아이의 유전자를 AI가 추천해 고르는 일이 벌어진다.',
        basis: '배아의 유전자 점수를 보고 고르는 서비스가 이미 있고, 이런 선별에 AI 판단이 결합될 때의 윤리 문제가 경고된다.',
        verified: false,
        kind: 'assumed',
        sources: ['https://www.statnews.com/2021/07/01/researchers-raise-concerns-genetic-risk-scores-pick-healthier-embryos/'],
        note: 'AI가 아기 유전자를 추천하는 사건 자체는 아직 일어나지 않은 경고 시나리오.',
        harm: { society: 6, health: 6 },
      },
    },
    {
      id: 'c2',
      needs: { agri: 3, ai: 1 },
      event: {
        id: 'c2',
        title: '추천에 맞춰진 식탁',
        desc: 'AI가 값싼 LMO 식품만 추천해 식단과 농업이 한 가지로 쏠린다.',
        basis: '추천 알고리즘이 소비를 한쪽으로 몰아가는 현상(필터 버블).',
        verified: false,
        kind: 'assumed',
        sources: [],
        note: '직접 근거를 찾지 못한 가정이다. 수업에서는 경고 시나리오로 다루거나 삭제를 고려.',
        harm: { ecology: 7, society: 2 },
      },
    },
  ],
  ending: {
    collapseLine: 55,
    shakyLine: 70,
    wealthTop2Share: 0.55,
    approTotalGood: 12,
    gapGood: 0.5,
  },
  court: {
    exportedHarm: 110,
    unseenHarm: 60,
    riderSpend: 30,
    mercyInvestigations: 2,
  },
  crisis: {
    enabled: true,
    threshold: 40,
    start: { bio: 24, agri: 24, ai: 24 },
    growth: { bio: 15, agri: 14, ai: 14 },
    surgeBonus: 10,
    damageRate: {
      bio: { health: 0.45 },
      agri: { ecology: 0.3, society: 0.19 },
      ai: { society: 0.45 },
    },
    resolveReduction: [0, 14, 26, 34, 42], // 낮은 단계가 가성비 좋고, 높은 단계는 비싸고 위험
    heldGrowthDamp: [0, 0.15, 0.25, 0.4, 0.55],
    approGrowthDampMax: 0.35,
  },
  support: {
    enabled: true,
    start: 60,
    protestThreshold: 40,
    protestPenalty: 0.1,
    demandThreshold: 30,
    regimeChangeThreshold: 15,
    regimeChangePenalty: 0.1,
    neglectPenalty: 7,
    successBonus: 5,
    investigateBonus: 3,
    repairBonus: 4,
    harmPenaltyMultiplier: 0.6,
    harmPenaltyCap: 22, // 한 라운드에 피해로 깎이는 지지도 상한
    highRiskBonus: 2,
    highThreshold: 70,
    highBonusRate: 0.08,
    protestSocietyLoss: 3,
  },
  events: {
    enabled: true,
    chance: 1.0, // 매 라운드 위기 대응(돌발 사건) 발생
    maxPerRound: 1,
  },
  treaties: {
    enabled: true,
    rounds: [3, 5],
    passThreshold: 4,
  },
  reflections: {
    enabled: true,
  },
};
