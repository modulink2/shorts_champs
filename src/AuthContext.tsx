import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: 'athlete'|'coach') => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const signUp = async (email: string, password: string, name: string, role: 'athlete'|'coach') => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = name.trim() || email;
    if (name.trim()) await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'profiles', cred.user.uid), {
      uid: cred.user.uid, email, displayName, role, createdAt: Date.now(),
    });
    setUser({ ...cred.user });
  };
  const logIn = async (email: string, password: string) => { await signInWithEmailAndPassword(auth, email, password); };
  const logOut = () => signOut(auth);

  return <Ctx.Provider value={{ user, loading, signUp, logIn, logOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
