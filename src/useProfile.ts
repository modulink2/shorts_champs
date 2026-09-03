import { useEffect, useState } from 'react';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile, LogComment } from './App';

// Write (or patch) any profile doc — usable for editing your own profile or,
// for admin/coach flows, a target athlete's.
export function saveProfile(targetUid: string, patch: Partial<UserProfile>) {
  return setDoc(doc(db, 'profiles', targetUid), patch, { merge: true });
}

// The signed-in user's own profile (role, assigned coach, etc).
export function useProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    return onSnapshot(doc(db, 'profiles', uid), (snap) => setProfile(snap.exists() ? (snap.data() as UserProfile) : null), (err) => console.error('[useProfile]', err));
  }, [uid]);
  return { profile };
}

// Every user's profile — used for coach search, coach rosters, and the admin
// member list. Firestore rules allow any signed-in user to read this
// collection (profiles hold no sensitive data beyond name/email/role).
export function useAllProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (!enabled) { setProfiles([]); return; }
    return onSnapshot(collection(db, 'profiles'), (snap) => setProfiles(snap.docs.map((d) => d.data() as UserProfile)), (err) => console.error('[useAllProfiles]', err));
  }, [enabled]);
  return profiles;
}

// Coach/admin comments left on one athlete's training log for one date.
export function useComments(athleteUid: string | undefined, date: string | undefined) {
  const [comments, setComments] = useState<LogComment[]>([]);
  useEffect(() => {
    if (!athleteUid || !date) { setComments([]); return; }
    const q = query(collection(db, 'users', athleteUid, 'logs', date, 'comments'), orderBy('createdAt'));
    return onSnapshot(q, (snap) => setComments(snap.docs.map((d) => d.data() as LogComment)), (err) => console.error('[useComments]', err));
  }, [athleteUid, date]);

  const addComment = (authorUid: string, authorName: string, text: string) => {
    if (!athleteUid || !date || !text.trim()) return Promise.resolve();
    const id = crypto.randomUUID();
    return setDoc(doc(db, 'users', athleteUid, 'logs', date, 'comments', id), {
      id, authorUid, authorName, text: text.trim(), createdAt: Date.now(),
    });
  };

  return { comments, addComment };
}
