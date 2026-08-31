import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { TrainingLog } from './App';

export function useTrainingLogs(uid: string | undefined) {
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'users', uid, 'logs'), orderBy('date'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => d.data() as TrainingLog));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const saveLog = (log: TrainingLog) => {
    if (!uid) return Promise.resolve();
    // Firestore rejects fields explicitly set to `undefined` (e.g. optional
    // laps/km/youtubeUrl); JSON round-trip drops them like the UI intends.
    const clean = JSON.parse(JSON.stringify(log));
    return setDoc(doc(db, 'users', uid, 'logs', log.date), clean);
  };
  const deleteLog = (date: string) => {
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(db, 'users', uid, 'logs', date));
  };

  return { logs, loading, saveLog, deleteLog };
}
