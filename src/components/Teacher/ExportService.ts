import JSZip from 'jszip';
import type { GameState } from '../../game/engine.ts';
import { earthEnding, court, ENDING_NAMES, VERDICT_NAMES } from '../../game/engine.ts';
import type { RoomData, StudentInputDoc } from '../../types/game.ts';

export function exportRoomCSV(
  room: RoomData,
  gameState: GameState,
  allInputs?: Record<number, Record<number, StudentInputDoc>>
): void {
  const ending = earthEnding(gameState);
  const judgements = court(gameState);

  let csv = '\uFEFF'; // UTF-8 BOM for Excel
  csv += `방 이름,${room.title}\n`;
  csv += `학급,${room.grade}학년 ${room.classNumber}반\n`;
  csv += `방 코드,${room.code}\n`;
  csv += `지구 엔딩,${ENDING_NAMES[ending.ending]}\n`;
  csv += `지구 평균 건강,${Math.round(ending.avg.health)}\n`;
  csv += `지구 평균 생태,${Math.round(ending.avg.ecology)}\n`;
  csv += `지구 평균 사회,${Math.round(ending.avg.society)}\n\n`;

  csv += '국가,최종 자금,건강,생태,사회,위험조사 횟수,묻힌경고 횟수,적정기술 투자액,판결 죄목,감형 여부\n';

  gameState.countries.forEach((c, idx) => {
    const j = judgements[idx];
    const vStr = j.verdicts.map((v) => VERDICT_NAMES[v]).join('; ');
    csv += `제${idx + 1}국,${Math.round(c.money)},${Math.round(c.stats.health)},${Math.round(c.stats.ecology)},${Math.round(c.stats.society)},${c.investigations},${c.ignoredWarnings},${c.approSpent},"${vStr}",${j.mercy ? '감형' : '해당없음'}\n`;
  });

  if (allInputs) {
    csv += '\n[학생 성찰지 및 최악의 예측 기록]\n';
    csv += '모둠,출석번호,내가 가장 후회한 선택,다시 한다면,투표 시 최악의 예측\n';
    for (let t = 0; t < 6; t++) {
      const teamInps = allInputs[t] || {};
      for (const [seatStr, inp] of Object.entries(teamInps)) {
        const regret = (inp.reflection?.regret || '').replace(/"/g, '""');
        const retry = (inp.reflection?.retry || '').replace(/"/g, '""');
        const worst = (inp.ballot?.worst || '').replace(/"/g, '""');
        if (regret || retry || worst) {
          csv += `제${t + 1}국,${seatStr}번,"${regret}","${retry}","${worst}"\n`;
        }
      }
    }
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `2075지구_${room.grade}학년${room.classNumber}반_수업기록.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRecordCardsZip(
  room: RoomData,
  gameState: GameState,
  teamInputsMap: Record<number, Record<number, { ballot: { worst: string } }>> = {}
): Promise<void> {
  const zip = new JSZip();
  const ending = earthEnding(gameState);
  const judgements = court(gameState);

  // Helper to draw a 1920x1080 canvas
  const drawCard = (countryIdx: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, 1860, 1020);

    // Header Title
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`2075 지구 (Earth 2075) — ${room.grade}학년 ${room.classNumber}반`, 80, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(`제${countryIdx + 1}국 미래 책임 기록 카드`, 80, 190);

    // Country stats
    const c = gameState.countries[countryIdx];
    const j = judgements[countryIdx];

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(80, 240, 840, 480);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 240, 840, 480);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('국가 생존 지표 및 자산', 110, 295);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '28px sans-serif';
    ctx.fillText(`최종 보유 자금: ${Math.round(c.money)}원`, 110, 360);
    ctx.fillText(`국민 건강: ${Math.round(c.stats.health)} / 100`, 110, 420);
    ctx.fillText(`생태 환경: ${Math.round(c.stats.ecology)} / 100`, 110, 480);
    ctx.fillText(`사회적 신뢰: ${Math.round(c.stats.society)} / 100`, 110, 540);
    ctx.fillText(`위험 사전 조사: ${c.investigations}회`, 110, 600);
    ctx.fillText(`적정 기술 기여: ${c.approSpent}원 (피해 복구 ${c.repairs}회)`, 110, 660);

    // Verdict box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(960, 240, 880, 480);
    ctx.strokeRect(960, 240, 880, 480);

    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('미래 세대 법정 판결', 990, 295);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    const vStr = j.verdicts.map((v) => VERDICT_NAMES[v]).join(', ');
    ctx.fillText(vStr, 990, 360);

    ctx.fillStyle = j.mercy ? '#34d399' : '#94a3b8';
    ctx.font = '26px sans-serif';
    ctx.fillText(
      `감형 여부: ${j.mercy ? '인정됨 (위험 조사 및 나눔 노력 참작)' : '해당 없음'}`,
      990,
      420
    );

    // Worst prediction list
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '24px sans-serif';
    ctx.fillText('모둠원이 투표 시 예측했던 최악의 시나리오:', 990, 480);

    const teamInps = teamInputsMap[countryIdx] || {};
    const preds = Object.values(teamInps)
      .map((p) => p.ballot?.worst)
      .filter(Boolean);

    if (preds.length > 0) {
      preds.slice(0, 3).forEach((p, idx) => {
        ctx.fillText(`- "${p.slice(0, 45)}"`, 1010, 530 + idx * 45);
      });
    } else {
      ctx.fillText('- 기록된 예측 없음', 1010, 530);
    }

    // Earth Ending summary bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(80, 750, 1760, 140);
    ctx.strokeRect(80, 750, 1760, 140);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`2075 지구 최종 엔딩: [${ENDING_NAMES[ending.ending]}]`, 110, 805);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px sans-serif';
    ctx.fillText(
      `지구 평균 건강: ${Math.round(ending.avg.health)} | 생태: ${Math.round(ending.avg.ecology)} | 사회: ${Math.round(ending.avg.society)} | 상위 2개국 부 독점: ${Math.round(ending.top2 * 100)}%`,
      110,
      855
    );

    // Jonas Quote Footer
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'italic 24px serif';
    ctx.fillText(
      '"너의 행동의 결과가 인류가 앞으로도 인간답게 살아갈 수 있는 것과 어긋나지 않도록 행동하라." — 한스 요나스',
      110,
      940
    );

    return canvas.toDataURL('image/png').split(',')[1];
  };

  // Generate cards for all 6 countries
  for (let i = 0; i < 6; i++) {
    const base64Data = drawCard(i);
    zip.file(`제${i + 1}국_미래기록카드_1920x1080.png`, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `2075지구_${room.grade}학년${room.classNumber}반_기록카드.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
