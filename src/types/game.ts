import type { GameState, Decision, Verdict, EarthEnding } from '../game/engine.ts';
import type { Ballot, Tally } from '../game/vote.ts';

export type GamePhase =
  | 'lobby'
  | 'intro'
  | 'round_damage'
  | 'treaty'
  | 'event'
  | 'voting'
  | 'revoting'
  | 'round_result'
  | 'earth_ending'
  | 'court'
  | 'reflection'
  | 'finished';

export interface RoomData {
  id: string;
  code: string;
  grade: number;
  classNumber: number;
  title: string;
  isTest: boolean;
  phase: GamePhase;
  round: number;
  timerExpiresAt: number;
  timerPaused: boolean;
  seed: number;
  gameStateJson: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  absentSeats: string[]; // e.g. "teamId-seatNumber"
  revoteDomain?: string | null;
  forcedTally?: boolean;
  maxSeatsPerTeam?: number;
  enableCrisisSupport?: boolean;
  enableEvents?: boolean;
  enableTreaties?: boolean;
  enableReflections?: boolean;
  gameSpeedMode?: 'quick' | 'standard';
}

export interface SeatInfo {
  seat: number;
  uid: string;
  joinedAt: number;
}

export interface TeamData {
  teamId: number;
  seats: Record<string, SeatInfo>;
  lastDecision?: Decision | null;
  lastTally?: Tally | null;
  lastBuriedWarnings?: { domain: string; level: number }[];
  lastInvestigation?: { severity: '낮음' | '중간' | '높음'; axes: string[] } | null;
  lastEventChoice?: string;
  lastTreatyVote?: boolean;
  unlocked?: boolean;
}

export interface StudentInputDoc {
  seat: number;
  uid: string;
  round: number;
  ballot: Ballot;
  submitted: boolean;
  submittedAt: number;
  eventVote?: string;
  eventVoteRound?: number;
  treatyVote?: boolean;
  treatyVoteRound?: number;
  reflection?: {
    regret: string;
    retry: string;
    submittedAt: number;
  };
}
