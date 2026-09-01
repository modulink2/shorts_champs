import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_ITEM_TYPES, type ItemType } from './App';

export function useItemTypes(uid: string | undefined) {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const seeding = useRef(false);

  useEffect(() => {
    if (!uid) { setItemTypes([]); return; }
    const unsub = onSnapshot(collection(db, 'users', uid, 'itemTypes'), (snap) => {
      setItemTypes(snap.docs.map((d) => d.data() as ItemType));
    });
    return unsub;
  }, [uid]);

  // New accounts start with the familiar 육상 items pre-populated. A settings
  // flag (not "collection is empty") gates this so deleting them all later
  // doesn't bring them back.
  useEffect(() => {
    if (!uid || seeding.current) return;
    seeding.current = true;
    (async () => {
      const flagRef = doc(db, 'users', uid, 'meta', 'settings');
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists() && flagSnap.data()?.itemTypesSeeded) return;
      const batch = writeBatch(db);
      DEFAULT_ITEM_TYPES.forEach((t) => {
        const id = crypto.randomUUID();
        batch.set(doc(db, 'users', uid, 'itemTypes', id), { id, ...t });
      });
      batch.set(flagRef, { itemTypesSeeded: true }, { merge: true });
      await batch.commit();
    })();
  }, [uid]);

  const saveItemType = (item: ItemType) => {
    if (!uid) return Promise.resolve();
    return setDoc(doc(db, 'users', uid, 'itemTypes', item.id), item);
  };
  const deleteItemType = (id: string) => {
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(db, 'users', uid, 'itemTypes', id));
  };

  return { itemTypes, saveItemType, deleteItemType };
}
