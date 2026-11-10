import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { buildRoomConfig } from '../game/roomConfig.ts';
import { createGame, exportState } from '../game/engine.ts';
import type { RoomData, TeamData, StudentInputDoc } from '../types/game.ts';
import type { Ballot } from '../game/vote.ts';

export function getClientId(): string {
  if (typeof window === 'undefined') return 'server_node';
  let id = localStorage.getItem('2075_client_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('2075_client_device_id', id);
  }
  return id;
}

export async function createRoom(
  grade: number,
  classNumber: number,
  title: string,
  isTest: boolean,
  createdBy: string,
  maxSeatsPerTeam: number = 5,
  enableCrisisSupport: boolean = true,
  enableEvents: boolean = true,
  enableTreaties: boolean = true,
  enableReflections: boolean = true,
  gameSpeedMode: 'quick' | 'standard' = 'standard'
): Promise<string> {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;

  const cfg = buildRoomConfig({
    enableCrisisSupport,
    enableEvents,
    enableTreaties,
    enableReflections,
    gameSpeedMode,
  });
  const initialGame = createGame(cfg);
  const gameStateJson = exportState(initialGame);
  const seed = Math.floor(Math.random() * 1000000);

  const roomData: RoomData = {
    id: roomId,
    code,
    grade,
    classNumber,
    title: title || `${grade}학년 ${classNumber}반 2075 지구`,
    isTest,
    phase: 'lobby',
    round: 1,
    timerExpiresAt: 0,
    timerPaused: false,
    seed,
    gameStateJson,
    createdBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    absentSeats: [],
    maxSeatsPerTeam: Math.min(5, Math.max(1, maxSeatsPerTeam || 5)),
    enableCrisisSupport,
    enableEvents,
    enableTreaties,
    enableReflections,
    gameSpeedMode,
  };

  try {
    // 방 문서와 6개 모둠 문서를 한 번에 쓴다 (하나씩 기다리면 쓰기마다 왕복 시간이 쌓여 20초 가까이 걸림)
    const batch = writeBatch(db);
    batch.set(roomRef, roomData);
    for (let t = 0; t < 6; t++) {
      const teamRef = doc(db, 'rooms', roomId, 'teams', t.toString());
      const teamData: TeamData = {
        teamId: t,
        seats: {},
        lastDecision: null,
        lastTally: null,
        lastBuriedWarnings: [],
        lastInvestigation: null,
        unlocked: false,
      };
      batch.set(teamRef, teamData);
    }
    await batch.commit();

    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export function subscribeRoom(roomId: string, onUpdate: (data: RoomData | null) => void) {
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as RoomData);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeTeam(
  roomId: string,
  teamId: number,
  onUpdate: (data: TeamData | null) => void
) {
  const path = `rooms/${roomId}/teams/${teamId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId, 'teams', teamId.toString()),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as TeamData);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeAllTeams(
  roomId: string,
  onUpdate: (teams: Record<number, TeamData>) => void
) {
  const path = `rooms/${roomId}/teams`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'teams'),
    (snap) => {
      const teams: Record<number, TeamData> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as TeamData;
        teams[data.teamId] = data;
      });
      onUpdate(teams);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeTeamInputs(
  roomId: string,
  teamId: number,
  onUpdate: (inputs: Record<number, StudentInputDoc>) => void
) {
  const path = `rooms/${roomId}/teams/${teamId}/inputs`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'teams', teamId.toString(), 'inputs'),
    (snap) => {
      const inputs: Record<number, StudentInputDoc> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as StudentInputDoc;
        inputs[data.seat] = data;
      });
      onUpdate(inputs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function findRoomByCode(code: string): Promise<RoomData | null> {
  const path = 'rooms';
  try {
    const q = query(collection(db, 'rooms'), where('code', '==', code.trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as RoomData;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function claimSeat(
  roomId: string,
  teamId: number,
  seatNumber: number,
  uid: string
): Promise<{ success: boolean; message?: string }> {
  const roomRef = doc(db, 'rooms', roomId);
  const teamRef = doc(db, 'rooms', roomId, 'teams', teamId.toString());
  try {
    return await runTransaction(db, async (txn) => {
      const roomSnap = await txn.get(roomRef);
      const maxSeats = roomSnap.exists()
        ? Math.min(5, Math.max(1, (roomSnap.data() as RoomData).maxSeatsPerTeam ?? 5))
        : 5;

      const snap = await txn.get(teamRef);
      if (!snap.exists()) {
        return { success: false, message: '모둠을 찾을 수 없습니다.' };
      }
      const data = snap.data() as TeamData;
      const seats = data.seats || {};
      const current = seats[seatNumber.toString()];
      if (current && current.uid !== uid) {
        return { success: false, message: '이미 다른 학생이 선택한 좌석입니다.' };
      }

      // Check if team is full and my uid is not in it
      const isAlreadyInTeam = Object.values(seats).some((s) => s.uid === uid);
      const occupiedCount = Object.keys(seats).length;

      if (!isAlreadyInTeam && occupiedCount >= maxSeats) {
        return { success: false, message: '이 모둠은 정원이 찼습니다. 다른 모둠을 선택하세요.' };
      }

      const updatedSeats = { ...seats };
      for (const [k, v] of Object.entries(updatedSeats)) {
        if (v.uid === uid && k !== seatNumber.toString()) {
          delete updatedSeats[k];
        }
      }
      updatedSeats[seatNumber.toString()] = {
        seat: seatNumber,
        uid,
        joinedAt: current ? current.joinedAt : Date.now(),
      };
      txn.update(teamRef, { seats: updatedSeats });
      return { success: true };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}/teams/${teamId}`);
  }
}

export async function releaseSeat(
  roomId: string,
  teamId: number,
  seatNumber: number
): Promise<void> {
  const teamRef = doc(db, 'rooms', roomId, 'teams', teamId.toString());
  try {
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(teamRef);
      if (!snap.exists()) return;
      const data = snap.data() as TeamData;
      const updatedSeats = { ...data.seats };
      delete updatedSeats[seatNumber.toString()];
      txn.update(teamRef, { seats: updatedSeats });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}`);
  }
}

export async function toggleAbsentSeat(roomId: string, seatKey: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(roomRef);
      if (!snap.exists()) return;
      const data = snap.data() as RoomData;
      const absents = new Set(data.absentSeats || []);
      if (absents.has(seatKey)) {
        absents.delete(seatKey);
      } else {
        absents.add(seatKey);
      }
      txn.update(roomRef, { absentSeats: Array.from(absents), updatedAt: Date.now() });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function submitStudentBallot(
  roomId: string,
  teamId: number,
  seatNumber: number,
  uid: string,
  round: number,
  ballot: Ballot,
  submitted: boolean
): Promise<void> {
  const inputRef = doc(
    db,
    'rooms',
    roomId,
    'teams',
    teamId.toString(),
    'inputs',
    seatNumber.toString()
  );
  const inputData: StudentInputDoc = {
    seat: seatNumber,
    uid,
    round,
    ballot,
    submitted,
    submittedAt: Date.now(),
  };
  try {
    // merge: 같은 문서에 저장된 협약/사건 표·성찰이 최종 제출 때 지워지지 않게 한다
    await setDoc(inputRef, inputData, { merge: true });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `rooms/${roomId}/teams/${teamId}/inputs/${seatNumber}`
    );
  }
}

export async function unlockTeamVotes(roomId: string, teamId: number): Promise<void> {
  const teamRef = doc(db, 'rooms', roomId, 'teams', teamId.toString());
  try {
    await updateDoc(teamRef, { unlocked: true });
    // Also unlock the submitted flag for all current inputs
    const inputsSnap = await getDocs(
      collection(db, 'rooms', roomId, 'teams', teamId.toString(), 'inputs')
    );
    for (const d of inputsSnap.docs) {
      await updateDoc(d.ref, { submitted: false });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}`);
  }
}

export async function updateRoom(roomId: string, updates: Partial<RoomData>): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, { ...updates, updatedAt: Date.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function updateTeam(
  roomId: string,
  teamId: number,
  updates: Partial<TeamData>
): Promise<void> {
  const teamRef = doc(db, 'rooms', roomId, 'teams', teamId.toString());
  try {
    await updateDoc(teamRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}`);
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    // Delete teams and inputs first
    for (let t = 0; t < 6; t++) {
      try {
        const inputsSnap = await getDocs(
          collection(db, 'rooms', roomId, 'teams', t.toString(), 'inputs')
        );
        for (const d of inputsSnap.docs) {
          await deleteDoc(d.ref);
        }
        await deleteDoc(doc(db, 'rooms', roomId, 'teams', t.toString()));
      } catch (e) {
        // Continue deleting room even if subcollection cleanup has error
      }
    }
    await deleteDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
  }
}

export async function backupRoundState(
  roomId: string,
  round: number,
  gameStateJson: string
): Promise<void> {
  try {
    const backupRef = doc(db, 'rooms', roomId, 'backups', round.toString());
    await setDoc(backupRef, {
      round,
      gameStateJson,
      backedUpAt: Date.now(),
    });
  } catch (e) {
    console.warn('Backup failed:', e);
  }
}

export async function getRoundBackup(
  roomId: string,
  round: number
): Promise<string | null> {
  try {
    const backupRef = doc(db, 'rooms', roomId, 'backups', round.toString());
    const snap = await getDoc(backupRef);
    if (snap.exists()) {
      return (snap.data() as { gameStateJson: string }).gameStateJson;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export interface RoomEventLog {
  id?: string;
  timestamp: number;
  seat: string; // e.g. "3모둠 12번"
  action: '입장' | '카드 이동' | '제출' | '수정' | '접속 끊김' | '재접속' | '결석 처리' | '진행';
  detail: string;
}

export async function logRoomEvent(
  roomId: string,
  seat: string,
  action: RoomEventLog['action'],
  detail: string
): Promise<void> {
  try {
    const logRef = doc(collection(db, 'rooms', roomId, 'logs'));
    await setDoc(logRef, {
      timestamp: Date.now(),
      seat,
      action,
      detail,
    });
  } catch (e) {
    // Non-blocking log
  }
}

export function subscribeRoomLogs(
  roomId: string,
  onUpdate: (logs: RoomEventLog[]) => void
) {
  const path = `rooms/${roomId}/logs`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'logs'),
    (snap) => {
      const logs: RoomEventLog[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id, ...(d.data() as RoomEventLog) });
      });
      logs.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(logs);
    },
    () => {}
  );
}

export async function listRooms(): Promise<RoomData[]> {
  const path = 'rooms';
  try {
    const snap = await getDocs(collection(db, 'rooms'));
    return snap.docs.map((d) => d.data() as RoomData);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// 협약/사건 표는 아직 문서가 없는 학생도 누를 수 있어야 하므로 updateDoc 대신 setDoc(merge)를 쓴다.
// 라운드를 같이 저장해서 지난 라운드의 표가 이번 라운드에 남아 보이거나 집계되지 않게 한다.
export async function submitStudentEventChoice(
  roomId: string,
  teamId: number,
  seatId: number,
  uid: string,
  round: number,
  choiceId: string
): Promise<void> {
  const inputRef = doc(db, 'rooms', roomId, 'teams', teamId.toString(), 'inputs', seatId.toString());
  try {
    await setDoc(inputRef, { seat: seatId, uid, eventVote: choiceId, eventVoteRound: round }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}/inputs/${seatId}`);
  }
}

export async function submitStudentTreatyVote(
  roomId: string,
  teamId: number,
  seatId: number,
  uid: string,
  round: number,
  vote: boolean
): Promise<void> {
  const inputRef = doc(db, 'rooms', roomId, 'teams', teamId.toString(), 'inputs', seatId.toString());
  try {
    await setDoc(inputRef, { seat: seatId, uid, treatyVote: vote, treatyVoteRound: round }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}/inputs/${seatId}`);
  }
}

export async function submitStudentReflection(
  roomId: string,
  teamId: number,
  seatId: number,
  regret: string,
  retry: string
): Promise<void> {
  const inputRef = doc(db, 'rooms', roomId, 'teams', teamId.toString(), 'inputs', seatId.toString());
  try {
    await updateDoc(inputRef, {
      reflection: {
        regret,
        retry,
        submittedAt: Date.now(),
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/teams/${teamId}/inputs/${seatId}`);
  }
}


