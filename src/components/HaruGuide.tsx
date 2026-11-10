import React, { useState } from 'react';
import { ChromaImg } from './ChromaImg.tsx';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

interface HaruGuideProps {
  onComplete?: () => void;
  standalone?: boolean;
}

export const HaruGuide: React.FC<HaruGuideProps> = ({ onComplete, standalone = false }) => {
  const [step, setStep] = useState(0);

  const scripts = [
    {
      mood: 'char_haru_normal' as const,
      title: '안녕! 나는 2075년에서 온 "하루"야.',
      text: '지금 여러분이 살고 있는 시대로부터 꼭 50년 뒤의 미래에서 왔어. 2075년의 지구 모습이 어떻게 되었는지 알아?',
    },
    {
      mood: 'char_haru_serious' as const,
      title: '모든 선택에는 대가가 따랐어.',
      text: '생명공학, 유전자 변형 농업, 인공지능... 당장 눈앞의 경제적 이익과 편리함만 보고 마구 개발했더니, 1라운드 뒤에 끔찍한 부작용들이 덮쳐왔지.',
    },
    {
      mood: 'char_haru_worried' as const,
      title: '결과는 다른 나라와 미래 세대로...',
      text: '한 나라의 무분별한 선택으로 인한 오염과 사회적 갈등은 국경을 넘어 이웃 나라로 퍼졌고, 아직 태어나지도 않았던 우리 미래 세대가 고스란히 짊어졌어.',
    },
    {
      mood: 'char_haru_hopeful' as const,
      title: '역사를 바꿀 기회는 지금이야!',
      text: '오늘 6개 나라의 지도자가 되어 기술을 선택해 줘. 하지만 잊지 마: 기술에 투자하기 전에 반드시 "이게 잘못되면 최악은 무엇일까?"를 먼저 예측하고 고민해야 해!',
    },
  ];

  const current = scripts[step];

  const handleNext = () => {
    if (step < scripts.length - 1) {
      setStep(step + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className={`flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-900/90 border border-slate-700 rounded-2xl shadow-2xl ${standalone ? 'max-w-2xl mx-auto' : 'w-full'}`}>
      <div className="relative w-44 h-44 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-950 shadow-inner">
        <ChromaImg
          name={current.mood}
          alt="미래에서 온 아이 하루"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-emerald-600/90 text-[11px] font-bold text-white">
          하루 (2075년)
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            {current.title}
          </div>
          <p className="text-slate-200 text-sm md:text-base leading-relaxed break-keep">
            {current.text}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5">
            {scripts.map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-emerald-400' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg hover:shadow-emerald-600/30 cursor-pointer"
          >
            {step < scripts.length - 1 ? (
              <>
                <span>다음 이야기</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>게임 시작하기</span>
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
