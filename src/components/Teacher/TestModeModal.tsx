import React, { useState } from 'react';
import type { RoomData, TeamData, StudentInputDoc } from '../../types/game.ts';
import { CONFIG } from '../../game/config.ts';
import { buildRoomConfig } from '../../game/roomConfig.ts';
import {
  importState,
  exportState,
  beginRound,
  endRound,
  makeRng,
  investigate,
  repairable,
  type GameState,
  type Decision,
} from '../../game/engine.ts';
import { tally, recordBuried, type Ballot } from '../../game/vote.ts';
import { botBallot } from '../../game/bots.ts';
import {
  updateRoom,
  updateTeam,
  submitStudentBallot,
} from '../../services/roomService.ts';
import { Gauges } from '../Gauges.tsx';
import {
  X,
  Play,
  FastForward,
  Bot,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface TestModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomData: RoomData;
  teams: Record<number, TeamData>;
  allInputs: Record<number, Record<number, StudentInputDoc>>;
  gameState: GameState;
}

export const TestModeModal: React.FC<TestModeModalProps> = ({
  isOpen,
  onClose,
  roomData,
  teams,
  allInputs,
  gameState,
}) => {
  const [runningAuto, setRunningAuto] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const maxSeats = roomData.maxSeatsPerTeam ?? 5;
  const targetSeats = Array.from({ length: maxSeats }, (_, i) => i + 1);

  // 1. 봇으로 이번 라운드 마감 및 계산
  const handleFinishCurrentRoundWithBots = async () => {
    setRunningAuto(true);
    setStatusMessage('이번 라운드의 빈 좌석을 봇 표로 채우고 집계하는 중...');
    try {
      const curRound = roomData.round || 1;
      const writes: Promise<void>[] = [];

      // Fill ballots for all missing seats
      for (let t = 0; t < 6; t++) {
        const teamInps = allInputs[t] || {};
        for (const s of targetSeats) {
          if (!teamInps[s] || !teamInps[s].submitted || teamInps[s].round !== curRound) {
            const b = botBallot(CONFIG, s, curRound);
            writes.push(
              submitStudentBallot(
                roomData.id,
                t,
                s,
                `bot_${t}_${s}`,
                curRound,
                b,
                true
              )
            );
          }
        }
      }
      await Promise.all(writes);

      // Perform tally and advance
      const freshState: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);
      const rng = makeRng(roomData.seed + curRound * 100);
      const decisions: Decision[] = [];
      const teamUpdates: Promise<void>[] = [];

      for (let t = 0; t < 6; t++) {
        const country = freshState.countries[t];
        const ballots: Ballot[] = targetSeats.map((s) => botBallot(CONFIG, s, curRound));
        const repairIdx = repairable(freshState, t);
        const res = tally(CONFIG, country, ballots, repairIdx, true);
        recordBuried(country, res.decision, res.buried);

        let invResult = null;
        if (res.decision.investigate) {
          invResult = investigate(
            CONFIG,
            res.decision.investigate.domain,
            res.decision.investigate.level
          );
        }
        decisions.push(res.decision);
        teamUpdates.push(
          updateTeam(roomData.id, t, {
            lastDecision: res.decision,
            lastTally: res,
            lastBuriedWarnings: res.buried,
            lastInvestigation: invResult,
            unlocked: false,
          })
        );
      }
      await Promise.all(teamUpdates);

      endRound(freshState, decisions, rng);

      if (curRound < CONFIG.rounds) {
        beginRound(freshState);
        await updateRoom(roomData.id, {
          round: curRound + 1,
          phase: 'round_damage',
          gameStateJson: exportState(freshState),
        });
        setStatusMessage(`${curRound}라운드 봇 집계가 완료되어 ${curRound + 1}라운드로 전환되었습니다.`);
      } else {
        await updateRoom(roomData.id, {
          phase: 'earth_ending',
          gameStateJson: exportState(freshState),
        });
        setStatusMessage('5라운드 봇 집계가 완료되어 지구 엔딩으로 전환되었습니다.');
      }
    } catch (e: any) {
      console.error('Error auto completing round:', e);
      setStatusMessage('진행 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'));
    } finally {
      setRunningAuto(false);
    }
  };

  // 2. 봇으로 5라운드 끝까지 진행
  const handleRunToEndWithBots = async () => {
    setRunningAuto(true);
    setStatusMessage('5라운드 엔딩까지 모든 과정을 봇으로 순차 진행하는 중...');
    try {
      const state: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);
      const startR = roomData.round || 1;

      for (let r = startR; r <= CONFIG.rounds; r++) {
        beginRound(state);
        const rng = makeRng(roomData.seed + r * 100);
        const decisions: Decision[] = [];
        const teamUpdates: Promise<void>[] = [];

        for (let t = 0; t < 6; t++) {
          const country = state.countries[t];
          const ballots: Ballot[] = targetSeats.map((s) => botBallot(CONFIG, s, r));
          const repairIdx = repairable(state, t);
          const res = tally(CONFIG, country, ballots, repairIdx, true);
          recordBuried(country, res.decision, res.buried);

          decisions.push(res.decision);
          teamUpdates.push(
            updateTeam(roomData.id, t, {
              lastDecision: res.decision,
              lastTally: res,
              lastBuriedWarnings: res.buried,
            })
          );
        }
        await Promise.all(teamUpdates);

        endRound(state, decisions, rng);
      }

      await updateRoom(roomData.id, {
        round: 5,
        phase: 'earth_ending',
        gameStateJson: exportState(state),
      });

      setStatusMessage('5라운드 전체 봇 시뮬레이션이 완료되었습니다 (지구 엔딩 진입).');
    } catch (e: any) {
      console.error('Run to end error:', e);
      setStatusMessage('진행 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'));
    } finally {
      setRunningAuto(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-white">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border-2 border-indigo-500/50 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">봇 자동 진행 및 결과 확인</h3>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                  테스트 방 전용
                </span>
              </div>
              <p className="text-xs text-slate-400">
                실제 게임 규칙 엔진을 거쳐 봇으로 라운드를 진행하고 각국의 결과를 확인합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Control Panel */}
          <div className="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FastForward className="w-4 h-4 text-emerald-400" />
                  봇 자동 시뮬레이션
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  모둠 정원 {maxSeats}명 기준 botBallot으로 투표를 채우고 집계합니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-slate-800 text-amber-400 font-bold text-xs">
                  현재 진행: {roomData.round} / 5 라운드 ({roomData.phase})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                disabled={runningAuto || roomData.phase === 'earth_ending' || roomData.phase === 'court' || roomData.phase === 'finished'}
                onClick={handleFinishCurrentRoundWithBots}
                className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>봇으로 이번 라운드 마감 및 계산</span>
              </button>

              <button
                disabled={runningAuto || roomData.phase === 'earth_ending' || roomData.phase === 'court' || roomData.phase === 'finished'}
                onClick={handleRunToEndWithBots}
                className="flex items-center justify-center gap-2 p-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                <span>봇으로 5라운드 끝까지 진행 (엔딩 직행)</span>
              </button>
            </div>

            {statusMessage && (
              <div className="p-3 bg-indigo-950/50 border border-indigo-500/40 rounded-xl text-xs text-indigo-300 font-medium">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Result Verification: Current status of all 6 countries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                6개 국가별 현재 결과 지표
              </h4>
              <span className="text-[11px] text-slate-400">
                (건강 + 생태 + 사회 = 지표합 / 자금)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gameState.countries.map((c, i) => {
                const totalStats = Math.round(c.stats.health + c.stats.ecology + c.stats.society);
                const dec = teams[i]?.lastDecision;
                return (
                  <div
                    key={i}
                    className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white">제{i + 1}국</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs font-bold">
                        자금 {Math.round(c.money)}원
                      </span>
                    </div>

                    <Gauges stats={c.stats} money={c.money} shield={c.shield} compact={true} />

                    <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>생존 지표 종합:</span>
                        <strong className={totalStats < 100 ? 'text-rose-400' : 'text-emerald-400'}>
                          {totalStats}점
                        </strong>
                      </div>
                      {dec && (
                        <div className="text-slate-400">
                          <span>최근 투자: </span>
                          <span className="text-slate-200">
                            생명 {dec.levels.bio} · 농업 {dec.levels.agri} · AI {dec.levels.ai} · 적정 {dec.appropriate}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-400">
                        <span>위험조사 {c.investigations}회</span>
                        <span>묵살된 경고 {c.ignoredWarnings}회</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {roomData.phase === 'earth_ending' && '현재 지구 엔딩 단계입니다. 닫기를 눌러 화면을 확인하세요.'}
            {roomData.phase === 'court' && '현재 미래 세대 법정 단계입니다.'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
