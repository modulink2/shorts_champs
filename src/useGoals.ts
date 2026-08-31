import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Goal } from './App';

export function useGoals(uid: string | undefined) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!uid) { setGoals([]); return; }
    const unsub = onSnapshot(collection(db, 'users', uid, 'goals'), (snap) => {
      setGoals(snap.docs.map((d) => d.data() as Goal));
    });
    return unsub;
  }, [uid]);

  const saveGoal = (goal: Goal) => {
    if (!uid) return Promise.resolve();
    const clean = JSON.parse(JSON.stringify(goal));
    return setDoc(doc(db, 'users', uid, 'goals', goal.id), clean);
  };
  const deleteGoal = (id: string) => {
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(db, 'users', uid, 'goals', id));
  };

  return { goals, saveGoal, deleteGoal };
}
