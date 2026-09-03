import { useEffect, useState } from 'react';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile, LogComment, LatestComment } from './App';

// Write (or patch) any profile doc — usable for editing your own profile or,
// for admin/coach flows, a target athlete's.
export function saveProfile(targetUid: string, patch: Partial<UserProfile>) {
  return setDoc(doc(db, 'profiles', targetUid), patch, { merge: true });
}

// The signed-in user's own profile (role, assigned coach, etc). `loaded`
// distinguishes "still fetching" from "confirmed no doc" so callers can
// safely decide whether to backfill defaults.
export function useProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (!uid) { setProfile(null); return; }
    return onSnapshot(doc(db, 'profiles', uid), (snap) => {
      // Fall back to the doc's own id for `uid` — a profile written before a
      // `uid` field existed on it (e.g. a partial coach-picker write) would
      // otherwise leave callers with p.uid===undefined and no way to target
      // it in further writes.
      setProfile(snap.exists() ? ({ ...snap.data(), uid: snap.id } as UserProfile) : null);
      setLoaded(true);
    }, (err) => console.error('[useProfile]', err));
  }, [uid]);
  return { profile, loaded };
}

// Every user's profile — used for coach search, coach rosters, and the admin
// member list. Firestore rules allow any signed-in user to read this
// collection (profiles hold no sensitive data beyond name/email/role).
export function useAllProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (!enabled) { setProfiles([]); return; }
    return onSnapshot(collection(db, 'profiles'), (snap) => setProfiles(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile))), (err) => console.error('[useAllProfiles]', err));
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

  const addComment = async (authorUid: string, authorName: string, text: string) => {
    if (!athleteUid || !date || !text.trim()) return;
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await setDoc(doc(db, 'users', athleteUid, 'logs', date, 'comments', id), {
      id, authorUid, authorName, text: text.trim(), createdAt,
    });
    // Denormalize onto notifications/{athleteUid} so the athlete's dashboard
    // can flag the newest comment without listening to every date's
    // comments subcollection.
    await setDoc(doc(db, 'notifications', athleteUid), {
      lastComment: { text: text.trim(), authorName, date, createdAt },
    }, { merge: true });
  };

  return { comments, addComment };
}

// The athlete's own most-recent-coach-comment pointer, used to surface a
// "new feedback" banner on login.
export function useLatestComment(uid: string | undefined) {
  const [latestComment, setLatestComment] = useState<LatestComment | null>(null);
  useEffect(() => {
    if (!uid) { setLatestComment(null); return; }
    return onSnapshot(doc(db, 'notifications', uid), (snap) => {
      setLatestComment(snap.exists() ? ((snap.data().lastComment as LatestComment) ?? null) : null);
    }, (err) => console.error('[useLatestComment]', err));
  }, [uid]);
  return latestComment;
}
