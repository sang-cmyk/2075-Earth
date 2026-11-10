import type { GameState } from '../../game/engine.ts';
import { CONFIG } from '../../game/config.ts';
import type { RoomData, StudentInputDoc, TeamData } from '../../types/game.ts';
import { RoundReportCard } from '../RoundReportCard.tsx';

const dash = (n: number) => Math.round(n);

/** 지금 학생 화면에 뭐가 떠 있고, 학생들이 무엇을 해야 하는지 교사에게 알려 주는 문구 */
function studentScreenGuide(phase: RoomData['phase'], round: number): { title: string; todo: string[] } {
  switch (phase) {
    case 'lobby':
      return { title: '입장 대기', todo: ['학생들이 방 코드를 입력하고 모둠·출석번호를 고르는 중이에요.'] };
    case 'intro':
      return { title: '하루 인트로', todo: ['학생 화면: "선생님 화면을 봐 줘!" 안내만 떠 있어요. 학생이 할 일 없음.'] };
    case 'round_damage':
      return {
        title: `${round}라운드 피해 도착`,
        todo: [
          '학생 화면: 우리 나라에 도착한 피해 카드(어느 나라에서 번졌는지 포함)가 보여요.',
          '학생이 할 일 없음 — 읽기만 하면 돼요.',
        ],
      };
    case 'voting':
    case 'revoting':
      return {
        title: `${round}라운드 기술 투자 투표`,
        todo: [
          '학생이 정해야 하는 것: ① 생명공학·LMO 농업·인공지능 각 0~4단계 ② 적정 기술 0~3단계',
          '③ 위험 조사 할지(예/아니오, 영역·단계 지정) ④ 피해 복구 할지(예/아니오) ⑤ 최악의 시나리오 한 줄',
          '기술 트리: 가진 단계보다 최대 2단계까지만 올릴 수 있고, 나보다 앞선 나라에는 매 라운드 로열티를 내요. 못 내면 빚 → 빚 40 이상이면 재정 파탄(스탯·지지도 폭락, 다음 라운드 투자 불가).',
          '모둠 안에서 다수결. 동률이면 공동 1위 중 무작위로 자동 결정돼요(재투표 없음).',
        ],
      };
    case 'treaty':
      return { title: `${round}라운드 국제 협약`, todo: ['학생이 정해야 하는 것: 협약 찬성 / 반대 (모둠 다수결, 4개국 이상 찬성 시 비준)'] };
    case 'event':
      return { title: `${round}라운드 돌발 사건`, todo: ['학생이 정해야 하는 것: 돌발 사건 대응책 1개 (모둠 다수결)'] };
    case 'round_result':
      return {
        title: `${round}라운드 결과 공개`,
        todo: ['학생 화면: 우리 선택의 결과 카드(개발 성공/실패, 돈의 흐름, 남에게 준 피해, 지지도)가 보여요.', '학생이 할 일 없음.'],
      };
    default:
      return { title: '', todo: [] };
  }
}

/** 영역별 현재 표 분포 → "2단계 3표 · 1단계 1표" */
function liveVotes(inputs: Record<number, StudentInputDoc> | undefined, round: number, get: (b: StudentInputDoc['ballot']) => number) {
  const counts: Record<number, number> = {};
  for (const inp of Object.values(inputs ?? {})) {
    if (!inp.ballot || inp.round !== round) continue;
    const v = get(inp.ballot);
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { text: '-', tied: false };
  const tied = entries.length > 1 && entries[0][1] === entries[1][1];
  return { text: entries.map(([l, n]) => `${l}단계 ${n}표`).join(' · '), tied };
}

export function TeacherOverview({
  gameState,
  roomData,
  teams,
  allInputs,
}: {
  gameState: GameState;
  roomData: RoomData;
  teams: Record<number, TeamData>;
  allInputs: Record<number, Record<number, StudentInputDoc>>;
}) {
  const guide = studentScreenGuide(roomData.phase, roomData.round);
  const isVoting = roomData.phase === 'voting' || roomData.phase === 'revoting';
  const showResult = roomData.phase === 'round_result';

  return (
    <div className="space-y-4 mb-4">
      {guide.title && (
        <div className="p-4 bg-indigo-950/50 border border-indigo-500/40 rounded-2xl space-y-1">
          <div className="text-xs font-black text-indigo-300">📱 지금 학생 화면 · {guide.title}</div>
          {guide.todo.map((t, i) => (
            <div key={i} className="text-xs text-slate-200 break-keep">
              {t}
            </div>
          ))}
        </div>
      )}

      {/* 전체 모둠 한눈에 보기 */}
      {roomData.phase !== 'lobby' && roomData.phase !== 'intro' && (
        <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-2xl overflow-x-auto">
          <div className="text-xs font-black text-white mb-2">🌍 전체 모둠 현황</div>
          <table className="w-full text-[11px] text-slate-200 min-w-[720px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-1 pr-2">나라</th>
                <th>자금</th>
                <th>보건</th>
                <th>생태</th>
                <th>사회</th>
                <th>지지도</th>
                <th>빚</th>
                <th>보유 기술</th>
                {isVoting && <th className="text-left">현재 표 분포 (생명 / 농업 / AI / 적정)</th>}
                {isVoting && <th>제출</th>}
                {showResult && <th className="text-left">이번 선택 (생명/농업/AI/적정)</th>}
              </tr>
            </thead>
            <tbody>
              {gameState.countries.map((c) => {
                const inputs = allInputs[c.id];
                const seated = Object.keys(teams[c.id]?.seats ?? {}).length;
                const submitted = Object.values(inputs ?? {}).filter((i) => i.submitted && i.round === roomData.round).length;
                const dec = teams[c.id]?.lastDecision;
                return (
                  <tr key={c.id} className="border-b border-slate-800/60 text-center">
                    <td className="text-left py-1.5 pr-2 font-bold text-white">제{c.id + 1}국</td>
                    <td className="font-mono text-amber-300">{dash(c.money)}</td>
                    <td className="font-mono">{dash(c.stats.health)}</td>
                    <td className="font-mono">{dash(c.stats.ecology)}</td>
                    <td className="font-mono">{dash(c.stats.society)}</td>
                    <td className={`font-mono ${c.support < 40 ? 'text-rose-400' : c.support >= 70 ? 'text-emerald-400' : ''}`}>
                      {dash(c.support)}%
                    </td>
                    <td className={`font-mono ${(c.debt ?? 0) > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                      {c.debt ?? 0}
                      {(c.frozen ?? 0) > 0 ? ' 🏚️' : ''}
                    </td>
                    <td className="whitespace-nowrap">
                      {CONFIG.domains.map((d) => `${d.icon}${c.held[d.id]?.level ?? 0}`).join(' ')} 🌱{c.shield}
                    </td>
                    {isVoting && (
                      <td className="text-left space-y-0.5">
                        {[
                          ...CONFIG.domains.map((d) => liveVotes(inputs, roomData.round, (b) => b.levels[d.id])),
                          liveVotes(inputs, roomData.round, (b) => b.appropriate),
                        ].map((v, i) => (
                          <span key={i} className={`inline-block mr-2 ${v.tied ? 'text-amber-300 font-bold' : ''}`}>
                            {v.text}
                            {v.tied ? ' (동률→랜덤)' : ''}
                            {i < 3 ? ' /' : ''}
                          </span>
                        ))}
                      </td>
                    )}
                    {isVoting && (
                      <td className={submitted >= seated && seated > 0 ? 'text-emerald-400 font-bold' : ''}>
                        {submitted}/{Math.max(seated, submitted)}
                      </td>
                    )}
                    {showResult && (
                      <td className="text-left whitespace-nowrap">
                        {dec
                          ? `${CONFIG.domains.map((d) => `${d.icon}${dec.levels[d.id]}`).join(' ')} 🌱${dec.appropriate}${
                              teams[c.id]?.lastTally?.ties?.length ? ' · 동률 랜덤 결정' : ''
                            }`
                          : '-'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 결과 단계: 모둠별 인과 카드 */}
      {showResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {gameState.countries.map((c) => (
            <div key={c.id} className="p-3 bg-slate-900/90 border border-slate-700 rounded-2xl">
              <div className="text-sm font-black text-white mb-2">제{c.id + 1}국 결과</div>
              <RoundReportCard country={c} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
