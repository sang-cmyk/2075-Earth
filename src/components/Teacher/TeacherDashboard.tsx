import React, { useState, useEffect } from 'react';
import {
  createRoom,
  listRooms,
  deleteRoom,
  subscribeRoom,
  subscribeAllTeams,
  subscribeTeamInputs,
  updateRoom,
  updateTeam,
  releaseSeat,
  toggleAbsentSeat,
  unlockTeamVotes,
  submitStudentBallot,
} from '../../services/roomService.ts';
import type { RoomData, TeamData, StudentInputDoc } from '../../types/game.ts';
import { TeacherOverview } from './TeacherOverview.tsx';
import { CONFIG } from '../../game/config.ts';
import { buildRoomConfig } from '../../game/roomConfig.ts';
import {
  importState,
  exportState,
  beginRound,
  endRound,
  investigate,
  makeRng,
  repairable,
  resolveTreatyVote,
  applyEventChoices,
  type GameState,
  type Decision,
} from '../../game/engine.ts';
import { tally, recordBuried, type Ballot } from '../../game/vote.ts';
import { botBallot } from '../../game/bots.ts';
import { Gauges, CountryVisual, CrisisSupportGauges, getCountryCrisisBadge } from '../Gauges.tsx';
import { HaruGuide } from '../HaruGuide.tsx';
import { SafeImg } from '../SafeImg.tsx';
import { EarthEndingView } from '../Endings/EarthEndingView.tsx';
import { CourtView } from '../Endings/CourtView.tsx';
import { exportRoomCSV, exportRecordCardsZip } from './ExportService.ts';
import { TestModeModal } from './TestModeModal.tsx';
import { auth } from '../../firebase.ts';
import {
  loadTeacherEmails,
  saveTeacherEmails,
} from '../../utils/teacherAccess.ts';
import {
  Plus,
  Play,
  RotateCcw,
  Trash2,
  Users,
  Clock,
  Unlock,
  AlertOctagon,
  Download,
  Bot,
  Maximize2,
  Minimize2,
  Tv,
  ArrowRight,
  UserX,
  RefreshCw,
  Sparkles,
  FlaskConical,
  Smartphone,
  ShieldCheck,
  ChevronDown,
  X,
  Save,
  FastForward,
  SkipForward,
  ArrowLeft,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  // Archive states
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createGrade, setCreateGrade] = useState(2);
  const [createClass, setCreateClass] = useState(1);
  const [createTitle, setCreateTitle] = useState('');
  const [createMaxSeats, setCreateMaxSeats] = useState<number>(5);
  const [createIsTest, setCreateIsTest] = useState(false);
  const [createEnableCrisisSupport, setCreateEnableCrisisSupport] = useState(true);
  const [createEnableEvents, setCreateEnableEvents] = useState(true);
  const [createEnableTreaties, setCreateEnableTreaties] = useState(true);
  const [createEnableReflections, setCreateEnableReflections] = useState(false);
  const [createGameSpeedMode, setCreateGameSpeedMode] = useState<'standard' | 'quick'>('standard');
  const [createError, setCreateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Teacher email whitelist management states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [teacherEmails, setTeacherEmails] = useState<string[]>([]);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');

  // Room Deletion Confirmation Modal State
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test Mode Modal State
  const [isTestModeModalOpen, setIsTestModeModalOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Active Room states
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [teams, setTeams] = useState<Record<number, TeamData>>({});
  const [allInputs, setAllInputs] = useState<Record<number, Record<number, StudentInputDoc>>>({});
  const [focusedTeam, setFocusedTeam] = useState<number | null>(null);
  const [forceCloseConfirm, setForceCloseConfirm] = useState(false);
  const [seatManagerTeam, setSeatManagerTeam] = useState<number | null>(null);

  // Timer countdown
  const [timeLeft, setTimeLeft] = useState<number>(180);

  // Load rooms archive
  const fetchRooms = async () => {
    try {
      const list = await listRooms();
      setRooms(list.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error('Failed to list rooms:', err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // Subscribe to selected room
  useEffect(() => {
    if (!selectedRoomId) return;
    const unsubRoom = subscribeRoom(selectedRoomId, (data) => {
      setRoomData(data);
      if (!data) {
        setSelectedRoomId(null);
      }
    });

    const unsubTeams = subscribeAllTeams(selectedRoomId, (teamsData) => {
      setTeams(teamsData);
    });

    // Listen to inputs for all 6 teams
    const unsubs = [0, 1, 2, 3, 4, 5].map((tId) =>
      subscribeTeamInputs(selectedRoomId, tId, (teamInp) => {
        setAllInputs((prev) => ({ ...prev, [tId]: teamInp }));
      })
    );

    return () => {
      unsubRoom();
      unsubTeams();
      unsubs.forEach((u) => u());
    };
  }, [selectedRoomId]);

  // Timer interval
  useEffect(() => {
    if (!roomData || roomData.timerPaused || !roomData.timerExpiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((roomData.timerExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [roomData?.timerExpiresAt, roomData?.timerPaused]);

  // Load teacher emails on mount
  useEffect(() => {
    loadTeacherEmails().then((emails) => {
      setTeacherEmails(emails);
    });
  }, []);

  // Allowed emails management handlers
  const handleAddEmail = () => {
    const val = newEmailInput.trim().toLowerCase();
    if (!val || !val.includes('@')) {
      setConfigMessage({ type: 'error', text: '올바른 이메일 형식을 입력해 주세요.' });
      return;
    }
    if (teacherEmails.includes(val)) {
      setConfigMessage({ type: 'error', text: '이미 등록된 이메일입니다.' });
      return;
    }
    setTeacherEmails([...teacherEmails, val]);
    setNewEmailInput('');
    setConfigMessage(null);
  };

  const handleRemoveEmail = (email: string) => {
    const myEmail = auth.currentUser?.email?.trim().toLowerCase();
    if (myEmail && email.trim().toLowerCase() === myEmail) {
      setConfigMessage({ type: 'error', text: '본인은 삭제할 수 없습니다' });
      return;
    }
    setTeacherEmails(teacherEmails.filter((e) => e !== email));
    setConfigMessage(null);
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      await saveTeacherEmails(teacherEmails);
      setConfigMessage({ type: 'success', text: '교사 허용 이메일 목록이 저장되었습니다.' });
    } catch (err: any) {
      console.error('Failed to save config:', err);
      setConfigMessage({ type: 'error', text: '저장 중 오류가 발생했습니다: ' + (err?.message || '권한 부족') });
    } finally {
      setConfigSaving(false);
    }
  };

  // Handle Room Creation
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const email = auth.currentUser?.email;
    if (!email) {
      setCreateError('로그인이 필요합니다. 화면 상단에서 교사 구글 계정으로 로그인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      const rId = await createRoom(
        createGrade,
        createClass,
        createTitle,
        createIsTest,
        email,
        createMaxSeats,
        createEnableCrisisSupport,
        createEnableEvents,
        createEnableTreaties,
        createEnableReflections,
        createGameSpeedMode
      );
      if (rId) {
        setIsCreatingRoom(false);
        setSelectedRoomId(rId);
        await fetchRooms();
      } else {
        setCreateError('방 생성에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (err: any) {
      console.error('Create room error:', err);
      setCreateError(err?.message || '방 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Change room max seats per team dynamically
  const handleUpdateMaxSeats = async (newLimit: number) => {
    if (!selectedRoomId) return;
    const clamped = Math.min(5, Math.max(1, newLimit));
    try {
      await updateRoom(selectedRoomId, { maxSeatsPerTeam: clamped });
      showNotification(`모둠 정원이 ${clamped}명으로 변경되었습니다.`);
    } catch (err) {
      console.error('Failed to update maxSeatsPerTeam:', err);
    }
  };

  // Delete Room
  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    const id = roomToDelete;
    setDeleting(true);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (selectedRoomId === id) setSelectedRoomId(null);
    try {
      await deleteRoom(id);
      setRoomToDelete(null);
      await fetchRooms();
    } catch (err) {
      console.error('Delete room error:', err);
      await fetchRooms();
    } finally {
      setDeleting(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Bot Fill Empty Seats
  const handleFillBots = async () => {
    if (!roomData || !selectedRoomId) return;
    const currentRound = roomData.round || 1;
    const maxSeats = roomData.maxSeatsPerTeam ?? 5;
    const targetSeats = Array.from({ length: maxSeats }, (_, i) => i + 1);
    const writes: Promise<void>[] = [];
    for (let tId = 0; tId < 6; tId++) {
      const currentInputs = allInputs[tId] || {};
      const seated = teams[tId]?.seats || {};

      for (const sNum of targetSeats) {
        // 실제 학생이 앉아 있는 자리는 건드리지 않는다 (투표 중인 학생의 선택이 봇 표로 덮이면 눌렀던 게 풀려 버림)
        if (seated[sNum.toString()]) continue;
        if (!currentInputs[sNum] || !currentInputs[sNum].submitted || currentInputs[sNum].round !== currentRound) {
          const ballot = botBallot(CONFIG, sNum, currentRound);
          writes.push(submitStudentBallot(
            selectedRoomId,
            tId,
            sNum,
            `bot_${tId}_${sNum}`,
            currentRound,
            ballot,
            true
          ));
        }
      }
    }
    // 한꺼번에 보내서 기다린다
    await Promise.all(writes);
  };

  // Execute Tally for all 6 teams
  const executeTally = async (forced: boolean) => {
    if (!roomData || !selectedRoomId) return;
    const gameState: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);
    const rng = makeRng(roomData.seed + roomData.round * 100);
    const decisions: Decision[] = [];
    const teamWrites: Promise<void>[] = [];

    for (let tId = 0; tId < 6; tId++) {
      const country = gameState.countries[tId];
      const teamInps = allInputs[tId] || {};
      const team = teams[tId];
      const absentSet = new Set(roomData.absentSeats || []);

      // Filter valid ballots
      const ballots: Ballot[] = [];
      Object.values(teamInps).forEach((inp) => {
        const key = `${tId}-${inp.seat}`;
        if (!absentSet.has(key) && ((inp.submitted && inp.round === roomData.round) || forced) && inp.ballot) {
          ballots.push(inp.ballot);
        }
      });

      // If no ballots submitted, fallback to cautious bot ballot
      if (ballots.length === 0) {
        ballots.push(botBallot(CONFIG, 1, roomData.round));
      }

      const repairIdx = repairable(gameState, tId);
      const res = tally(CONFIG, country, ballots, repairIdx, forced || roomData.phase === 'revoting');

      // 동률은 vote.ts에서 무작위로 결정되므로 재투표를 하지 않는다

      // Record buried warnings
      recordBuried(country, res.decision, res.buried);

      // Investigation result if approved
      let invResult = null;
      if (res.decision.investigate) {
        invResult = investigate(
          CONFIG,
          res.decision.investigate.domain,
          res.decision.investigate.level
        );
      }

      decisions.push(res.decision);

      teamWrites.push(updateTeam(selectedRoomId, tId, {
        lastDecision: res.decision,
        lastTally: res,
        lastBuriedWarnings: res.buried,
        lastInvestigation: invResult,
        unlocked: false,
      }));
    }
    await Promise.all(teamWrites);

    // Execute round decisions in engine
    const sanitizedDecisions = endRound(gameState, decisions, rng);

    await updateRoom(selectedRoomId, {
      phase: 'round_result',
      gameStateJson: exportState(gameState),
      forcedTally: forced,
    });
  };

  // Phase Transition & Calculations
  const handleNextPhase = async () => {
    if (!roomData || !selectedRoomId) return;
    const gameState: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);

    // Flow: lobby -> intro -> round_damage -> [treaty] -> [event] -> voting -> round_result -> (loop or earth_ending) -> court -> [reflection] -> finished
    if (roomData.phase === 'lobby') {
      await updateRoom(selectedRoomId, { phase: 'intro' });
    } else if (roomData.phase === 'intro') {
      // Begin round 1 damage
      beginRound(gameState);
      await updateRoom(selectedRoomId, {
        phase: 'round_damage',
        gameStateJson: exportState(gameState),
      });
    } else if (roomData.phase === 'round_damage') {
      if (gameState.currentTreaty) {
        await updateRoom(selectedRoomId, { phase: 'treaty' });
      } else if (gameState.currentEvent) {
        await updateRoom(selectedRoomId, { phase: 'event' });
      } else {
        const votingSeconds = roomData.gameSpeedMode === 'quick' ? 120 : 180;
        const expiresAt = Date.now() + votingSeconds * 1000;
        await updateRoom(selectedRoomId, {
          phase: 'voting',
          timerExpiresAt: expiresAt,
          timerPaused: false,
        });
      }
    } else if (roomData.phase === 'treaty') {
      // Tally treaty votes from each country
      const votes: Record<number, boolean> = {};
      for (let tId = 0; tId < 6; tId++) {
        const teamInps = allInputs[tId] || {};
        const cur = Object.values(teamInps).filter((i) => i.treatyVoteRound === roomData.round);
        const yes = cur.filter((i) => i.treatyVote === true).length;
        const no = cur.filter((i) => i.treatyVote === false).length;
        // 아무도 투표하지 않았거나 동수이면 찬성으로 치지 않는다 (예전에는 0:0도 찬성으로 집계됐다)
        votes[tId] = yes > no;
      }
      const treatyRes = resolveTreatyVote(gameState, votes);
      showNotification(
        treatyRes.passed
          ? `📜 국제 협약 [${gameState.currentTreaty?.title}]이(가) 찬성 ${treatyRes.yesVotes.length}개국으로 가결되었습니다!`
          : `❌ 국제 협약 [${gameState.currentTreaty?.title}]이(가) 찬성 ${treatyRes.yesVotes.length}개국으로 부결되었습니다.`
      );

      if (gameState.currentEvent) {
        await updateRoom(selectedRoomId, {
          phase: 'event',
          gameStateJson: exportState(gameState),
        });
      } else {
        const votingSeconds = roomData.gameSpeedMode === 'quick' ? 120 : 180;
        const expiresAt = Date.now() + votingSeconds * 1000;
        await updateRoom(selectedRoomId, {
          phase: 'voting',
          timerExpiresAt: expiresAt,
          timerPaused: false,
          gameStateJson: exportState(gameState),
        });
      }
    } else if (roomData.phase === 'event') {
      // Apply event choices
      const choices: Record<number, string> = {};
      const ev = gameState.currentEvent;
      if (ev) {
        for (let tId = 0; tId < 6; tId++) {
          const teamInps = allInputs[tId] || {};
          const counts: Record<string, number> = {};
          Object.values(teamInps).forEach((i) => {
            if (i.eventVote && i.eventVoteRound === roomData.round) counts[i.eventVote] = (counts[i.eventVote] || 0) + 1;
          });
          let bestChoice = ev.choices[0].id;
          let maxCount = -1;
          for (const c of ev.choices) {
            const count = counts[c.id] || 0;
            if (count > maxCount) {
              maxCount = count;
              bestChoice = c.id;
            }
          }
          choices[tId] = bestChoice;
        }
        applyEventChoices(gameState, choices);
        showNotification(`돌발 사건 [${ev.title}] 대응 결과가 반영되었습니다.`);
      }

      const votingSeconds = roomData.gameSpeedMode === 'quick' ? 120 : 180;
      const expiresAt = Date.now() + votingSeconds * 1000;
      await updateRoom(selectedRoomId, {
        phase: 'voting',
        timerExpiresAt: expiresAt,
        timerPaused: false,
        gameStateJson: exportState(gameState),
      });
    } else if (roomData.phase === 'voting' || roomData.phase === 'revoting') {
      // Tally votes for all 6 teams
      await executeTally(false);
    } else if (roomData.phase === 'round_result') {
      if (roomData.round < CONFIG.rounds) {
        const nextRound = roomData.round + 1;
        beginRound(gameState);
        await updateRoom(selectedRoomId, {
          round: nextRound,
          phase: 'round_damage',
          gameStateJson: exportState(gameState),
        });
      } else {
        await updateRoom(selectedRoomId, { phase: 'earth_ending' });
      }
    } else if (roomData.phase === 'earth_ending') {
      await updateRoom(selectedRoomId, { phase: 'court' });
    } else if (roomData.phase === 'court') {
      await updateRoom(selectedRoomId, { phase: 'finished' });
    }
  };

  // Go to Previous Phase (교사 이전 단계 / 뒤로가기)
  const handlePrevPhase = async () => {
    if (!roomData || !selectedRoomId) return;
    const gameState: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);

    if (roomData.phase === 'finished') {
      await updateRoom(selectedRoomId, { phase: 'court' });
    } else if (roomData.phase === 'court') {
      await updateRoom(selectedRoomId, { phase: 'earth_ending' });
    } else if (roomData.phase === 'earth_ending') {
      await updateRoom(selectedRoomId, { phase: 'round_result' });
    } else if (roomData.phase === 'round_result') {
      const votingSeconds = roomData.gameSpeedMode === 'quick' ? 120 : 180;
      await updateRoom(selectedRoomId, {
        phase: 'voting',
        timerExpiresAt: Date.now() + votingSeconds * 1000,
        timerPaused: false,
      });
    } else if (roomData.phase === 'revoting') {
      const votingSeconds = roomData.gameSpeedMode === 'quick' ? 120 : 180;
      await updateRoom(selectedRoomId, {
        phase: 'voting',
        timerExpiresAt: Date.now() + votingSeconds * 1000,
        timerPaused: false,
      });
    } else if (roomData.phase === 'voting') {
      if (gameState.currentEvent) {
        await updateRoom(selectedRoomId, { phase: 'event' });
      } else if (gameState.currentTreaty) {
        await updateRoom(selectedRoomId, { phase: 'treaty' });
      } else {
        await updateRoom(selectedRoomId, { phase: 'round_damage' });
      }
    } else if (roomData.phase === 'event') {
      if (gameState.currentTreaty) {
        await updateRoom(selectedRoomId, { phase: 'treaty' });
      } else {
        await updateRoom(selectedRoomId, { phase: 'round_damage' });
      }
    } else if (roomData.phase === 'treaty') {
      await updateRoom(selectedRoomId, { phase: 'round_damage' });
    } else if (roomData.phase === 'round_damage') {
      if (roomData.round > 1) {
        await updateRoom(selectedRoomId, {
          round: roomData.round - 1,
          phase: 'round_result',
        });
      } else {
        await updateRoom(selectedRoomId, { phase: 'intro' });
      }
    } else if (roomData.phase === 'intro') {
      await updateRoom(selectedRoomId, { phase: 'lobby' });
    }
    showNotification('이전 단계로 되돌아갔습니다.');
  };

  // Skip Current Phase
  const handleSkipPhase = async () => {
    if (!roomData || !selectedRoomId) return;
    if (roomData.phase === 'voting' || roomData.phase === 'revoting') {
      await executeTally(true);
      showNotification('투표 단계를 마감하고 라운드 결과로 건너뛰었습니다.');
    } else {
      await handleNextPhase();
      showNotification('현재 단계를 건너뛰었습니다.');
    }
  };

  // Skip Current Round
  const handleSkipRound = async () => {
    if (!roomData || !selectedRoomId) return;
    if (roomData.phase !== 'round_result' && roomData.phase !== 'earth_ending' && roomData.phase !== 'court' && roomData.phase !== 'finished') {
      await executeTally(true);
    }

    if (roomData.round < CONFIG.rounds) {
      const nextRound = roomData.round + 1;
      const latestState = importState(buildRoomConfig(roomData), roomData.gameStateJson);
      beginRound(latestState);
      await updateRoom(selectedRoomId, {
        round: nextRound,
        phase: 'round_damage',
        gameStateJson: exportState(latestState),
      });
      showNotification(`${roomData.round}라운드를 건너뛰고 ${nextRound}라운드로 진행합니다.`);
    } else {
      await updateRoom(selectedRoomId, { phase: 'earth_ending' });
      showNotification('모든 라운드를 마치고 엔딩 화면으로 이동했습니다.');
    }
  };

  // Timer controls
  const handleExtendTimer = async () => {
    if (!roomData || !selectedRoomId) return;
    const newExpires = (roomData.timerExpiresAt || Date.now()) + 60 * 1000;
    await updateRoom(selectedRoomId, { timerExpiresAt: newExpires });
  };

  const handleToggleTimer = async () => {
    if (!roomData || !selectedRoomId) return;
    await updateRoom(selectedRoomId, { timerPaused: !roomData.timerPaused });
  };

  // Unlock voting for all teams
  const handleUnlockAll = async () => {
    if (!selectedRoomId) return;
    await Promise.all([0, 1, 2, 3, 4, 5].map((t) => unlockTeamVotes(selectedRoomId, t)));
    showNotification('모든 모둠의 투표 잠금이 해제되었습니다 (추천 상태로 돌아감).');
  };

  // 1. Room Archive View
  if (!selectedRoomId || !roomData) {
    return (
      <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in text-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white">수업 기록 보관함</h2>
            <p className="text-sm text-slate-400 mt-1">
              반별 2075 지구 수업을 개설하거나 이전 수업 기록을 이어합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>교사 허용 이메일</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isConfigOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => setIsCreatingRoom(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>새 수업 만들기</span>
            </button>
          </div>
        </div>

        {/* Collapsible Teacher Allowed Emails Panel */}
        {isConfigOpen && (
          <div className="p-5 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>교사 허용 이메일 관리 (Firestore: config/teachers)</span>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {configMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  configMessage.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/80 border border-red-500/50 text-red-300'
                }`}
              >
                {configMessage.text}
              </div>
            )}

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">허용된 교사 구글 계정</h4>
                <p className="text-[11px] text-slate-400">지정한 이메일과 일치하는 구글 계정에만 교사 권한을 부여합니다 (도메인 단위 허용 없음).</p>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                {teacherEmails.map((em) => (
                  <span
                    key={em}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300"
                  >
                    {em}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(em)}
                      className="text-slate-400 hover:text-red-400 cursor-pointer"
                      title="이메일 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {teacherEmails.length === 0 && (
                  <span className="text-xs text-slate-500 italic">등록된 교사 이메일이 없습니다.</span>
                )}
              </div>

              <div className="flex gap-2 pt-1 max-w-md">
                <input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  placeholder="예: teacher@school.kr"
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                * 설정은 Firestore의 `config/teachers` 문서에 저장되며 변경 즉시 모든 교사 권한 판별에 적용됩니다.
              </span>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{configSaving ? '저장 중...' : '설정 저장'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {isCreatingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">새 수업 방 개설</h3>
              {!auth.currentUser?.email && (
                <div className="p-3 bg-amber-950/80 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-medium">
                  수업 방을 개설하려면 상단에서 교사 계정으로 로그인이 필요합니다.
                </div>
              )}
              {createError && (
                <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">학년</label>
                    <select
                      value={createGrade}
                      onChange={(e) => setCreateGrade(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    >
                      <option value={1}>1학년</option>
                      <option value={2}>2학년</option>
                      <option value={3}>3학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">반</label>
                    <select
                      value={createClass}
                      onChange={(e) => setCreateClass(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map((c) => (
                        <option key={c} value={c}>{c}반</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">수업 제목 (선택)</label>
                    <input
                      type="text"
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="예: 2학년 3반 도덕 1차시"
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">모둠 정원 (1~5명)</label>
                    <select
                      value={createMaxSeats}
                      onChange={(e) => setCreateMaxSeats(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}명 {n === 5 ? '(기본 5명)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Game Speed Mode */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">진행 시간 모드</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateGameSpeedMode('standard')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        createGameSpeedMode === 'standard'
                          ? 'bg-emerald-950/80 border-emerald-500 text-white font-bold ring-1 ring-emerald-500'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs">⏱️ 표준 모드 (45~50분)</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">투표 180초 · 협약 2회 · 표준 진행</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateGameSpeedMode('quick')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        createGameSpeedMode === 'quick'
                          ? 'bg-amber-950/80 border-amber-500 text-white font-bold ring-1 ring-amber-500'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs">⚡ 빠른 모드 (35~40분)</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">투표 120초 · 협약 1회 · 시간 단축</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      id="enableCrisisSupport"
                      checked={createEnableCrisisSupport}
                      onChange={(e) => setCreateEnableCrisisSupport(e.target.checked)}
                      className="rounded text-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="enableCrisisSupport" className="text-slate-300 font-medium cursor-pointer">
                      배경 위기 및 국민 지지도 룰 (방치 시 위기 악화)
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      id="enableTreaties"
                      checked={createEnableTreaties}
                      onChange={(e) => setCreateEnableTreaties(e.target.checked)}
                      className="rounded text-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="enableTreaties" className="text-slate-300 font-medium cursor-pointer">
                      국제 협약 표결 룰 (6개국 과반수로 고위험 기술 금지)
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      id="enableEvents"
                      checked={createEnableEvents}
                      onChange={(e) => setCreateEnableEvents(e.target.checked)}
                      className="rounded text-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="enableEvents" className="text-slate-300 font-medium cursor-pointer">
                      돌발 사건 룰 (실험실 사고·발견·재난에 대응 선택)
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      id="isTest"
                      checked={createIsTest}
                      onChange={(e) => setCreateIsTest(e.target.checked)}
                      className="rounded text-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="isTest" className="text-slate-300 font-medium cursor-pointer">
                      테스트 모드 (봇으로 바로 시뮬레이션)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRoom(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                  >
                    {loading ? '생성 중...' : '방 생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Room List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((rm) => (
            <div
              key={rm.id}
              className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-xl space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-amber-400 font-mono font-bold text-xs">
                    코드: {rm.code}
                  </span>
                  {rm.isTest && (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                      테스트 방
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white">{rm.title}</h3>
                <p className="text-xs text-slate-400">
                  {rm.grade}학년 {rm.classNumber}반 | 진행 라운드: {rm.round}R ({rm.phase})
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  onClick={() => setRoomToDelete(rm.id)}
                  title="수업 삭제"
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setSelectedRoomId(rm.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>수업 입장 / 이어하기</span>
                </button>
              </div>
            </div>
          ))}

          {rooms.length === 0 && (
            <div className="col-span-full p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
              <Tv className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">아직 개설된 수업이 없습니다.</p>
              <button
                onClick={() => setIsCreatingRoom(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 첫 수업 방 개설하기
              </button>
            </div>
          )}
        </div>

        {/* Room Delete Confirmation Modal */}
        {roomToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm p-6 bg-slate-900 border border-red-500/50 rounded-2xl shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <span>수업 방 삭제 확인</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                이 수업 방과 관련된 모든 모둠 데이터, 투표 기록이 영구히 삭제됩니다. 정말 삭제하시겠습니까?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRoomToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={confirmDeleteRoom}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer"
                >
                  {deleting ? '삭제 중...' : '영구 삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Parse GameState
  const gameState: GameState = importState(buildRoomConfig(roomData), roomData.gameStateJson);

  // 2. Active Room Dashboard (TV optimized)
  return (
    <div className="w-full max-w-7xl mx-auto p-3 md:p-6 space-y-6 text-white pb-32">
      {/* Top TV Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedRoomId(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
            title="수업 보관함 목록으로 나가기"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>수업 목록으로</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400">{roomData.title}</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-bold text-amber-400">
                {roomData.grade}학년 {roomData.classNumber}반
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-2xl md:text-3xl font-black font-mono text-amber-300 tracking-wider">
                방 코드: {roomData.code}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-xs font-bold">
                {roomData.round} / 5 라운드
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">정원:</span>
                <select
                  value={roomData.maxSeatsPerTeam ?? 5}
                  onChange={(e) => handleUpdateMaxSeats(Number(e.target.value))}
                  className="bg-slate-900 text-amber-400 font-bold rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none cursor-pointer"
                  title="모둠별 정원 변경 (1~5명)"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}명</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Phase & Timer Display */}
        <div className="flex items-center gap-3">
          {roomData.phase === 'voting' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-base text-white">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
              <button
                onClick={handleExtendTimer}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200"
              >
                +1분
              </button>
              <button
                onClick={handleToggleTimer}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200"
              >
                {roomData.timerPaused ? '재개' : '멈춤'}
              </button>
            </div>
          )}

          {/* Fill Bots Button */}
          <button
            onClick={handleFillBots}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-400/30 text-xs font-bold transition-all cursor-pointer"
            title="빈 자리를 봇 투표로 즉시 채웁니다 (테스트용)"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">테스트 봇 채우기</span>
          </button>

          {/* 학생 화면 미리보기 */}
          <button
            onClick={() => setPreviewTeam(0)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 border border-sky-400/40 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>학생 화면 미리보기</span>
          </button>

          {/* Test Mode Button - only visible for Test Rooms */}
          {roomData.isTest && (
            <button
              onClick={() => setIsTestModeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/40 text-xs font-black text-white shadow-lg transition-all cursor-pointer transform hover:scale-105"
            >
              <FlaskConical className="w-4 h-4 text-purple-200" />
              <span>교사 점검 모드</span>
            </button>
          )}

          {/* Export Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => exportRoomCSV(roomData, gameState)}
              title="CSV 내보내기"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportRecordCardsZip(roomData, gameState, allInputs)}
              title="1920x1080 기록 카드 ZIP 다운로드"
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400"
            >
              ZIP 카드
            </button>
          </div>
        </div>
      </div>

      {/* Main Screen Content based on phase */}
      {roomData.phase === 'intro' ? (
        <div className="space-y-6">
          <HaruGuide onComplete={handleNextPhase} />
        </div>
      ) : roomData.phase === 'treaty' ? (
        <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
          {gameState.currentTreaty ? (
            <div className="p-6 md:p-8 bg-slate-900/90 rounded-3xl border-2 border-indigo-500/50 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-4">
                  <SafeImg name="icon_treaty" fallbackEmoji="📜" className="w-16 h-16 object-contain flex-shrink-0" />
                  <div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-950 text-indigo-400 border border-indigo-500/40 uppercase">
                      제{roomData.round}라운드 국제 협약 안건 상정
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
                      {gameState.currentTreaty.title}
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">{gameState.currentTreaty.subtitle}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400">비준 정족수</span>
                  <span className="text-2xl font-black text-indigo-300 font-mono">
                    4 / 6 개국 찬성 필요
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-sm text-slate-200 leading-relaxed break-keep">
                {gameState.currentTreaty.desc}
              </div>

              {/* 6 Countries Live Voting Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  각국 표결 진행 현황 (모둠원 다수결)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((tId) => {
                    const teamInps = allInputs[tId] || {};
                    const votes = Object.values(teamInps).filter(
                      (i) => i.treatyVote !== undefined && i.treatyVoteRound === roomData.round
                    );
                    const yes = votes.filter((i) => i.treatyVote === true).length;
                    const no = votes.filter((i) => i.treatyVote === false).length;
                    const isYesLeaning = yes >= no && yes > 0;
                    const isNoLeaning = no > yes;

                    return (
                      <div
                        key={tId}
                        className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                          isYesLeaning
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : isNoLeaning
                            ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/30'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="text-xs font-black text-white">제{tId + 1}국</div>
                        <div className="text-lg font-black">
                          {isYesLeaning ? (
                            <span className="text-emerald-400">찬성</span>
                          ) : isNoLeaning ? (
                            <span className="text-rose-400">반대</span>
                          ) : (
                            <span className="text-slate-500 text-xs">투표 중</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          찬 {yes} · 반 {no}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>학생 기기에서 실시간으로 찬반 투표를 진행하고 있습니다.</span>
                <button
                  onClick={handleNextPhase}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
                >
                  표결 결과 마감 및 다음으로
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400">
              이번 라운드에 상정된 국제 협약 안건이 없습니다.
            </div>
          )}
        </div>
      ) : roomData.phase === 'event' ? (
        <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
          {gameState.currentEvent ? (
            <div className="p-6 md:p-8 bg-slate-900/90 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-4">
                  <SafeImg
                    name={gameState.currentEvent.kind === 'accident' ? 'scene_event_accident' : 'scene_event_discovery'}
                    fallbackEmoji={gameState.currentEvent.kind === 'accident' ? '⚡' : '💡'}
                    className="w-16 h-16 object-contain flex-shrink-0"
                  />
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                      gameState.currentEvent.kind === 'accident'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                        : gameState.currentEvent.kind === 'discovery'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                        : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                    }`}>
                      {gameState.currentEvent.kind === 'accident'
                        ? '🚨 돌발 기술 사고 발생'
                        : gameState.currentEvent.kind === 'discovery'
                        ? '💡 뜻밖의 기술적 발견'
                        : '🏜️ 기후 및 자원 재난'}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
                      {gameState.currentEvent.title}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-sm text-slate-200 leading-relaxed break-keep">
                {gameState.currentEvent.desc}
              </div>

              {/* Choices comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState.currentEvent.choices.map((c, idx) => (
                  <div key={c.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">선택지 {idx + 1}</span>
                      <span className="text-xs font-bold text-slate-400">{c.label}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>

              {/* 6 Countries Live Decision Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  각국의 대응 결정 현황
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((tId) => {
                    const teamInps = allInputs[tId] || {};
                    const votes = Object.values(teamInps).filter(
                      (i) => i.eventVote && i.eventVoteRound === roomData.round
                    );
                    const counts: Record<string, number> = {};
                    votes.forEach((i) => {
                      if (i.eventVote) counts[i.eventVote] = (counts[i.eventVote] || 0) + 1;
                    });
                    const ev = gameState.currentEvent!;
                    let topChoice = ev.choices[0];
                    let maxV = -1;
                    ev.choices.forEach((c) => {
                      const count = counts[c.id] || 0;
                      if (count > maxV) {
                        maxV = count;
                        topChoice = c;
                      }
                    });

                    return (
                      <div key={tId} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-1">
                        <div className="text-xs font-bold text-white">제{tId + 1}국</div>
                        <div className="text-xs font-black text-amber-400 truncate" title={topChoice.label}>
                          {votes.length > 0 ? topChoice.label : '논의 중'}
                        </div>
                        <div className="text-[10px] text-slate-500">투표 {votes.length}명</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>모둠별로 최적의 결정을 선택하고 있습니다.</span>
                <button
                  onClick={handleNextPhase}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
                >
                  사건 결과 반영 및 투표 시작
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400">
              이번 라운드에 발생한 돌발 사건이 없습니다.
            </div>
          )}
        </div>
      ) : roomData.phase === 'earth_ending' ? (
        <EarthEndingView
          gameState={gameState}
          isTeacher={true}
          onProceedToCourt={() => updateRoom(selectedRoomId, { phase: 'court' })}
        />
      ) : roomData.phase === 'court' ? (
        <CourtView
          gameState={gameState}
          isTeacher={true}
          teamInputsMap={allInputs}
          onFinish={() => updateRoom(selectedRoomId, { phase: 'finished' })}
        />
      ) : roomData.phase === 'finished' ? (
        <div className="w-full max-w-4xl mx-auto p-8 text-center bg-slate-900/90 rounded-3xl border border-slate-700 shadow-2xl space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-3xl">
            🌍
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white">2075 지구 수업이 모두 종료되었습니다</h2>
            <p className="text-sm text-slate-400">
              학생들과 함께 나눈 생명·식량·인공지능 기술의 미래와 책임에 대해 이야기해 보세요.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-4">
            <button
              onClick={() => exportRoomCSV(roomData, gameState)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>전체 결과 및 성찰지 CSV 다운로드</span>
            </button>
            <button
              onClick={() => setSelectedRoomId(null)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>보관함 목록으로 나가기</span>
            </button>
          </div>
        </div>
      ) : (
        <>
        <TeacherOverview gameState={gameState} roomData={roomData} teams={teams} allInputs={allInputs} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((tId) => {
            const country = gameState.countries[tId];
            const team = teams[tId];
            const teamInps = allInputs[tId] || {};
            const seatedCount = Object.keys(team?.seats || {}).length;
            const submittedCount = Object.values(teamInps).filter((i) => i.submitted && i.round === roomData.round).length;
            const isAllSubmitted = seatedCount > 0 && submittedCount >= seatedCount;
            const badges = gameState.cfg.crisis?.enabled ? getCountryCrisisBadge(country.pressure, country.support) : null;

            return (
              <div
                key={tId}
                className={`relative p-4 rounded-2xl border transition-all shadow-xl space-y-3 flex flex-col justify-between ${
                  isAllSubmitted
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-black text-white flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                      제{tId + 1}국 ({tId + 1}모둠)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">
                        제출: {submittedCount} / {Math.max(seatedCount, submittedCount)}명
                      </span>
                      <button
                        onClick={() => setFocusedTeam(tId)}
                        title="전체 화면 발표 모드"
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Country Visual Artwork & Overlays */}
                  <CountryVisual countryId={tId} stats={country.stats} className="h-28 mb-3" />

                  {/* Gauges */}
                  <Gauges stats={country.stats} money={country.money} shield={country.shield} compact={true} />

                  {/* Crisis & Support Badges (Qualitative for other teams) */}
                  {badges && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold">
                      <span className={`px-2 py-0.5 rounded border ${badges.crisisClass}`}>
                        위기: {badges.crisisStatus}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${badges.supportClass}`}>
                        지지도: {badges.supportStatus}
                      </span>
                    </div>
                  )}
                </div>

                {/* Team Controls */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setSeatManagerTeam(tId)}
                    className="flex items-center gap-1 text-slate-400 hover:text-emerald-400"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>좌석 관리 ({seatedCount}명)</span>
                  </button>

                  {team?.lastInvestigation && (
                    <span className="text-[10px] text-indigo-400 font-semibold">
                      조사 완료: {team.lastInvestigation.severity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Fullscreen Presentation Modal (발표 모드) */}
      {focusedTeam !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-4xl p-8 bg-slate-900 border-2 border-emerald-500/50 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-emerald-400">
                제{focusedTeam + 1}국 집중 발표 모드
              </h2>
              <button
                onClick={() => setFocusedTeam(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <CountryVisual
              countryId={focusedTeam}
              stats={gameState.countries[focusedTeam].stats}
              className="h-64"
            />

            <Gauges
              stats={gameState.countries[focusedTeam].stats}
              money={gameState.countries[focusedTeam].money}
              shield={gameState.countries[focusedTeam].shield}
            />

            {gameState.cfg.crisis?.enabled && gameState.countries[focusedTeam].pressure && (
              <CrisisSupportGauges
                pressure={gameState.countries[focusedTeam].pressure}
                support={gameState.countries[focusedTeam].support ?? 50}
                demandedDomain={gameState.countries[focusedTeam].demandedDomain}
                protested={gameState.countries[focusedTeam].protested}
              />
            )}

            {/* Worst Predictions submitted by students */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                모둠원들이 작성한 최악의 시나리오 예측:
              </h4>
              <div className="space-y-1 text-sm text-slate-200">
                {Object.values(allInputs[focusedTeam] || {})
                  .filter((inp) => inp.ballot?.worst)
                  .map((inp, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded-lg">
                      {inp.seat}번 학생: "{inp.ballot.worst}"
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seat Manager Modal (좌석 해제 / 결석 처리) */}
      {seatManagerTeam !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                제{seatManagerTeam + 1}국 좌석 및 결석 관리
              </h3>
              <button
                onClick={() => setSeatManagerTeam(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>

            <p className="text-xs text-slate-400">
              기기 변경이나 잘못 입장한 학생의 좌석을 해제하거나, 결석 학생을 투표 인원에서 제외합니다.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {Object.entries(teams[seatManagerTeam]?.seats || {}).map(([sNum, sInfo]) => {
                const key = `${seatManagerTeam}-${sNum}`;
                const isAbsent = (roomData.absentSeats || []).includes(key);

                return (
                  <div
                    key={sNum}
                    className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{sNum}번 출석번호</span>
                      {isAbsent && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-red-950 text-red-400 text-[10px] font-bold">
                          결석 처리됨
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAbsentSeat(selectedRoomId, key)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          isAbsent
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-red-950 text-red-400 hover:bg-red-900'
                        }`}
                      >
                        {isAbsent ? '출석 복원' : '결석 처리'}
                      </button>
                      <button
                        onClick={() => releaseSeat(selectedRoomId, seatManagerTeam, Number(sNum))}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        좌석 해제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Force Close Confirmation Modal */}
      {forceCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-red-500/60 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-base">
              <AlertOctagon className="w-6 h-6" />
              <span>강제 마감 확인</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              아직 제출하지 않은 학생이 있더라도 현재 제출된 표만으로 즉시 마감하고 계산합니다. 계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setForceCloseConfirm(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setForceCloseConfirm(false);
                  executeTally(true);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs"
              >
                즉시 강제 마감
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Control Bar for Teacher */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur p-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">진행 제어:</span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-emerald-400 font-bold text-xs">
              {roomData.phase === 'lobby' && '로비 (입장 대기)'}
              {roomData.phase === 'intro' && '하루 인트로 설명'}
              {roomData.phase === 'round_damage' && `${roomData.round}R 피해 발생`}
              {roomData.phase === 'treaty' && `${roomData.round}R 국제 협약 표결`}
              {roomData.phase === 'event' && `${roomData.round}R 돌발 사건 대응`}
              {roomData.phase === 'voting' && `${roomData.round}R 기술 투자 투표`}
              {roomData.phase === 'revoting' && `${roomData.round}R 동률 재투표`}
              {roomData.phase === 'round_result' && `${roomData.round}R 결과 공개`}
              {roomData.phase === 'earth_ending' && '2075 지구 최종 엔딩'}
              {roomData.phase === 'court' && '미래 세대 법정 판결'}
              {roomData.phase === 'reflection' && '수업 후 성찰지 작성'}
              {roomData.phase === 'finished' && '수업 완료'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Skip Phase Button */}
            <button
              onClick={handleSkipPhase}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="현재 단계를 즉시 건너뛰고 다음 단계로 이동합니다"
            >
              <FastForward className="w-3.5 h-3.5 text-sky-400" />
              <span>단계 건너뛰기</span>
            </button>

            {/* Skip Round Button (Only during active rounds) */}
            {roomData.phase !== 'lobby' && roomData.phase !== 'earth_ending' && roomData.phase !== 'court' && roomData.phase !== 'reflection' && roomData.phase !== 'finished' && (
              <button
                onClick={handleSkipRound}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                title="이번 라운드를 마무리하고 다음 라운드로 즉시 건너뜁니다"
              >
                <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                <span>라운드 건너뛰기</span>
              </button>
            )}

            {/* Unlock Button */}
            {roomData.phase === 'voting' && (
              <button
                onClick={handleUnlockAll}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>선택권 풀어주기</span>
              </button>
            )}

            {/* Force Close Button */}
            {roomData.phase === 'voting' && (
              <button
                onClick={() => setForceCloseConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                <span>강제 마감</span>
              </button>
            )}

            {/* Previous Phase (뒤로가기) Button */}
            {roomData.phase !== 'lobby' && (
              <button
                onClick={handlePrevPhase}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow"
                title="이전 단계로 되돌아갑니다"
              >
                <ArrowLeft className="w-4 h-4 text-slate-300" />
                <span>이전 단계</span>
              </button>
            )}

            {/* Next Phase Button */}
            <button
              onClick={handleNextPhase}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg transition-all cursor-pointer transform hover:scale-105"
            >
              <span>
                {roomData.phase === 'lobby'
                  ? '게임 시작'
                  : roomData.phase === 'treaty'
                  ? '협약 표결 마감'
                  : roomData.phase === 'event'
                  ? '사건 결과 반영'
                  : roomData.phase === 'voting'
                  ? '투표 집계 마감'
                  : roomData.phase === 'round_result'
                  ? '다음 단계로'
                  : roomData.phase === 'court'
                  ? '수업 공식 종료'
                  : '다음 진행'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Teacher Test Mode Modal */}
      {/* 학생 화면 미리보기 모달 */}
      {previewTeam !== null && selectedRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => setPreviewTeam(null)}>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {[0, 1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  onClick={() => setPreviewTeam(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    previewTeam === t ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  제{t + 1}국
                </button>
              ))}
              <button onClick={() => setPreviewTeam(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-white cursor-pointer">
                닫기
              </button>
            </div>
            <iframe
              key={previewTeam}
              title="학생 화면 미리보기"
              src={`${window.location.pathname}?preview=${selectedRoomId}&team=${previewTeam}`}
              className="w-[390px] max-w-full h-[78vh] rounded-3xl border-4 border-slate-600 bg-slate-950 shadow-2xl"
            />
            <p className="text-[11px] text-slate-400">진행 중인 방을 그대로 따라갑니다. 위쪽 노란 줄에서 단계를 직접 골라 볼 수도 있어요.</p>
          </div>
        </div>
      )}

      {roomData.isTest && (
        <TestModeModal
          isOpen={isTestModeModalOpen}
          onClose={() => setIsTestModeModalOpen(false)}
          roomData={roomData}
          teams={teams}
          allInputs={allInputs}
          gameState={gameState}
        />
      )}

      {/* In-app Notification Toast */}
      {notification && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2.5 bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
};
