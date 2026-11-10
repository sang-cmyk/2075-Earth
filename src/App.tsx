/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { RulesModal } from './components/RulesModal.tsx';
import { TeacherDashboard } from './components/Teacher/TeacherDashboard.tsx';
import { StudentView } from './components/Student/StudentView.tsx';
import { auth, testConnection } from './firebase.ts';
import { onAuthStateChanged } from 'firebase/auth';

import { isTeacherEmail, loadTeacherEmails } from './utils/teacherAccess.ts';

export default function App() {
  // 학생이 주소를 열면 학생 화면이 기본. 교사는 ?teacher 주소로 들어오거나 교사 계정으로 로그인한다.
  const params = new URLSearchParams(window.location.search);
  const teacherLink = params.has('teacher');
  const [isTeacher, setIsTeacher] = useState<boolean>(teacherLink);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      testConnection().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    testConnection().then((connected) => {
      setIsOnline(connected);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to auth state
  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const emails = await loadTeacherEmails();
        if (alive && isTeacherEmail(user.email, emails)) {
          setIsTeacher(true);
        }
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  // 교사용 학생 화면 미리보기 (?preview=방ID&team=0)
  const previewRoom = params.get('preview');
  if (previewRoom) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <StudentView preview={{ roomId: previewRoom, teamId: Number(params.get('team') ?? 0) || 0 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Header
        isTeacher={isTeacher}
        setIsTeacher={setIsTeacher}
        onOpenRules={() => setIsRulesOpen(true)}
        isOnline={isOnline}
        showRoleToggle={teacherLink}
      />

      <main className="flex-1 w-full">
        {isTeacher ? <TeacherDashboard /> : <StudentView initialRoomCode={params.get('code') ?? undefined} />}
      </main>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
