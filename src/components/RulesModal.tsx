import React from 'react';
import { X, BookOpen, ShieldCheck, Scale, AlertTriangle } from 'lucide-react';
import { CONFIG } from '../game/config.ts';
import { rulesText } from '../game/rules.ts';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const rulesList = rulesText(CONFIG);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">2075 지구 — 게임 규칙 & 안내</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200">
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2">
            <h3 className="text-base font-semibold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              핵심 원칙
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              6개 모둠은 각각 1개 국가가 되어 5라운드 동안 미래 기술에 투자합니다. 모든 결정은 모둠원 전원의 투표 다수결로 이루어지며, 혜택은 바로 오지만 피해는 1라운드 뒤에 도착합니다!
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              세부 규칙 (규칙 엔진 공식)
            </h3>
            <div className="space-y-2">
              {rulesList.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-emerald-400">
                    {idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-200">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {CONFIG.domains.map((dom) => (
              <div key={dom.id} className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-base text-white">
                  <span>{dom.icon}</span>
                  <span>{dom.label}</span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>비용: {dom.cost.slice(1).join(' / ')}</div>
                  <div>성공률: {dom.success.slice(1).map((s) => `${Math.round(s * 100)}%`).join(' / ')}</div>
                  <div>시장 수익: 매 라운드 최대 {dom.pool}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-950/30 border border-amber-600/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-relaxed">
              <strong>투표 제출 조건:</strong> 매 라운드 투표 시 반드시 <em>"이게 잘못되면 최악은?"</em>을 한 줄 적어야 제출할 수 있습니다. 여러분이 적은 예측은 마지막 미래 세대 법정에서 심판의 증거로 제시됩니다.
            </div>
          </div>

          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-indigo-300 font-semibold text-sm">
              <Scale className="w-4 h-4" />
              한스 요나스 (Hans Jonas)의 책임의 윤리
            </div>
            <p className="text-sm italic text-slate-300 font-serif">
              "너의 행동의 결과가 인류가 앞으로도 인간답게 살아갈 수 있는 것과 어긋나지 않도록 행동하라."
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/60 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
