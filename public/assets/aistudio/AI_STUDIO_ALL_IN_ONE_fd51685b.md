# 2075 지구 — AI Studio 전체 입력

이 글 전체를 AI Studio에 붙여 넣는다. 위쪽은 만들 앱에 대한 지시이고, 맨 아래는 그대로 만들어야 하는 코드 파일 6개다.

---

중학교 2학년 도덕 수업(1차시, 45분)에서 쓸 실시간 교실 게임 웹앱 「2075 지구」를 만들어 줘. 화면 글자는 전부 한국어, 중학생이 바로 알아듣는 말로 써.

### 0. 이 글 맨 아래에 붙어 있는 코드 파일 (수정 금지)
먼저 이 글 맨 아래 「코드 파일」 부분의 6개 파일을 아래 경로에 내용 그대로 만들어 줘. 한 글자도 바꾸지 마. 그다음 `src/game/`의 `config.ts`(게임 내용·숫자), `engine.ts`(계산), `vote.ts`(다수결 집계), `rules.ts`(규칙 설명 생성), `bots.ts`(테스트 봇), `assets.ts`(이미지 목록)를 그대로 쓰고 고치지 마. 게임 규칙과 숫자는 전부 여기에 있다. 화면에 보이는 규칙 설명은 `rulesText(CONFIG)`로 만들고, 비용·확률·사건 문구는 CONFIG에서 읽어 와. 새 규칙을 화면 코드에 따로 쓰지 마.

### 1. 게임 한 줄 설명
6개 모둠이 6개 나라가 되어 5라운드 동안 생명 공학·유전자 변형 농업·인공지능·적정 기술에 투자한다. 모든 결정은 모둠원 전원의 투표로 하고 표가 가장 많은 쪽이 된다. 혜택은 바로 오고 피해는 2라운드 뒤에 오며, 고를 때는 피해가 보이지 않는다. 끝에는 6개 나라를 합친 2075년 지구 엔딩이 나오고, 이어서 미래 세대 법정이 나라마다 판결한다. 역할(장관 등)은 없다.

### 2. 접근 권한
- 교사 화면은 학교 구글 계정 `202105@jeonnong.ms.kr`로 로그인해야만 열린다. 방 만들기·진행·좌석 해제·기록 삭제는 교사 화면에서만 한다.
- 이 제한을 화면(UI)뿐 아니라 Firestore 보안 규칙에도 건다. state·teams·phase·기록 쓰기는 교사 계정만 가능하고, 학생은 자기 좌석의 입력(inputs)만 쓰고 자기 방과 자기 모둠 문서만 읽는다.
- 학생은 구글 로그인 없이 방 코드로 들어온다. 반(2학년 1~6반) + 모둠(1~6) + 출석번호(1~26)를 고르고, 기기 구분은 익명 인증으로 한다. 이 ID로 좌석을 잠근다. 학생 이름은 저장하지 않는다.

### 3. 데이터 흐름 (가장 중요)
- 교사 화면만 상태(state)를 쓰고 계산한다. 학생은 자기 투표(inputs)만 쓴다.
- 교사 화면이 `createGame`, `beginRound`, `tally`, `endRound`, `earthEnding`, `court`를 호출한다. 상태는 `exportState`로 문자열로 만들어 저장하고 `importState`로 불러온다(설정은 저장하지 않는다).
- 라운드 마감 때 최신 입력을 다시 읽고 계산한다. 예전 상태로 계산하지 마.
- 난수는 교사 화면에서만 `makeRng(시드)`로 만들고, 시드는 방에 저장한다.

### 4. 라운드 흐름 (라운드당 5분)
1. `beginRound`로 이번 라운드에 도착한 피해를 반영하고, 나라별로 보여 준다(어느 나라의 어떤 선택에서 왔는지 화살표, 가능하면 CONFIG 사건 제목·설명·근거).
2. 투표 단계(제한 3분): 학생은 한 화면에서 다음을 모두 정하고 제출한다.
   - 생명 공학 / 유전자 변형 농업 / 인공지능 단계 선택(0~4), 적정 기술 단계(0~3). 잠긴 단계(`locks`)는 고를 수 없게 막는다.
   - 위험 조사를 할지(할 거면 어떤 영역·단계를 조사할지), 도착한 피해를 복구할지.
   - **"이게 잘못되면 최악은?"을 한 줄 적어야 제출 버튼이 열린다.**
   - 선택하면 바로 확정되지 않고, 추천(내 표) → 제출 두 단계로 나눈다.
3. 마감: 교사 화면이 모둠마다 `tally`를 호출한다. `ties`가 있으면 그 항목만 1회 재투표(`revote`)한다. 동률이 계속되면 `tally(..., revote=true)`가 낮은 단계로 정한다. 위험 조사는 과반 찬성일 때만 실행되고, 반대가 많아 못 한 찬성표는 `buried`로 돌아온다. `recordBuried`를 호출해 "묻힌 경고"를 기록한다.
4. 결정된 `Decision`을 `endRound`에 넘긴다. 위험 조사가 실행되면 `investigate(CONFIG, 영역, 단계)` 결과(심각도 낮음/중간/높음, 영향 분야)를 그 모둠에만 흐릿하게 보여 준다.
5. 결과 화면: 투표는 확정 전까지 비공개이고, 확정 뒤에는 득표 수만 공개한다(누가 눌렀는지는 보이지 않게). 나라별 돈과 건강·생태·사회 수치를 나란히 보여 준다.

### 5. 엔딩 (이름 + 그림을 화면 전면에, 이유는 바로 옆에)
1. **지구 엔딩**: `earthEnding(state)`의 결과를 `ENDING_NAMES`의 이름과 `assets.ts`의 `ending_*` 그림으로 크게 공개한다. 이유(어느 수치가 무너졌는지, 어떤 선택이 원인이었는지)를 옆에 한 줄로 보여 준다. 피해 추적 화살표와 게임 뒤에 도착할 피해(미래 세대 몫)도 공개한다.
2. **미래 세대 법정**: `court(state)`의 나라별 `verdicts`와 `mercy`(감형 여부)를 `VERDICT_NAMES`와 `icon_verdict_*` 그림으로 한 나라씩 차례로 판결한다. 증거로 "우리가 적은 최악의 예측 vs 실제로 일어난 일", 위험 조사 횟수, 묻힌 경고 횟수, 적정 기술 투자액을 보여 준다.
3. 사건 장면을 보여 줄 때 `kind`가 `real`이면 "실제로 있었던 일", `assumed`이면 "전문가들이 경고하는 가정"이라고 구분해 표시한다.
4. 마지막은 요나스의 한 줄: "너의 행동의 결과가 인류가 앞으로도 인간답게 살아갈 수 있는 것과 어긋나지 않도록 행동하라."

### 6. 교사 화면 기능
- 수업 기록 보관함: 반별 수업 목록, 새로 시작 / 이어하기 / 삭제(확인 창). 테스트 방은 구분해서 표시.
- 로비: 방 코드를 TV에 크게 표시하고 모둠별 입장 현황을 실시간으로 보여 준다. 방 코드는 4자리 랜덤이며 기존 반 코드와 겹치는지 검사한다(겹치면 새로 만든다).
- 진행 제어: 게임 시작, 다음 단계, 타이머 시작·연장·멈춤, 선택권 풀어주기, 강제 마감.
  - 선택권 풀어주기는 투표 잠금만 풀 뿐, 이미 눌린 추천을 제출로 바꾸지 않는다.
  - 강제 마감은 확인 창을 거친 뒤 즉시 닫는다. 제출된 표만으로 `tally`하고, 결과에 "강제 마감"을 표시한다. 두 버튼은 색과 위치를 떨어뜨린다.
  - 모든 버튼은 눌렸는지 화면 피드백을 준다.
- 모둠 현황 타일(제출 인원/모둠원 수, 접속 상태, 돈·수치), 발표 모드(타일을 누르면 그 모둠을 TV 전체 화면으로).
- 좌석 관리: 좌석 해제(기기 바뀜·잘못 입장), 결석 처리(결석은 투표 인원에서 뺀다).
- 내보내기: CSV와 기록 카드(1920×1080 PNG) ZIP.
- 테스트용 봇 채우기: 빈 자리를 `botBallot(CONFIG, 좌석번호, 라운드)`로 채워 혼자서도 끝까지 돌려 볼 수 있게 한다.

### 7. 학생 화면 기능
- 입장 단계마다 뒤로 가기. 같은 출석번호로 여러 모둠에 들어가지 못하게 막는다. 모둠 정원 표시는 실제 인원 기준.
- 새로고침·탭 닫힘 뒤에도 같은 기기로 자기 자리로 바로 복귀한다.
- 규칙과 엔딩 조건을 언제든 다시 볼 수 있는 버튼(`rulesText(CONFIG)` 사용).
- 연결 상태를 화면에 표시한다. 끊기면 학생도 바로 알 수 있어야 한다.
- 우리 모둠의 투표 현황(몇 명 제출했는지)과 돈, 건강·생태·사회 게이지.

### 8. 데이터 용량·학교망 (반드시)
- 하트비트(주기적 접속 신호) 쓰지 않는다.
- 학생은 자기 방 문서와 자기 모둠 문서만 구독한다. 반 전체 목록은 교사 화면만 구독한다.
- Firestore 초기화에 `experimentalForceLongPolling`을 적용하고, `firestoreDatabaseId` 인자는 그대로 유지한다.
- 라운드마다 자동 백업하고 CSV로 내보낼 수 있게 한다.

### 9. 화면·연출
- 학생 기기는 크롬북 1366×768, 교사 화면은 교실 TV 기준.
- 글보다 보이는 것으로 전달한다: 나라 그림(`country_base_normal`) 위에 영역 상태 그림(`state_영역_good/shaky/bad`)을 겹치고, 돈·건강·생태·사회는 게이지로 보여 준다. 사건은 카드 뒤집기로 공개한다.
- 인트로: 안내 캐릭터 하루(2075년에서 온 아이)가 직접 인사하며 게임을 설명한다(`char_haru_*`, `scene_intro`).
- 이미지는 `assets.ts`의 `assetUrl(이름)` 한 곳에서만 불러온다. 파일이 없으면 이름이 적힌 자리 표시 그림을 보여 주고 게임은 정상 진행한다. 이미지 안에 글자는 없다(글자는 화면에서 코드로 쓴다).
- React 훅은 조건부 return 앞에 모두 선언한다(검은 화면 방지). 화면 전환마다 직접 확인한다.

### 10. 먼저 만들어 줄 것
이미지가 없어도 돌아가는 상태로 1~9번을 모두 구현해 줘. 마지막에 테스트 봇으로 5라운드를 끝까지 돌려 지구 엔딩과 법정까지 나오는지 확인하는 방법을 알려 줘. 코드 파일 안에 설치·사용법 주석은 넣지 마.

---

## 코드 파일 (경로와 내용을 그대로 만들 것)

### FILE: src/game/config.ts

```ts
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
}

export const CONFIG: Config = {
  rounds: 5,
  countries: 6,
  startMoney: 380,
  startStats: { health: 100, ecology: 100, society: 100 },
  harmDelay: 2,
  harmScale: 0.65,
  investigateCost: 30,
  repairCostMult: 2,
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
      cost: [0, 14, 24, 36, 50],
      success: [1, 0.9, 0.75, 0.6, 0.45],
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
      pool: 150,
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
      cost: [0, 10, 20, 30, 40],
      success: [1, 0.95, 0.8, 0.65, 0.5],
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
      pool: 120,
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
      cost: [0, 12, 22, 34, 46],
      success: [1, 0.95, 0.8, 0.65, 0.5],
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
      pool: 180,
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
};
```

### FILE: src/game/engine.ts

```ts
import type { Config, DomainId, Stats, Axis, HarmEvent } from './config.ts';

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
    });
  }
  return { cfg, round: 0, countries, harms: [], log: [] };
}

function shieldMult(state: GameState, c: Country): number {
  const a = state.cfg.appropriate;
  const others = state.countries.reduce((s, x) => s + (x.id === c.id ? 0 : x.shield), 0);
  return 1 - Math.min(a.maxShield, a.selfShield * c.shield + a.worldShield * others);
}

export function beginRound(state: GameState): void {
  state.round += 1;
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
    out.levels[dom.id] = Math.max(lock, Math.min(dom.cost.length - 1, out.levels[dom.id]));
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
  for (const c of state.countries) {
    const self = c.id === from;
    const f = self ? 1 : spill;
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
    const d = sanitize(state, c, decisions[i]);
    final.push(d);
    for (const idx of d.repair) {
      const h = state.harms[idx];
      const cost = repairCost(cfg, h);
      c.money -= cost;
      h.repaired = true;
      c.repairs += 1;
      for (const ax of AXES) c.stats[ax] = Math.min(cfg.startStats[ax], c.stats[ax] + h.applied[ax] * cfg.repairRestore);
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
      if (rng() < dom.success[L]) {
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
      if (rng() < cfg.appropriate.success[a]) c.shield += a;
    }
    for (const cb of cfg.combos) {
      const ok = Object.entries(cb.needs).every(([k, v]) => (succeeded[i][k as DomainId] ?? 0) >= (v as number));
      if (ok) schedule(state, cb.event, 'combo', 0, i, 0.2, 0);
    }
  });

  for (const dom of cfg.domains) {
    const holders = state.countries.filter((c) => c.held[dom.id]);
    if (!holders.length) continue;
    const weight = (c: Country) => {
      const h = c.held[dom.id]!;
      return h.level * h.level * (1 + cfg.timeBonusPerRound * Math.max(0, cfg.rounds - h.firstRound));
    };
    const totalW = holders.reduce((s, c) => s + weight(c), 0);
    const surge = state.round >= cfg.diseaseSurgeRound && dom.id === 'bio' ? cfg.diseaseFeeMult : 1;
    let feePool = 0;
    for (const c of state.countries) {
      if (c.held[dom.id]) continue;
      const fee = Math.min(c.money, dom.importFee * surge);
      c.money -= fee;
      feePool += fee;
    }
    for (const c of holders) c.money += ((dom.pool + feePool) * weight(c)) / totalW;
  }

  state.countries.forEach((c) => c.moneyHistory.push(Math.round(c.money)));
  return final;
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

export type Verdict = 'unseen' | 'ignored' | 'exported' | 'sold' | 'unaware' | 'rider' | 'clear';

export const VERDICT_NAMES: Record<Verdict, string> = {
  unseen: '알 수 있었는데 보지 않은 죄',
  ignored: '경고를 무시한 죄',
  exported: '남에게 떠넘긴 죄',
  sold: '미래를 판 죄',
  unaware: '모른 척한 죄',
  rider: '남의 기술에 얹혀 간 죄',
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
  return { ...(JSON.parse(json) as Omit<GameState, 'cfg'>), cfg };
}
```

### FILE: src/game/vote.ts

```ts
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

function plurality(values: number[], size: number, tieBreak: 'lower' | 'higher'): { value: number; tied: boolean; counts: number[] } {
  const counts = new Array(size).fill(0);
  for (const v of values) counts[v] += 1;
  const top = Math.max(...counts);
  const winners = counts.map((c, i) => (c === top ? i : -1)).filter((i) => i >= 0);
  const value = tieBreak === 'lower' ? Math.min(...winners) : Math.max(...winners);
  return { value, tied: winners.length > 1, counts };
}

export function tally(cfg: Config, c: Country, ballots: Ballot[], repairIdx: number[], revote = false): Tally {
  const ties: string[] = [];
  const counts: Record<string, number[]> = {};
  const levels = {} as Record<DomainId, number>;
  for (const dom of cfg.domains) {
    const lock = c.locks[dom.id] ?? 0;
    const r = plurality(ballots.map((b) => Math.max(lock, b.levels[dom.id])), dom.steps.length, 'lower');
    levels[dom.id] = r.value;
    counts[dom.id] = r.counts;
    if (r.tied && !revote) ties.push(dom.id);
  }
  const ap = plurality(ballots.map((b) => b.appropriate), cfg.appropriate.steps.length, 'lower');
  counts.appropriate = ap.counts;
  if (ap.tied && !revote) ties.push('appropriate');

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
    decision: { levels, appropriate: ap.value, investigate, repair },
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
```

### FILE: src/game/rules.ts

```ts
import type { Config } from './config.ts';

export function rulesText(cfg: Config): string[] {
  const rows: string[] = [];
  rows.push(`우리 모둠은 하나의 나라입니다. ${cfg.rounds}라운드 동안 모둠원 모두가 투표하고, 표가 가장 많은 쪽으로 결정됩니다.`);
  rows.push(`처음에 받는 돈은 ${cfg.startMoney}이고, 이후에는 더 받지 못합니다. 돈이 늘어나는 길은 개발에 성공해 시장에서 버는 것뿐입니다.`);
  rows.push('같은 표가 나오면 한 번 더 투표하고, 그래도 같으면 돈이 덜 드는 낮은 단계로 정해집니다.');
  for (const d of cfg.domains) {
    const costs = d.cost.slice(1).join(' / ');
    const chances = d.success.slice(1).map((p) => `${Math.round(p * 100)}%`).join(' / ');
    rows.push(`${d.icon} ${d.label}: 단계가 높을수록 시장 몫이 크지만 비용이 늘고 성공 확률이 낮아집니다. 비용 ${costs}, 성공 확률 ${chances}. 실패하면 낸 돈은 사라집니다.`);
  }
  const a = cfg.appropriate;
  rows.push(`🔧 ${a.label}: 돈은 거의 안 되지만 피해를 줄여 줍니다. 비용 ${a.cost.slice(1).join(' / ')}.`);
  rows.push('개발에 성공한 나라는 그 기술의 세계 시장을 가져가고, 기술이 없는 나라는 매 라운드 돈이 빠져나갑니다. 먼저 성공할수록 몫이 큽니다.');
  rows.push(`혜택은 바로 오지만, 피해는 ${cfg.harmDelay}라운드 뒤에 도착하고 고를 때는 보이지 않습니다. 내 선택의 피해는 다른 나라에도 갑니다.`);
  rows.push(`피해는 복구할 수 있지만 비용은 개발 비용의 약 ${cfg.repairCostMult}배입니다.`);
  rows.push(`🔦 위험 조사: ${cfg.investigateCost}를 내면 선택지 하나의 ${cfg.harmDelay}라운드 뒤 결과를 흐릿하게 미리 볼 수 있습니다. 투표로 정하고, 반대가 많으면 못 합니다.`);
  rows.push('투표를 내려면 먼저 "이게 잘못되면 최악은?"을 한 줄 적어야 합니다.');
  rows.push('엔딩은 두 번입니다. 먼저 6개 나라를 합친 2075년 지구가 공개되고, 이어서 미래 세대 법정이 나라마다 판결합니다.');
  return rows;
}
```

### FILE: src/game/bots.ts

```ts
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
```

### FILE: src/game/assets.ts

```ts
export const ASSET_FILES = [
  'char_haru_normal', 'char_haru_worried', 'char_haru_serious', 'char_haru_hopeful',
  'icon_bio', 'icon_agri', 'icon_ai', 'icon_appro', 'icon_investigate', 'icon_vote_yes', 'icon_vote_no',
  'country_base_normal',
  'state_bio_good', 'state_bio_shaky', 'state_bio_bad',
  'state_agri_good', 'state_agri_shaky', 'state_agri_bad',
  'state_ai_good', 'state_ai_shaky', 'state_ai_bad',
  'ending_race', 'ending_field', 'ending_designed', 'ending_matched', 'ending_islands', 'ending_together',
  'court_bg',
  'icon_verdict_unseen', 'icon_verdict_ignored', 'icon_verdict_exported', 'icon_verdict_sold',
  'icon_verdict_unaware', 'icon_verdict_rider', 'icon_verdict_clear',
  'scene_intro', 'bg_title',
  'scene_b1', 'scene_b2', 'scene_b3', 'scene_b4',
  'scene_a1', 'scene_a2', 'scene_a3', 'scene_a4',
  'scene_i1', 'scene_i2', 'scene_i3', 'scene_i4',
  'scene_c1', 'scene_c2',
] as const;

export type AssetName = (typeof ASSET_FILES)[number];

export const assetUrl = (name: AssetName): string => `/assets/${name}.webp`;
```

### 마지막 확인
위 6개 파일을 모두 만든 뒤, 파일 이름과 줄 수를 목록으로 먼저 알려 주고 앱 구현을 시작해 줘.
