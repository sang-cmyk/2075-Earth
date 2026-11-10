import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';

export const DEFAULT_TEACHER_EMAILS = [
  'sangwoo59590@gmail.com',
  '202105@jeonnong.ms.kr',
];

let cachedEmails: string[] | null = null;
let pendingLoad: Promise<string[]> | null = null;

/**
 * Checks whether the given email has teacher permissions based on the allowed emails list.
 * Email is compared in lowercase and exact match only. No domain comparison is performed.
 */
export function isTeacherEmail(
  email: string | null | undefined,
  emails?: string[] | null
): boolean {
  if (!email) return false;
  const list = emails ?? cachedEmails ?? DEFAULT_TEACHER_EMAILS;
  const cleanEmail = email.trim().toLowerCase();
  return list.some((e) => e.trim().toLowerCase() === cleanEmail);
}

/**
 * Loads teacher allowed emails list from Firestore doc `config/teachers`.
 * Falls back to DEFAULT_TEACHER_EMAILS if the document does not exist or fails to load.
 */
export async function loadTeacherEmails(forceRefresh = false): Promise<string[]> {
  if (cachedEmails && !forceRefresh) {
    return cachedEmails;
  }
  if (pendingLoad && !forceRefresh) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    try {
      const docRef = doc(db, 'config', 'teachers');
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        const emails = Array.isArray(data?.emails)
          ? data.emails.map(String).map((e) => e.trim().toLowerCase()).filter(Boolean)
          : DEFAULT_TEACHER_EMAILS;

        cachedEmails = emails.length > 0 ? emails : [...DEFAULT_TEACHER_EMAILS];
      } else {
        cachedEmails = [...DEFAULT_TEACHER_EMAILS];
      }
    } catch (err) {
      console.warn('Failed to load config/teachers, using default teacher fallback:', err);
      cachedEmails = [...DEFAULT_TEACHER_EMAILS];
    } finally {
      pendingLoad = null;
    }

    return cachedEmails;
  })();

  return pendingLoad;
}

/**
 * Saves teacher allowed emails to Firestore doc `config/teachers`.
 */
export async function saveTeacherEmails(emails: string[]): Promise<void> {
  const path = 'config/teachers';
  try {
    const docRef = doc(db, 'config', 'teachers');
    const cleanedEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    await setDoc(docRef, { emails: cleanedEmails });
    cachedEmails = cleanedEmails;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
