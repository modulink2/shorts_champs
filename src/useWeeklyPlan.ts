import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { PlanItem } from './App';

export function useWeeklyPlan(uid: string | undefined) {
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  useEffect(() => {
    if (!uid) { setPlanItems([]); return; }
    return onSnapshot(collection(db, 'users', uid, 'weeklyPlan'), (snap) => {
      setPlanItems(snap.docs.map((d) => d.data() as PlanItem));
    });
  }, [uid]);

  const savePlanItem = (uid: string, item: PlanItem) => setDoc(doc(db, 'users', uid, 'weeklyPlan', item.id), item);
  const deletePlanItem = (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'weeklyPlan', id));

  return { planItems, savePlanItem, deletePlanItem };
}
