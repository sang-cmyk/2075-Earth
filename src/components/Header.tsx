import React, { useState, useEffect } from 'react';
import { Globe, BookOpen, Wifi, WifiOff, LogIn, LogOut } from 'lucide-react';
import { auth } from '../firebase.ts';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { isTeacherEmail, loadTeacherEmails } from '../utils/teacherAccess.ts';

interface HeaderProps {
  isTeacher: boolean;
  setIsTeacher: (val: boolean) => void;
  onOpenRules: () => void;
  roomCode?: string;
  round?: number;
  phaseLabel?: string;
  isOnline?: boolean;
  showRoleToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isTeacher,
  setIsTeacher,
  onOpenRules,
  roomCode,
  round,
  phaseLabel,
  isOnline = true,
  showRoleToggle = false,
}) => {
  const user = auth.currentUser;
  const [teacherEmails, setTeacherEmails] = useState<string[] | null>(null);

  // Load teacher configuration once and cache it
  useEffect(() => {
    loadTeacherEmails().then((emails) => {
      setTeacherEmails(emails);
    });
  }, []);

  const isTargetTeacherEmail = isTeacherEmail(user?.email, teacherEmails);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const emails = await loadTeacherEmails();
      setTeacherEmails(emails);
      if (isTeacherEmail(res.user.email, emails)) {
        setIsTeacher(true);
      }
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsTeacher(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur px-4 py-2.5 flex items-center justify-between text-white shadow-md">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              2075 지구
            </h1>
            <p className="hidden md:block text-[10px] text-slate-400">중학교 2학년 도덕 수업 교실 게임</p>
          </div>
        </div>

        {roomCode && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
            <span className="text-slate-400">방 코드:</span>
            <span className="font-mono font-bold text-amber-400">{roomCode}</span>
            {round !== undefined && round > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="font-bold text-emerald-400">{round}R</span>
              </>
            )}
            {phaseLabel && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-700 text-[11px] text-slate-300">
                {phaseLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
            isOnline
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
              : 'bg-red-950/40 text-red-400 border-red-500/30 animate-pulse'
          }`}
          title={isOnline ? '학교망 정상 연결됨' : '연결 끊김! 재연결 시도 중...'}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isOnline ? '연결됨' : '오프라인'}</span>
        </div>

        {/* Rules button */}
        <button
          onClick={onOpenRules}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">규칙 보기</span>
        </button>

        {/* Role toggle / Login */}
        {user && isTargetTeacherEmail ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsTeacher(!isTeacher)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isTeacher
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isTeacher ? '교사 화면' : '학생 화면으로 전환'}
            </button>
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {showRoleToggle && (
              <button
                onClick={() => setIsTeacher(!isTeacher)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isTeacher
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isTeacher ? '교사 모드' : '학생 모드'}
              </button>
            )}
            {!user && (
              <button
                onClick={handleGoogleLogin}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">교사 로그인</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
