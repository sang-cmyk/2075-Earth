import React, { useState, useEffect, useRef } from 'react';
import {
  findRoomByCode,
  subscribeRoom,
  subscribeTeam,
  subscribeAllTeams,
  subscribeTeamInputs,
  claimSeat,
  releaseSeat,
  submitStudentBallot,
  submitStudentEventChoice,
  submitStudentTreatyVote,
  getClientId,
} from '../../services/roomService.ts';
import type { RoomData, TeamData, StudentInputDoc, GamePhase } from '../../types/game.ts';
import { CONFIG, type DomainId } from '../../game/config.ts';
import { buildRoomConfig } from '../../game/roomConfig.ts';
import { importState, findEvent, type GameState } from '../../game/engine.ts';
import type { Ballot } from '../../game/vote.ts';
import { isChoiceViolatingTreaties } from '../../game/events.ts';
import { RoundReportCard } from '../RoundReportCard.tsx';
import { auth } from '../../firebase.ts';
import { signInAnonymously } from 'firebase/auth';
import { Gauges, CountryVisual, CrisisSupportGauges } from '../Gauges.tsx';
import { ChromaImg } from '../ChromaImg.tsx';
import { SafeImg } from '../SafeImg.tsx';
import { EarthEndingView } from '../Endings/EarthEndingView.tsx';
import { CourtView } from '../Endings/CourtView.tsx';
import { assetUrl, type AssetName } from '../../game/assets.ts';
import {
  ArrowLeft,
  Users,
  CheckCircle,
  AlertTriangle,
  Lock,
  Search,
  Wrench,
  Send,
  Eye,
  Clock,
  Timer,
  Coins,
} from 'lucide-react';

const DOMAIN_ICON: Record<DomainId, AssetName> = {
  bio: 'icon_bio',
  agri: 'icon_agri',
  ai: 'icon_ai',
};

const AXIS_LABEL: Record<string, string> = { health: '건강', ecology: '생태', society: '사회' };

// 하루(안내 캐릭터)가 말하는 말풍선 카드
const HaruCard: React.FC<{
  mood: AssetName;
  title: string;
  children?: React.ReactNode;
  tone?: 'default' | 'warn' | 'good';
}> = ({ mood, title, children, tone = 'default' }) => {
  const border =
    tone === 'warn' ? 'border-rose-500/40 bg-rose-950/40' : tone === 'good' ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/90';
  return (
    <div className={`p-4 rounded-2xl border shadow-xl flex items-center gap-4 ${border}`}>
      <ChromaImg
        name={mood}
        alt="하루"
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover object-top border-2 border-emerald-500/50 bg-slate-950 flex-shrink-0"
      />
      <div className="space-y-1 min-w-0">
        <div className="text-[11px] font-bold text-emerald-400">하루 (2075년)</div>
        <h3 className="text-base sm:text-lg font-black text-white break-keep">{title}</h3>
        {children && <div className="text-sm text-slate-300 leading-relaxed break-keep">{children}</div>}
      </div>
    </div>
  );
};

const useCountdown = (expiresAt: number | undefined, paused: boolean | undefined, active: boolean) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!active || !expiresAt) return null;
  const sec = Math.max(0, Math.round((expiresAt - now) / 1000));
  return { sec, paused: !!paused, label: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` };
};

export interface StudentViewProps {
  initialRoomCode?: string;
  preview?: { roomId: string; teamId: number };
}

interface InnerProps extends StudentViewProps {
  phaseOverride?: GamePhase;
}

const PREVIEW_PHASES: { value: GamePhase | ''; label: string }[] = [
  { value: '', label: '실제 진행 단계 따라가기' },
  { value: 'lobby', label: '대기실' },
  { value: 'intro', label: '인트로' },
  { value: 'round_damage', label: '피해 도착' },
  { value: 'treaty', label: '국제 협약 투표' },
  { value: 'event', label: '돌발 사건' },
  { value: 'voting', label: '투표' },
  { value: 'revoting', label: '동률 재투표' },
  { value: 'round_result', label: '라운드 결과' },
  { value: 'earth_ending', label: '지구 엔딩' },
  { value: 'court', label: '미래 세대 법정' },
  { value: 'finished', label: '수업 완료' },
];

export const StudentView: React.FC<StudentViewProps> = (props) => {
  const [override, setOverride] = useState<GamePhase | ''>('');
  return (
    <>
      {props.preview && (
        <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-3 py-2 text-xs font-bold flex items-center gap-2">
          <span className="whitespace-nowrap">👀 미리보기 (저장 안 됨)</span>
          <select
            value={override}
            onChange={(e) => setOverride(e.target.value as GamePhase | '')}
            className="flex-1 min-w-0 rounded bg-white/90 text-slate-900 px-1.5 py-1"
          >
            {PREVIEW_PHASES.map((ph) => (
              <option key={ph.value} value={ph.value}>
                {ph.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <StudentViewInner {...props} phaseOverride={override || undefined} />
    </>
  );
};

const StudentViewInner: React.FC<InnerProps> = ({ initialRoomCode, preview, phaseOverride }) => {
  // Join Wizard states
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode || '');
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(preview ? preview.teamId : null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(preview ? 0 : null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Active Session states
  const [roomId, setRoomId] = useState<string | null>(preview ? preview.roomId : null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [allTeams, setAllTeams] = useState<Record<number, TeamData>>({});
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [teamInputs, setTeamInputs] = useState<Record<number, StudentInputDoc>>({});

  // Voting ballot state
  const [levels, setLevels] = useState<Record<DomainId, number>>({
    bio: 0,
    agri: 0,
    ai: 0,
  });
  const [appropriate, setAppropriate] = useState(0);
  const [investigateChoice, setInvestigateChoice] = useState<{
    domain: DomainId;
    level: number;
  } | null>(null);
  const [wantInvestigate, setWantInvestigate] = useState(false);
  const [wantRepair, setWantRepair] = useState(false);
  const [worstPrediction, setWorstPrediction] = useState('');
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSeatChangeModal, setShowSeatChangeModal] = useState(false);
  const roundRef = useRef(0);

  // Auto-restore session from localStorage
  useEffect(() => {
    if (preview) return;
    const saved = localStorage.getItem('2075_student_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roomId && parsed.teamId !== undefined && parsed.seat !== undefined) {
          setRoomId(parsed.roomId);
          setSelectedTeam(parsed.teamId);
          setSelectedSeat(parsed.seat);
          setSelectedClass(parsed.classNumber || 1);
        }
      } catch (e) {
        localStorage.removeItem('2075_student_session');
      }
    }
  }, []);

  // Ensure device authentication
  useEffect(() => {
    if (preview) return;
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
  }, []);

  // Subscribe to room
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeRoom(roomId, (data) => {
      setRoomData(data);
      if (!data) {
        // Room deleted
        localStorage.removeItem('2075_student_session');
        setRoomId(null);
      }
    });
    return () => unsub();
  }, [roomId]);

  // Subscribe to all teams (for seat count and capacity in team selection)
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeAllTeams(roomId, (teams) => {
      setAllTeams(teams);
    });
    return () => unsub();
  }, [roomId]);

  // Subscribe to team
  useEffect(() => {
    if (!roomId || selectedTeam === null) return;
    const unsub = subscribeTeam(roomId, selectedTeam, (data) => {
      setTeamData(data);
    });
    return () => unsub();
  }, [roomId, selectedTeam]);

  // Subscribe to team inputs
  useEffect(() => {
    if (!roomId || selectedTeam === null) return;
    const unsub = subscribeTeamInputs(roomId, selectedTeam, (inputs) => {
      setTeamInputs(inputs);
    });
    return () => unsub();
  }, [roomId, selectedTeam]);

  // 라운드가 바뀌면 투표 초안을 처음 상태로 되돌린다
  useEffect(() => {
    if (!roomData) return;
    roundRef.current = roomData.round;
    setLevels({ bio: 0, agri: 0, ai: 0 });
    setAppropriate(0);
    setInvestigateChoice(null);
    setWantInvestigate(false);
    setWantRepair(false);
    setWorstPrediction('');
    setSubmitWarning(null);
  }, [roomData?.round]);

  // 이번 라운드에 이미 제출한 내 표만 화면에 복원한다 (새로고침 대비)
  useEffect(() => {
    if (selectedSeat === null || !roomData) return;
    const mine = teamInputs[selectedSeat];
    if (mine?.ballot && mine.submitted && mine.round === roomData.round) {
      setLevels(mine.ballot.levels);
      setAppropriate(mine.ballot.appropriate);
      setInvestigateChoice(mine.ballot.investigate);
      setWantInvestigate(!!mine.ballot.investigate);
      setWantRepair(mine.ballot.repair);
      setWorstPrediction(mine.ballot.worst || '');
    }
  }, [teamInputs, selectedSeat, roomData?.round]);

  // 모둠 및 출석번호 좌석 해제 후 다시 선택하기
  const handleReleaseAndResetSeat = async () => {
    if (roomId && selectedTeam !== null && selectedSeat !== null) {
      try {
        await releaseSeat(roomId, selectedTeam, selectedSeat);
      } catch (e) {
        console.error('Failed to release seat:', e);
      }
    }
    localStorage.removeItem('2075_student_session');
    setSelectedSeat(null);
    setSelectedTeam(null);
    setShowSeatChangeModal(false);
  };

  // Check room by code
  const handleFindRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!roomCodeInput.trim()) return;
    setIsJoining(true);
    try {
      const room = await findRoomByCode(roomCodeInput.trim());
      if (!room) {
        setJoinError('해당 방 코드의 수업을 찾을 수 없습니다.');
      } else {
        setRoomId(room.id);
        setRoomData(room);
        setSelectedClass(room.classNumber);
      }
    } catch (err: any) {
      setJoinError('방을 검색하는 중 오류가 발생했습니다.');
    } finally {
      setIsJoining(false);
    }
  };

  // Complete seat selection
  const handleSelectSeat = async (seatNum: number) => {
    if (!roomId || selectedTeam === null) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      const uid = auth.currentUser?.uid || getClientId();
      const res = await claimSeat(roomId, selectedTeam, seatNum, uid);
      if (!res?.success) {
        setJoinError(res?.message || '좌석 등록에 실패했습니다.');
        return;
      }
      setSelectedSeat(seatNum);
      localStorage.setItem(
        '2075_student_session',
        JSON.stringify({
          roomId,
          teamId: selectedTeam,
          seat: seatNum,
          classNumber: selectedClass,
        })
      );
    } catch (err: any) {
      console.error('Error claiming seat:', err);
      setJoinError('좌석 선택 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsJoining(false);
    }
  };

  // Submit Ballot
  const handleSubmitBallot = async () => {
    if (preview) return;
    if (!roomId || selectedTeam === null || selectedSeat === null) return;
    if (!worstPrediction.trim()) {
      setSubmitWarning('"이게 잘못되면 최악은?" 예측을 한 줄 이상 작성해야 제출할 수 있습니다!');
      return;
    }
    setSubmitWarning(null);
    setIsSubmitting(true);
    const uid = auth.currentUser?.uid || getClientId();
    const ballot: Ballot = {
      levels,
      appropriate,
      investigate: wantInvestigate ? investigateChoice ?? { domain: 'bio', level: 3 } : null,
      repair: wantRepair,
      worst: worstPrediction.trim(),
    };
    try {
      await submitStudentBallot(
        roomId,
        selectedTeam,
        selectedSeat,
        uid,
        roomData?.round || 1,
        ballot,
        true
      );
    } catch (err) {
      console.error('Failed to submit ballot:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const countdown = useCountdown(
    roomData?.timerExpiresAt,
    roomData?.timerPaused,
    roomData?.phase === 'voting' || roomData?.phase === 'revoting'
  );

  if (preview && !roomData) {
    return <div className="p-8 text-center text-sm text-slate-400">방 정보를 불러오는 중이에요... (방이 삭제됐다면 계속 이 화면이에요)</div>;
  }

  // 1. Join Wizard Step: Code Input
  if (!roomId || !roomData) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 md:p-8 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <ChromaImg
              name={'char_haru_normal'}
              alt="하루"
              className="w-28 h-28 rounded-2xl object-cover object-top border-2 border-emerald-500/50 mx-auto"
            />
            <h2 className="text-2xl font-black text-white">2075 지구 수업 입장</h2>
            <p className="text-xs text-slate-400">
              선생님 화면(교실 TV)에 표시된 4자리 방 코드를 입력하세요.
            </p>
          </div>

          <form onSubmit={handleFindRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">방 코드 (4자리 숫자)</label>
              <input
                type="text"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
                placeholder="예: 4921"
                className="w-full text-center text-3xl font-mono tracking-widest font-bold py-3 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            {joinError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining || !roomCodeInput.trim()}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer text-sm"
            >
              {isJoining ? '확인 중...' : '다음 단계로'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Join Wizard Step: Team Selection
  if (selectedTeam === null) {
    const maxSeats = roomData.maxSeatsPerTeam ?? 5;
    const myUid = auth.currentUser?.uid || getClientId();

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg p-6 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setRoomId(null)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" /> 코드 다시 입력
            </button>
            <span className="text-xs font-bold text-amber-400">방: {roomData.code}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">우리 모둠(국가) 선택</h2>
            <p className="text-xs text-slate-400">자신이 속한 모둠을 선택하세요. (모둠 정원: {maxSeats}명)</p>
          </div>

          {joinError && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300">
              {joinError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((tId) => {
              const team = allTeams[tId];
              const seats = team?.seats || {};
              const seatedCount = Object.keys(seats).length;
              const isAlreadyInThisTeam = Object.values(seats).some((s) => s.uid === myUid);
              const isFull = !isAlreadyInThisTeam && seatedCount >= maxSeats;

              return (
                <button
                  key={tId}
                  disabled={isFull}
                  onClick={() => {
                    setJoinError(null);
                    setSelectedTeam(tId);
                  }}
                  className={`p-4 rounded-xl text-center space-y-1.5 transition-all border ${
                    isFull
                      ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                      : 'bg-slate-800 hover:bg-emerald-950/60 hover:border-emerald-500/60 border-slate-700 cursor-pointer group'
                  }`}
                >
                  <div className={`text-2xl font-black ${isFull ? 'text-slate-600' : 'text-white group-hover:text-emerald-400'}`}>
                    {tId + 1}모둠
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    제{tId + 1}국
                  </div>
                  <div className="pt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        isFull
                          ? 'bg-red-950/80 text-red-400 border border-red-500/30'
                          : seatedCount > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {seatedCount} / {maxSeats}명 {isFull ? '(정원 마감)' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 3. Join Wizard Step: Seat Selection (출석번호 1~26)
  if (selectedSeat === null) {
    const occupiedSeats = teamData?.seats ? Object.keys(teamData.seats) : [];
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-xl p-6 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedTeam(null)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" /> 모둠 다시 선택
            </button>
            <span className="text-xs font-bold text-emerald-400">
              {selectedTeam + 1}모둠 (제{selectedTeam + 1}국)
            </span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">내 출석번호(좌석) 선택</h2>
            <p className="text-xs text-slate-400">
              자신의 출석번호를 선택하면 이 기기와 연동됩니다 (이름은 저장되지 않습니다).
            </p>
          </div>

          {joinError && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300">
              {joinError}
            </div>
          )}

          <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 p-1">
            {Array.from({ length: 26 }, (_, i) => i + 1).map((sNum) => {
              const isOccupied = occupiedSeats.includes(sNum.toString());
              return (
                <button
                  key={sNum}
                  disabled={isOccupied || isJoining}
                  onClick={() => handleSelectSeat(sNum)}
                  className={`py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isOccupied
                      ? 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700'
                  }`}
                >
                  {sNum}번
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 미리보기에서 단계를 직접 고르면 그 단계의 화면을 보여 준다
  const room: RoomData = phaseOverride ? { ...roomData, phase: phaseOverride } : roomData;

  // Parse GameState from room
  const gameState: GameState = importState(buildRoomConfig(room), room.gameStateJson);
  const myCountry = gameState.countries[selectedTeam];
  // 협약/사건 표는 이번 라운드에 누른 것만 인정한다 (지난 라운드 표가 눌린 채로 남아 보이는 문제 방지)
  const myUid = auth.currentUser?.uid || getClientId();
  const myInput = teamInputs[selectedSeat];
  const isSubmitted = !!myInput?.submitted && myInput.round === room.round;
  const submittedCount = Object.values(teamInputs).filter(
    (inp) => inp.submitted && inp.round === room.round
  ).length;
  const seatedCount = Object.keys(teamData?.seats || {}).length;

  const seatChangeModal = showSeatChangeModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
          <ArrowLeft className="w-5 h-5" />
          <span>모둠 / 출석번호 변경</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          현재 선택된 <strong className="text-emerald-400">제{selectedTeam + 1}국 {selectedSeat}번 좌석</strong>을 비우고 모둠 및 번호를 다시 선택하시겠습니까?
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setShowSeatChangeModal(false)}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={handleReleaseAndResetSeat}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow"
          >
            다시 선택하기
          </button>
        </div>
      </div>
    </div>
  );

  const statusBar = (
    <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
            제{selectedTeam + 1}국
          </span>
          <span className="text-xs text-slate-300 font-medium">출석번호 {selectedSeat}번</span>
          <button
            onClick={() => setShowSeatChangeModal(true)}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer ml-1"
            title="모둠이나 출석번호를 잘못 입력했을 때 변경"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>자리 변경</span>
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <strong className="text-amber-400">{room.round} / 5 라운드</strong>
        </div>
      </div>
      <Gauges stats={myCountry.stats} money={myCountry.money} shield={myCountry.shield} />
      {gameState.cfg.crisis?.enabled && (
        <CrisisSupportGauges
          pressure={myCountry.pressure}
          support={myCountry.support}
          demandedDomain={myCountry.demandedDomain}
          protested={myCountry.protested}
        />
      )}
    </div>
  );

  // Render Ending screens if in ending phases
  if (room.phase === 'earth_ending') {
    return (
      <>
        <EarthEndingView gameState={gameState} isTeacher={false} />
        {seatChangeModal}
      </>
    );
  }
  if (room.phase === 'court') {
    return (
      <>
        <CourtView
          gameState={gameState}
          isTeacher={false}
          initialCountry={selectedTeam}
          teamInputsMap={{ [selectedTeam]: teamInputs }}
          onFinish={() => {}}
        />
        {seatChangeModal}
      </>
    );
  }

  // 4. Finished Screen (수업 완료 - 학생 성찰지 작성 불필요)
  if (room.phase === 'finished' || room.phase === 'reflection') {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-4 text-white pb-16 animate-fade-in">
        <HaruCard mood="char_haru_cheer" title="오늘의 2075 지구 수업이 모두 끝났습니다!">
          6개 국가의 길었던 여정이 모두 마무리되었어. 오늘 우리가 내린 결정과 미래 세대 법정의 판결을 마음속에 담아가길 바라. 오늘 수업 참여하느라 정말 수고 많았어!
        </HaruCard>

        {statusBar}

        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-700 text-center space-y-3 shadow-xl">
          <p className="text-sm text-slate-300 leading-relaxed">
            선생님의 지도에 따라 오늘 수업 소감을 교실에서 친구들과 함께 나누어 보세요.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setShowSeatChangeModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>모둠 또는 좌석 다시 선택하기</span>
            </button>
          </div>
        </div>

        {seatChangeModal}
      </div>
    );
  }

  // In Lobby
  if (room.phase === 'lobby') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center space-y-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700 max-w-md w-full shadow-2xl space-y-4">
          <ChromaImg
            name={'char_haru_hopeful'}
            alt="하루"
            className="w-28 h-28 rounded-2xl object-cover object-top border-2 border-emerald-500/50 mx-auto"
          />
          <div>
            <span className="text-xs font-bold text-amber-400">
              {room.grade}학년 {room.classNumber}반
            </span>
            <h2 className="text-2xl font-black text-white mt-1">제{selectedTeam + 1}국 입장 완료!</h2>
            <p className="text-sm text-slate-300 mt-2">
              내 좌석: <strong className="text-emerald-400">{selectedSeat}번</strong>
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            지금 우리 모둠 <strong className="text-white">{seatedCount}명</strong> 입장
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
            <Clock className="w-4 h-4 text-emerald-400" />
            선생님이 게임을 시작할 때까지 잠시 기다려 주세요.
          </div>
          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowSeatChangeModal(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>모둠이나 번호 잘못 입력했으면 다시 선택 (뒤로가기)</span>
            </button>
          </div>
        </div>
        {seatChangeModal}
      </div>
    );
  }

  const myLocks = myCountry.locks || {};
  const isVotingPhase = room.phase === 'voting' || room.phase === 'revoting';
  const moneyHistory = myCountry.moneyHistory || [];
  const moneyDelta =
    moneyHistory.length >= 2 ? moneyHistory[moneyHistory.length - 1] - moneyHistory[moneyHistory.length - 2] : 0;

  const spend =
    CONFIG.domains.reduce((sum, dom) => sum + dom.cost[levels[dom.id]], 0) + CONFIG.appropriate.cost[appropriate];
  const remaining = Math.round(myCountry.money) - spend;

  // 인트로: 선생님 화면에서 하루가 이야기하는 중
  if (room.phase === 'intro') {
    return (
      <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white">
        <HaruCard mood="char_haru_normal" title="선생님 화면을 봐 줘!">
          지금 칠판(TV)에서 내가 2075년의 이야기를 들려주고 있어. 다 듣고 나면 우리 나라의 첫 투자를 정하게 될 거야.
        </HaruCard>
        {statusBar}
        {seatChangeModal}
      </div>
    );
  }

  // 피해 도착: 1라운드 전 선택의 대가
  if (room.phase === 'round_damage') {
    const arrived = gameState.harms.filter(
      (h) => h.to === selectedTeam && h.arrived && h.arrivalRound === room.round
    );
    return (
      <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white">
        <HaruCard
          mood={arrived.length ? 'char_haru_worried' : 'char_haru_hopeful'}
          title={arrived.length ? `${room.round}라운드 피해가 도착했어...` : `${room.round}라운드, 아직은 조용해!`}
          tone={arrived.length ? 'warn' : 'good'}
        >
          {arrived.length
            ? '1라운드 전에 내린 선택의 부작용이 지금 나타났어. 우리 나라는 어떻게 달라졌을까?'
            : room.round <= CONFIG.harmDelay
            ? '피해는 선택하고 1라운드 뒤에 도착해. 지금은 괜찮아 보여도 방심하면 안 돼!'
            : '이번 라운드에는 우리 나라에 도착한 피해가 없어.'}
        </HaruCard>

        {arrived.length > 0 && (() => {
          // 같은 사건은 한 장으로 묶는다 (여러 나라에서 번진 같은 피해가 줄줄이 나오지 않게)
          const groups = new Map<string, { ev: ReturnType<typeof findEvent>; froms: number[]; sum: Record<string, number> }>();
          for (const h of arrived) {
            const g = groups.get(h.eventId) ?? { ev: findEvent(CONFIG, h.eventId), froms: [], sum: {} };
            if (!g.froms.includes(h.from)) g.froms.push(h.from);
            for (const [k, v] of Object.entries(h.applied)) g.sum[k] = (g.sum[k] ?? 0) + v;
            groups.set(h.eventId, g);
          }
          const total: Record<string, number> = {};
          for (const g of groups.values()) for (const [k, v] of Object.entries(g.sum)) total[k] = (total[k] ?? 0) + v;
          const fmt = (m: Record<string, number>) =>
            Object.entries(m)
              .filter(([, v]) => v >= 0.05)
              .map(([k, v]) => `${AXIS_LABEL[k] ?? k} -${v >= 1 ? Math.round(v) : v.toFixed(1)}`)
              .join(' · ');
          return (
            <>
              <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-center">
                <div className="text-[11px] text-rose-300">이번 라운드에 줄어든 점수</div>
                <div className="text-lg font-black text-rose-200">{fmt(total) || '거의 없어요'}</div>
              </div>
              {[...groups.values()].map((g, i) => {
                const others = g.froms.filter((f) => f !== selectedTeam).map((f) => `제${f + 1}국`);
                const mine = g.froms.includes(selectedTeam);
                return (
                  <div key={i} className="p-4 bg-rose-950/50 border border-rose-500/40 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      <span className="break-keep">{g.ev?.title ?? '알 수 없는 피해'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-amber-300">
                      {[mine ? '우리 나라의 선택' : '', others.length ? `${others.join('·')}에서 번졌어요` : ''].filter(Boolean).join(' + ')}
                    </div>
                    {g.ev?.desc && <p className="text-xs text-slate-300 leading-relaxed break-keep">{g.ev.desc}</p>}
                    <div className="text-sm font-black text-rose-300">{fmt(g.sum)}</div>
                  </div>
                );
              })}
            </>
          );
        })()}

        {statusBar}
        <div className="text-center text-xs text-slate-400 animate-pulse">
          선생님이 다음 단계로 진행할 때까지 기다려 주세요.
        </div>
        {seatChangeModal}
      </div>
    );
  }

  // 국제 협약 표결 단계
  if (room.phase === 'treaty') {
    const treaty = gameState.currentTreaty;
    const myVote = myInput?.treatyVoteRound === room.round ? myInput.treatyVote : undefined;
    const teamTreatyVotes = Object.values(teamInputs).filter(
      (i) => i.treatyVote !== undefined && i.treatyVoteRound === room.round
    );
    const yesCount = teamTreatyVotes.filter((i) => i.treatyVote === true).length;
    const noCount = teamTreatyVotes.filter((i) => i.treatyVote === false).length;

    return (
      <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white animate-fade-in">
        <HaruCard mood="char_haru_serious" title="국제 협약 안건이 상정되었어!">
          지구 전체를 위한 규칙을 정하는 시간이야. 과반수(4개국 이상)가 찬성하면 협약이 비준되어 모든 나라에 적용돼!
        </HaruCard>

        {treaty ? (
          <div className="p-5 bg-slate-900/90 rounded-2xl border-2 border-indigo-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <SafeImg name="icon_treaty" fallbackEmoji="📜" className="w-12 h-12 object-contain flex-shrink-0" />
              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  제{room.round}라운드 국제 협약 안건
                </span>
                <h3 className="text-lg md:text-xl font-black text-white">{treaty.title}</h3>
                <p className="text-xs text-slate-400">{treaty.subtitle}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed break-keep">
              {treaty.desc}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">우리 모둠(제{selectedTeam + 1}국)의 표결:</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={!!preview}
                  onClick={async () => {
                    if (preview || selectedSeat === null) return;
                    await submitStudentTreatyVote(room.id, selectedTeam, selectedSeat, myUid, room.round, true);
                  }}
                  className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    myVote === true
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 ring-2 ring-emerald-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <SafeImg name="icon_vote_yes" fallbackEmoji="⭕" className="w-4 h-4 object-contain" />
                  <span>협약 찬성</span>
                </button>
                <button
                  disabled={!!preview}
                  onClick={async () => {
                    if (preview || selectedSeat === null) return;
                    await submitStudentTreatyVote(room.id, selectedTeam, selectedSeat, myUid, room.round, false);
                  }}
                  className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    myVote === false
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50 ring-2 ring-rose-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <SafeImg name="icon_vote_no" fallbackEmoji="❌" className="w-4 h-4 object-contain" />
                  <span>협약 반대</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between text-slate-400">
              <span>우리 모둠 투표 현황:</span>
              <div className="flex gap-3 font-bold">
                <span className="text-emerald-400">찬성 {yesCount}명</span>
                <span className="text-rose-400">반대 {noCount}명</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center text-sm text-slate-400">
            이번 라운드에는 상정된 국제 협약 안건이 없습니다.
          </div>
        )}

        {statusBar}
        <div className="text-center text-xs text-slate-400 animate-pulse">
          선생님이 협약 투표 결과를 집계하고 마감할 때까지 기다려 주세요.
        </div>
        {seatChangeModal}
      </div>
    );
  }

  // 돌발 사건 발생 단계
  if (room.phase === 'event') {
    const event = gameState.currentEvent;
    const myVote = myInput?.eventVoteRound === room.round ? myInput.eventVote : undefined;
    const teamEventVotes = Object.values(teamInputs).filter(
      (i) => i.eventVote && i.eventVoteRound === room.round
    );
    const voteCounts: Record<string, number> = {};
    if (event) {
      event.choices.forEach((c) => {
        voteCounts[c.id] = teamEventVotes.filter((i) => i.eventVote === c.id).length;
      });
    }

    const kindBadge =
      event?.kind === 'accident'
        ? { text: '🚨 사고 발생', class: 'bg-rose-950/80 text-rose-300 border-rose-500/50' }
        : event?.kind === 'discovery'
        ? { text: '💡 기술적 발견', class: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' }
        : { text: '🏜️ 기후·자원 재난', class: 'bg-amber-950/80 text-amber-300 border-amber-500/50' };

    return (
      <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white animate-fade-in">
        <HaruCard mood="char_haru_worried" title="예상치 못한 돌발 사건이 발생했어!">
          기술 발전과 지구 환경의 변화 속에서 돌발 상황이 벌어졌어. 우리 나라가 어떻게 대응할지 모둠원과 함께 선택해 줘!
        </HaruCard>

        {event ? (
          <div className="p-5 bg-slate-900/90 rounded-2xl border-2 border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${kindBadge.class}`}>
                  {kindBadge.text}
                </span>
                <h3 className="text-lg md:text-xl font-black text-white">{event.title}</h3>
              </div>
              <SafeImg
                name={event.kind === 'accident' ? 'scene_event_accident' : 'scene_event_discovery'}
                fallbackEmoji={event.kind === 'accident' ? '⚡' : '💡'}
                className="w-12 h-12 object-contain flex-shrink-0"
              />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed break-keep bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              {event.desc}
            </p>

            <div className="text-[11px] text-amber-300/90 font-medium">
              ℹ️ {event.effectDesc}
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-300">우리 모둠 대응책 투표:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {event.choices.map((choice) => {
                  const isSelected = myVote === choice.id;
                  const count = voteCounts[choice.id] || 0;
                  return (
                    <button
                      key={choice.id}
                      disabled={!!preview}
                      onClick={async () => {
                        if (preview || selectedSeat === null) return;
                        await submitStudentEventChoice(room.id, selectedTeam, selectedSeat, myUid, room.round, choice.id);
                      }}
                      className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-400 text-white shadow-lg ring-2 ring-amber-500/60'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-black text-sm text-amber-300">{choice.label}</div>
                        <p className="text-xs text-slate-300 leading-snug break-keep">{choice.desc}</p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/50">
                        <span className="font-semibold text-emerald-400">
                          {choice.effect.support ? `지지도 ${choice.effect.support > 0 ? '+' : ''}${choice.effect.support}% ` : ''}
                          {choice.effect.money ? `자금 ${choice.effect.money > 0 ? '+' : ''}${choice.effect.money}원 ` : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-bold">
                          우리 표: {count}명
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center text-sm text-slate-400">
            이번 라운드에는 발생한 돌발 사건이 없습니다.
          </div>
        )}

        {statusBar}
        <div className="text-center text-xs text-slate-400 animate-pulse">
          선생님이 사건 결과를 확정하고 기술 투표로 넘어갈 때까지 기다려 주세요.
        </div>
        {seatChangeModal}
      </div>
    );
  }

  // 라운드 결과
  if (room.phase === 'round_result') {
    const dec = teamData?.lastDecision;
    return (
      <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white">
        <HaruCard mood="char_haru_serious" title={`${room.round}라운드 결과가 나왔어!`}>
          우리 모둠이 다수결로 정한 선택이야. 혜택은 지금 오지만, 피해는 1라운드 뒤에 도착해.
        </HaruCard>

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl space-y-3">
          <h3 className="text-sm font-black text-white">우리 나라가 정한 투자</h3>
          {dec ? (
            <div className="grid grid-cols-2 gap-2">
              {CONFIG.domains.map((dom) => (
                <div key={dom.id} className="flex items-center gap-2 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                  <ChromaImg name={DOMAIN_ICON[dom.id]} alt="" className="w-9 h-9 object-contain" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">{dom.label}</div>
                    <div className="text-xs font-bold text-white break-keep">
                      {dec.levels[dom.id]}단계 · {dom.steps[dec.levels[dom.id]]?.name}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <ChromaImg name={'icon_appro'} alt="" className="w-9 h-9 object-contain" />
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">적정 기술</div>
                  <div className="text-xs font-bold text-white break-keep">
                    {dec.appropriate}단계 · {CONFIG.appropriate.steps[dec.appropriate]?.name}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">결과를 불러오는 중이에요...</p>
          )}

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="flex items-center gap-1 text-slate-400">
              <Coins className="w-4 h-4 text-amber-400" /> 이번 라운드 자금 변화
            </span>
            <strong className={moneyDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {moneyDelta >= 0 ? '+' : ''}
              {Math.round(moneyDelta)}
            </strong>
          </div>
        </div>

        {teamData?.lastInvestigation && (
          <div className="p-4 bg-indigo-950/60 border border-indigo-500/40 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <Eye className="w-4 h-4 text-indigo-400" />
              우리 모둠의 위험 조사 결과 (비밀 정보)
            </div>
            <p className="text-xs text-slate-300">
              미래 위험의 심각도: <strong className="text-amber-400">{teamData.lastInvestigation.severity}</strong> (영향 분야:{' '}
              {teamData.lastInvestigation.axes.map((a) => AXIS_LABEL[a] ?? a).join(', ') || '경미함'})
            </p>
          </div>
        )}

        {/* 선택 → 결과 인과 카드 */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-sm font-black text-white mb-2">📋 우리 선택의 결과</h3>
          <RoundReportCard country={myCountry} />
        </div>

        {/* 위기로 줄어든 수치 카드 */}
        {gameState.cfg.crisis?.enabled && (
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚠️</span>
                <span>방치된 위기로 줄어든 수치</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                누적 잃은 점수: <strong className="text-rose-400">-{Math.round(myCountry.lostToCrisis || 0)}점</strong>
              </span>
            </div>
            {myCountry.lastCrisisDamage && Object.keys(myCountry.lastCrisisDamage).length > 0 ? (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-1">
                <div className="text-xs font-bold text-rose-300">
                  임계값(40)을 넘은 배경 위기 압력으로 이번 라운드에 수치가 깎였습니다:
                </div>
                <div className="text-sm font-black text-rose-200">
                  {Object.entries(myCountry.lastCrisisDamage)
                    .map(([ax, val]) => `${AXIS_LABEL[ax] ?? ax} -${val}`)
                    .join(' · ')}
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-emerald-400 font-semibold">
                ✨ 이번 라운드에 위기 압력으로 잃은 수치가 없습니다 (모든 위기 40 이하로 관리됨).
              </div>
            )}
          </div>
        )}

        {/* 지지도 변화 사유 카드 */}
        {gameState.cfg.support?.enabled && (
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🏛️</span>
                <span>국민 지지도 변화 내역</span>
              </h4>
              <span className="text-xs font-bold font-mono text-white">
                현재 지지도: <strong className={myCountry.support < 40 ? 'text-rose-400' : 'text-emerald-400'}>{Math.round(myCountry.support)}%</strong>
              </span>
            </div>
            {myCountry.lastSupportReasons && myCountry.lastSupportReasons.length > 0 ? (
              <div className="space-y-1.5">
                {myCountry.lastSupportReasons.map((reason, idx) => (
                  <div key={idx} className="p-2 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-200">
                    {reason}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">이번 라운드에 특이 지지도 변동 사유가 없습니다.</p>
            )}
          </div>
        )}

        {statusBar}
        <div className="text-center text-xs text-slate-400 animate-pulse">선생님이 다음 라운드를 시작할 때까지 기다려 주세요.</div>
        {seatChangeModal}
      </div>
    );
  }

  // 투표
  return (
    <div className="w-full max-w-2xl mx-auto p-3 md:p-6 space-y-4 text-white pb-32">
      {statusBar}

      {isSubmitted ? (
        <HaruCard mood="char_haru_hopeful" title="투표 완료! 모둠원을 기다리는 중이야" tone="good">
          우리 모둠 {submittedCount} / {Math.max(seatedCount, submittedCount)}명이 제출했어. 선생님이 집계하면 결과가 나와.
        </HaruCard>
      ) : room.phase === 'revoting' ? (
        <HaruCard mood="char_haru_serious" title="표가 같아서 한 번 더 투표해!" tone="warn">
          모둠원과 의견을 맞춰 다시 골라 봐. 이미 제출했다면 선생님이 풀어 줘야 고칠 수 있어.
        </HaruCard>
      ) : (myCountry.frozen ?? 0) > 0 ? (
        <HaruCard mood="char_haru_worried" title="재정 파탄 직후라 이번 라운드는 투자할 수 없어!" tone="warn">
          빚을 못 갚아 나라 살림이 멈췄어. 이번 라운드는 신규 투자가 0단계로 고정돼. 다음 라운드부터 다시 시작할 수 있어.
        </HaruCard>
      ) : (
        <HaruCard mood="char_haru_serious" title="우리 나라, 어디에 투자할까?">
          단계가 높을수록 위기는 크게 줄지만 돈이 많이 들고 실패할 수도 있어(실패하면 비용 절반만 돌려받아). 자금이 한정돼 있으니 잘 나눠 써! 피해는 1라운드 뒤에 와.
        </HaruCard>
      )}

      {teamData?.lastInvestigation && (
        <div className="p-4 bg-indigo-950/60 border border-indigo-500/40 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
            <Eye className="w-4 h-4 text-indigo-400" />
            우리 모둠의 위험 조사 결과 (비밀 정보)
          </div>
          <p className="text-xs text-slate-300">
            미래 위험의 심각도: <strong className="text-amber-400">{teamData.lastInvestigation.severity}</strong> (영향 분야:{' '}
            {teamData.lastInvestigation.axes.map((a) => AXIS_LABEL[a] ?? a).join(', ') || '경미함'})
          </p>
        </div>
      )}

      <div className="space-y-3">
        {CONFIG.domains.map((dom) => {
          const currentLevel = levels[dom.id];
          const lockedLevel = myLocks[dom.id] ?? 0;
          // 기술 트리: 지금 가진 단계 + techStepLimit 까지만 선택 가능
          const myHeld = myCountry.held?.[dom.id]?.level ?? 0;
          const treeCap = myHeld + (CONFIG.techStepLimit ?? 99);
          const frozen = (myCountry.frozen ?? 0) > 0;
          const others = gameState.countries.filter((o) => o.id !== selectedTeam && (o.held?.[dom.id]?.level ?? 0) > 0);
          const topOther = others.reduce((m, o) => Math.max(m, o.held?.[dom.id]?.level ?? 0), 0);
          const royaltyDue = topOther > myHeld ? Math.round(dom.importFee * CONFIG.royaltyPerGap * (topOther - myHeld)) : 0;
          return (
            <div key={dom.id} className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 space-y-3">
              <div className="flex items-center gap-3">
                <ChromaImg name={DOMAIN_ICON[dom.id]} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base text-white">{dom.label}</div>
                  <div className="text-xs font-mono text-amber-400">
                    {currentLevel}단계 · {dom.cost[currentLevel]}원 · 성공 {Math.round((dom.success[currentLevel] ?? 1) * 100)}%
                  </div>
                </div>
              </div>

              {/* 기술 트리 현황 */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-950 text-emerald-300 font-bold">🌳 우리 보유 {myHeld}단계</span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300">
                  이번엔 최대 {Math.min(dom.steps.length - 1, treeCap)}단계까지
                </span>
                {others.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-sky-300">
                    다른 나라 최고 {topOther}단계 ({others.map((o) => `제${o.id + 1}국 ${o.held?.[dom.id]?.level}`).join(', ')})
                  </span>
                )}
                {royaltyDue > 0 && (
                  <span className="px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 font-bold">
                    💸 로열티 지출 약 {royaltyDue}원/라운드 (따라잡으면 줄어요)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {dom.steps.map((_, sIdx) => {
                  const overTree = sIdx > treeCap || (frozen && sIdx > 0);
                  const isLocked = sIdx < lockedLevel || overTree;
                  const isSelected = currentLevel === sIdx;
                  const reduction = gameState.cfg.crisis?.resolveReduction?.[sIdx] ?? 0;
                  const treatyCheck = isChoiceViolatingTreaties(gameState.activeTreaties, dom.id, sIdx);
                  const isTreatyLocked = treatyCheck.violated;
                  return (
                    <button
                      key={sIdx}
                      disabled={isLocked || isSubmitted || isTreatyLocked}
                      onClick={() => setLevels({ ...levels, [dom.id]: sIdx })}
                      className={`py-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        isLocked || isTreatyLocked
                          ? 'bg-slate-900/40 text-slate-600 border border-slate-900 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.04]'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <span className="text-sm">{sIdx}단계</span>
                      <span className="text-[10px] opacity-80">{dom.cost[sIdx]}원</span>
                      {isTreatyLocked ? (
                        <span className="text-[9px] text-rose-400 font-bold">협약 금지</span>
                      ) : gameState.cfg.crisis?.enabled && sIdx > 0 ? (
                        <span className="text-[9px] text-emerald-300 font-mono font-bold">-위기{reduction}</span>
                      ) : null}
                      {isLocked && <Lock className="w-3 h-3 text-red-500 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-slate-300 leading-relaxed break-keep bg-slate-950/60 rounded-lg p-2.5 space-y-1">
                <div>
                  <strong className="text-white">{dom.steps[currentLevel]?.name}</strong>
                  {dom.steps[currentLevel]?.desc ? ` — ${dom.steps[currentLevel].desc}` : ' — 투자하지 않아요'}
                </div>
                {gameState.cfg.crisis?.enabled && currentLevel > 0 && (
                  <div className="text-[11px] font-bold text-emerald-400">
                    ✨ 성공하면 {dom.label} 위기 약 {gameState.cfg.crisis.resolveReduction[currentLevel]} 감소
                  </div>
                )}
                {gameState.cfg.support?.enabled && myCountry.demandedDomain === dom.id && (
                  <div className="text-[11px] font-bold text-amber-400">
                    ⚠️ 국민이 이 영역의 위기 해결을 강력히 요구하고 있습니다 (1단계 이상 필수).
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-teal-500/30 space-y-3">
          <div className="flex items-center gap-3">
            <ChromaImg name={'icon_appro'} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-black text-base text-teal-300">적정 기술</div>
              <div className="text-xs font-mono text-teal-400">
                {appropriate}단계 · {CONFIG.appropriate.cost[appropriate]}원 · 피해를 줄이고 이웃과 나눠요
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CONFIG.appropriate.steps.map((_, aIdx) => (
              <button
                key={aIdx}
                disabled={isSubmitted}
                onClick={() => setAppropriate(aIdx)}
                className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  appropriate === aIdx
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50 scale-[1.04]'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <span className="text-sm">{aIdx}</span>
                <span className="text-[10px] opacity-80">{CONFIG.appropriate.cost[aIdx]}원</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-300 leading-relaxed break-keep bg-slate-950/60 rounded-lg p-2.5">
            <strong className="text-white">{CONFIG.appropriate.steps[appropriate]?.name}</strong>
            {CONFIG.appropriate.steps[appropriate]?.desc ? ` — ${CONFIG.appropriate.steps[appropriate].desc}` : ' — 투자하지 않아요'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 space-y-2">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-100 cursor-pointer">
            <input
              type="checkbox"
              disabled={isSubmitted}
              checked={wantInvestigate}
              onChange={(e) => {
                setWantInvestigate(e.target.checked);
                if (e.target.checked && !investigateChoice) setInvestigateChoice({ domain: 'bio', level: 3 });
              }}
              className="w-5 h-5 rounded"
            />
            <Search className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span className="break-keep">위험 사전 조사에 찬성해요 ({CONFIG.investigateCost}원)</span>
          </label>
          <p className="text-[11px] text-slate-400 pl-8">모둠 과반이 찬성하면 한 선택지의 미래 피해를 흐릿하게 미리 볼 수 있어요.</p>
          {wantInvestigate && (
            <div className="flex gap-2 text-sm pl-8">
              <select
                disabled={isSubmitted}
                value={investigateChoice?.domain || 'bio'}
                onChange={(e) =>
                  setInvestigateChoice({ domain: e.target.value as DomainId, level: investigateChoice?.level || 3 })
                }
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-200"
              >
                {CONFIG.domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select
                disabled={isSubmitted}
                value={investigateChoice?.level || 3}
                onChange={(e) =>
                  setInvestigateChoice({ domain: investigateChoice?.domain || 'bio', level: Number(e.target.value) })
                }
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-slate-200"
              >
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>
                    {l}단계
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 space-y-2">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-100 cursor-pointer">
            <input
              type="checkbox"
              disabled={isSubmitted}
              checked={wantRepair}
              onChange={(e) => setWantRepair(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <Wrench className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="break-keep">도착한 피해를 복구하는 데 찬성해요</span>
          </label>
          <p className="text-[11px] text-slate-400 pl-8">
            과반이 찬성하면 망가진 사회·생태를 고쳐요. 비용은 개발비의 약 {CONFIG.repairCostMult}배예요.
          </p>
        </div>

        <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl space-y-2">
          <label className="block text-sm font-bold text-amber-300 break-keep">
            "이게 잘못되면 최악은 뭘까?" 한 줄로 적어 줘 (필수)
          </label>
          <textarea
            rows={2}
            disabled={isSubmitted}
            value={worstPrediction}
            onChange={(e) => setWorstPrediction(e.target.value)}
            placeholder="예: 편집된 유전자가 대를 이어 퍼져서 빈부격차가 굳어질 것이다."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
          />
          <span className="text-[11px] text-slate-400 block">* 이 예측은 마지막 미래 세대 법정에서 우리의 책임을 따지는 증거가 돼요.</span>
        </div>

        {submitWarning && (
          <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300 font-bold">{submitWarning}</div>
        )}
      </div>

      {/* 하단 고정 바: 남은 돈 + 제출 */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800 px-3 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0 text-xs leading-tight">
            <div className="flex items-center gap-1 text-slate-400">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> 쓸 돈 <strong className="text-white">{spend}</strong> / 가진 돈{' '}
              <strong className="text-white">{Math.round(myCountry.money)}</strong>
            </div>
            <div className={remaining < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {remaining < 0 ? `${-remaining}원 모자라요! 일부 선택이 자동으로 낮아져요` : `남는 돈 ${remaining}`}
            </div>
            {countdown && (
              <div className="flex items-center gap-1 text-slate-400">
                <Timer className="w-3.5 h-3.5" /> 남은 시간 {countdown.label}
                {countdown.paused ? ' (멈춤)' : ''}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmitBallot}
            disabled={isSubmitting || isSubmitted || !isVotingPhase || !!preview}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {isSubmitted ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span>{isSubmitted ? '제출 완료' : preview ? '미리보기' : '최종 제출'}</span>
          </button>
        </div>
      </div>

      {/* 모둠 / 번호 변경 확인 모달 */}
      {seatChangeModal}
    </div>
  );
};
