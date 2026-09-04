import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_RECORD_DISTANCES, type RecordType } from './App';

export function useRecordTypes(uid: string | undefined) {
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const seeding = useRef(false);

  useEffect(() => {
    if (!uid) { setRecordTypes([]); return; }
    const unsub = onSnapshot(collection(db, 'users', uid, 'recordTypes'), (snap) => {
      setRecordTypes(snap.docs.map((d) => d.data() as RecordType).sort((a, b) => a.distance - b.distance));
    });
    return unsub;
  }, [uid]);

  // New accounts start with the familiar short-track distances pre-populated.
  // A settings flag (not "collection is empty") gates this so deleting them
  // all later doesn't bring them back.
  useEffect(() => {
    if (!uid || seeding.current) return;
    seeding.current = true;
    (async () => {
      const flagRef = doc(db, 'users', uid, 'meta', 'settings');
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists() && flagSnap.data()?.recordTypesSeeded) return;
      const batch = writeBatch(db);
      DEFAULT_RECORD_DISTANCES.forEach((distance) => {
        const id = crypto.randomUUID();
        batch.set(doc(db, 'users', uid, 'recordTypes', id), { id, distance });
      });
      batch.set(flagRef, { recordTypesSeeded: true }, { merge: true });
      await batch.commit();
    })();
  }, [uid]);

  const saveRecordType = (rt: RecordType) => {
    if (!uid) return Promise.resolve();
    return setDoc(doc(db, 'users', uid, 'recordTypes', rt.id), rt);
  };
  const deleteRecordType = (id: string) => {
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(db, 'users', uid, 'recordTypes', id));
  };

  return { recordTypes, saveRecordType, deleteRecordType };
}
