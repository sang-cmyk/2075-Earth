import React, { useState, useEffect } from 'react';
import { court, VERDICT_NAMES, findEvent } from '../../game/engine.ts';
import type { GameState } from '../../game/engine.ts';
import { assetUrl } from '../../game/assets.ts';
import { Scale, Gavel, ArrowLeft, ArrowRight, ShieldCheck, FileText, Sparkles, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GAME_EVENTS } from '../../game/events.ts';
import { SafeImg } from '../SafeImg.tsx';

interface CourtViewProps {
  gameState: GameState;
  isTeacher?: boolean;
  onFinish?: () => void;
  teamInputsMap?: Record<number, Record<number, { ballot: { worst: string } }>>;
  initialCountry?: number;
}

export const CourtView: React.FC<CourtViewProps> = ({
  gameState,
  isTeacher = false,
  onFinish,
  teamInputsMap = {},
  initialCountry = 0,
}) => {
  const [currentCountry, setCurrentCountry] = useState(initialCountry);
  const [showFinalQuote, setShowFinalQuote] = useState(false);

  const judgements = court(gameState);
  const cData = gameState.countries[currentCountry];
  const judgement = judgements[currentCountry];

  useEffect(() => {
    if (judgement.verdicts.includes('clear')) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentCountry]);

  // Find harms caused by this country
  const causedHarms = gameState.harms.filter((h) => h.from === currentCountry);
  const causedEvents = causedHarms
    .map((h) => findEvent(gameState.cfg, h.eventId))
    .filter(Boolean);
  // 같은 사건이 여러 번 일어났으면 한 줄로 묶고 횟수를 센다
  const causedGroups: { ev: NonNullable<(typeof causedEvents)[number]>; count: number }[] = [];
  for (const ev of causedEvents) {
    if (!ev) continue;
    const g = causedGroups.find((x) => x.ev.id === ev.id);
    if (g) g.count += 1;
    else causedGroups.push({ ev, count: 1 });
  }

  // Student predictions recorded by this team
  const teamInputs = teamInputsMap[currentCountry] || {};
  const predictions = Object.values(teamInputs)
    .map((inp) => inp.ballot?.worst)
    .filter(Boolean);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in text-white">
      {/* Court Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-amber-300">
              미래 세대 법정 (Future Generation Court)
            </h2>
            <p className="text-xs text-slate-400">
              2075년 미래의 아이들이 2025년 조상들의 선택을 직접 심판합니다.
            </p>
          </div>
        </div>

        {/* Country Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {gameState.countries.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentCountry(idx);
                setShowFinalQuote(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentCountry === idx && !showFinalQuote
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg scale-105'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              제{idx + 1}국
            </button>
          ))}
          <button
            onClick={() => setShowFinalQuote(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              showFinalQuote
                ? 'bg-emerald-500 text-slate-950 font-black shadow'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            📜 요나스의 한 줄
          </button>
        </div>
      </div>

      {!showFinalQuote ? (
        <div className="space-y-6">
          {/* Main Verdict Card */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-slate-950 shadow-2xl">
            {/* Background Courtroom Image */}
            <img
              src={assetUrl('court_bg')}
              alt="법정 배경"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="relative p-6 md:p-8 space-y-6">
              {/* Country Badge & Verdict Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">
                    국가별 책임 판결문
                  </span>
                  <h3 className="text-2xl md:text-4xl font-black text-white mt-1">
                    제{currentCountry + 1}국에 대한 판결
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {judgement.mercy && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      참작 및 감형 사유 인정
                    </div>
                  )}
                  <div className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400">
                    보유 자금: {Math.round(cData.money)} / 생존 지표: {Math.round(cData.stats.health + cData.stats.ecology + cData.stats.society)}
                  </div>
                </div>
              </div>

              {/* Verdict Names & Artwork Badges */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {judgement.verdicts.map((vKey) => (
                  <div
                    key={vKey}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${
                      vKey === 'clear'
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0 flex items-center justify-center">
                      <SafeImg
                        name={vKey === 'abandon' ? 'icon_verdict_neglect' : (`icon_verdict_${vKey}` as any)}
                        alt={VERDICT_NAMES[vKey]}
                        className="w-full h-full object-cover"
                        fallbackEmoji={vKey === 'clear' ? '🕊️' : '⚖️'}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                        {vKey === 'clear' ? '칭찬 판결' : '죄목 선고'}
                      </div>
                      <div className="text-base font-bold text-white mt-0.5 leading-snug">
                        {VERDICT_NAMES[vKey]}
                      </div>
                      {vKey === 'abandon' && (
                        <div className="text-[11px] text-rose-300/90 mt-0.5">
                          위기가 치솟는데도 문제를 해결하지 않고 방치했습니다.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Evidence Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Evidence 1: Predictions vs Reality */}
                <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    증거 ① 우리가 적은 최악의 예측 vs 실제로 일어난 일
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="font-bold text-amber-400 block mb-1">
                        우리가 투표 때 적은 최악의 시나리오:
                      </span>
                      {predictions.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-slate-300">
                          {predictions.slice(0, 3).map((p, i) => (
                            <li key={i} className="italic">"{p}"</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 italic">기록된 예측 없음</p>
                      )}
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="font-bold text-rose-400 block mb-1">
                        실제로 발생한 피해 사건:
                      </span>
                      {causedGroups.length > 0 ? (
                        <div className="space-y-1.5">
                          {causedGroups.map(({ ev, count }, i) => (
                            <div key={i} className="text-slate-300">
                              <span className="font-semibold text-white">{ev.title}</span>
                              {count > 1 && <span className="ml-1 text-rose-300 font-bold">×{count}회</span>}
                              <span>: {ev.desc}</span>
                              <div className="mt-0.5 text-[10px] text-amber-300">
                                [{ev.kind === 'real' ? '실제로 있었던 일' : '전문가들이 경고하는 가정'}]
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-emerald-400">발생한 중대 피해 사건 없음</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Evidence 2: Numerical Records */}
                <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-400" />
                    증거 ② 윤리적 노력 및 방치 기록
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">위험 조사 횟수:</span>
                      <span className="text-lg font-black text-white">{cData.investigations}회</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">미리 위험을 알아채려 했는가?</p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">묻힌 경고 횟수:</span>
                      <span className="text-lg font-black text-rose-400">{cData.ignoredWarnings}회</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">모둠원의 반대로 묵살된 경고</p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">적정 기술 투자액:</span>
                      <span className="text-lg font-black text-teal-400">{cData.approSpent}원</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">남을 지켜주기 위해 쓴 돈</p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block">피해 복구 횟수:</span>
                      <span className="text-lg font-black text-emerald-400">{cData.repairs}회</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">망가진 사회와 생태계를 치료</p>
                    </div>

                    {gameState.cfg.crisis?.enabled && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 col-span-2">
                        <span className="text-slate-400 block">방치된 위기로 잃은 점수:</span>
                        <span className="text-lg font-black text-rose-400">
                          -{Math.round(cData.lostToCrisis || 0)}점
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          질병·식량·격차 위기를 제때 해결하지 않아 감소된 생존 지표
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence 3: Event Choices Recorded */}
                {cData.eventChoices && cData.eventChoices.length > 0 && (
                  <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 col-span-1 md:col-span-2">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-sky-400" />
                      증거 ③ 돌발 사건에서의 도덕적 선택 기록
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {cData.eventChoices.map((ec, idx) => {
                        const evDef = GAME_EVENTS.find((e) => e.id === ec.eventId);
                        const chDef = evDef?.choices.find((c) => c.id === ec.choiceId);
                        return (
                          <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 font-bold text-[10px]">
                              {ec.round}R {evDef?.title || '돌발 사건'}
                            </span>
                            <div className="font-bold text-white mt-1">{chDef?.label || ec.choiceId}</div>
                            <p className="text-[11px] text-slate-400">{chDef?.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Between Countries */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCurrentCountry(Math.max(0, currentCountry - 1))}
              disabled={currentCountry === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>이전 국가</span>
            </button>

            <span className="text-sm font-bold text-slate-400">
              {currentCountry + 1} / {gameState.countries.length} 국가
            </span>

            {currentCountry < gameState.countries.length - 1 ? (
              <button
                onClick={() => setCurrentCountry(currentCountry + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors cursor-pointer"
              >
                <span>다음 국가 판결</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            ) : (
              <button
                onClick={() => setShowFinalQuote(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black transition-colors cursor-pointer"
              >
                <span>최종 마무리</span>
                <Sparkles className="w-4 h-4 text-slate-950" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Final Hans Jonas Quote Card */
        <div className="p-8 md:p-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border-2 border-indigo-500/50 shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 mx-auto">
            <Scale className="w-8 h-8" />
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h3 className="text-xl md:text-2xl font-bold text-indigo-300 tracking-wide uppercase">
              한스 요나스 (Hans Jonas) — 책임의 정언명령
            </h3>
            <p className="text-2xl md:text-4xl font-serif font-black text-white leading-relaxed break-keep drop-shadow">
              "너의 행동의 결과가 인류가 앞으로도 인간답게 살아갈 수 있는 것과 어긋나지 않도록 행동하라."
            </p>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed break-keep pt-2">
              우리가 오늘 내린 결정은 수십 년 뒤 미래 세대의 삶과 지구 생태계를 결정짓습니다. 눈앞의 이익보다 예측되지 않은 위험을 먼저 살피는 책임감 있는 인간이 되어 주세요.
            </p>
          </div>

          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={() => setShowFinalQuote(false)}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              판결문 다시 보기
            </button>
            {onFinish && (
              <button
                onClick={onFinish}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg transition-colors cursor-pointer"
              >
                수업 종료 및 메인으로
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
