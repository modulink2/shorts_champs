import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Award } from './App';

export function useAwards(uid: string | undefined) {
  const [awards, setAwards] = useState<Award[]>([]);

  useEffect(() => {
    if (!uid) { setAwards([]); return; }
    const unsub = onSnapshot(collection(db, 'users', uid, 'awards'), (snap) => {
      setAwards(snap.docs.map((d) => d.data() as Award).sort((a,b)=>b.createdAt-a.createdAt));
    });
    return unsub;
  }, [uid]);

  const saveAward = (award: Award) => {
    if (!uid) return Promise.resolve();
    return setDoc(doc(db, 'users', uid, 'awards', award.id), award);
  };
  const deleteAward = (id: string) => {
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(db, 'users', uid, 'awards', id));
  };

  return { awards, saveAward, deleteAward };
}
