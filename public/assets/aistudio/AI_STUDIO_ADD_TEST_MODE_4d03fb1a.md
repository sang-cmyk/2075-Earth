# 점검 모드 추가 (AI Studio에 이어서 붙여 넣기)

지금 만든 앱에 **교사 전용 점검 모드**를 추가해 줘. 수업 전에 선생님이 라운드마다 학생 화면과 계산 결과를 한꺼번에 확인하고, 엔딩까지 빠르게 넘겨 볼 수 있게 하려는 거야. 기존 기능과 `src/game/`의 코드 파일은 건드리지 마.

먼저 아래 「코드 파일」의 `src/game/scenarios.ts`를 내용 그대로 만들어 줘. 한 글자도 바꾸지 마.

## 접근과 안전
- 점검 모드는 학교 구글 계정으로 로그인한 교사 화면에서만 보인다. 학생 기기에서는 주소를 알아도 열리지 않는다.
- **테스트 방(기록 보관함에서 테스트로 표시된 방)에서만** 켜진다. 실제 수업 방에서는 점검 모드 버튼이 보이지 않는다.
- 점검 모드가 만든 데이터는 수업 기록과 섞이지 않게 테스트 방에만 쓴다.

## 기능
1. **자동 진행 패널**: [봇으로 이번 라운드 끝내기], [봇으로 끝까지 진행], [라운드 N으로 이동] 버튼. 학생 인원이 없는 좌석은 `botBallot(CONFIG, 좌석번호, 라운드)`로 채우고, 이미 제출된 표는 그대로 둔다. 각 단계는 실제 라운드와 같은 코드(`beginRound` → `tally` → `endRound`)를 거친다.
2. **학생 화면 미리보기**: 좌석(모둠·출석번호)과 화면 단계(입장, 대기, 투표 카드 1~5, 제출 완료, 결과, 지구 엔딩, 법정)를 골라 그 학생이 보는 화면을 새 창으로 연다. 실제 학생 데이터는 건드리지 않는다.
3. **라운드 점검표**: 라운드가 끝날 때마다 아래를 자동으로 확인해 ✅/❌와 이유를 한 줄씩 보여 준다.
   - 모둠마다 제출 인원 / 전체 인원 (제출 안 한 모둠 표시)
   - Firestore 저장이 성공했는지 (실패하면 ❌와 오류 내용)
   - 교사 상태를 `exportState` → `importState`로 복원해 다시 계산한 결과가 지금 결과와 같은지
   - 이번 라운드에 도착한 피해 건수와 출처(나라·라운드·사건 제목)
   - 돈이 음수인 나라가 없는지, 잠긴 단계가 유지되는지
   - 동률 재투표가 필요했던 항목, 위험 조사 과반 여부, 묻힌 경고 횟수
4. **엔딩 바로가기**: `SCENARIOS`의 4가지(모두 욕심 / 모두 신중 / 섞인 반 / 무임승차)와 시드 번호를 골라 `playScenario(CONFIG, 키, 시드)`로 만든 상태로 바로 지구 엔딩과 미래 세대 법정 화면을 연다. 지구 엔딩 6종과 법정 죄목이 모두 한 번씩 나와 보도록 시드를 바꿔 볼 수 있어야 한다. 엔딩 이름, 그림 자리, "왜 이 엔딩인지" 문구가 보이는지 확인한다.
5. **이벤트 로그**: 시간, 좌석 번호(이름 없음), 동작(입장, 카드 이동, 제출, 수정, 접속 끊김, 재접속)을 시간순으로 보여 주고 CSV로 내려받을 수 있게 한다.
6. **되돌리기**: 라운드 시작 시점의 자동 백업으로 상태를 복원하는 [이 라운드 처음으로] 버튼 (확인 창 필수).

## 마지막에
점검 모드를 쓰는 순서(테스트 방 만들기 → 봇 채우기 → 라운드 진행 → 점검표 확인 → 엔딩 바로가기)를 5줄 이내로 알려 줘. 코드 파일 안에 설치·사용법 주석은 넣지 마.

## 코드 파일

### FILE: src/game/scenarios.ts

```ts
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
```
