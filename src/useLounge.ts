import { useEffect, useState } from 'react';
import { collection, doc, addDoc, deleteDoc, updateDoc, increment, setDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface LoungePost { id: string; authorUid: string; authorName: string; authorAvatarId?: string; text: string; createdAt: number; replyCount: number; }
export interface LoungeReply { id: string; authorUid: string; authorName: string; text: string; createdAt: number; }
export interface LastLoungeReply { postId: string; postTextPreview: string; replyText: string; authorName: string; createdAt: number; }

// Most recent posts overall — callers split into "friends" vs "everyone
// else" and shuffle the latter client-side; Firestore can't express that
// ordering in one query.
export function useRecentPosts(max = 50) {
  const [posts, setPosts] = useState<LoungePost[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'loungePosts'), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (snap) => setPosts(snap.docs.map((d) => ({ ...d.data(), id: d.id } as LoungePost))), (err) => console.error('[useRecentPosts]', err));
  }, [max]);
  return posts;
}

export function createPost(authorUid: string, authorName: string, authorAvatarId: string | undefined, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();
  return addDoc(collection(db, 'loungePosts'), { authorUid, authorName, authorAvatarId: authorAvatarId || null, text: trimmed, createdAt: Date.now(), replyCount: 0 });
}
export function deletePost(postId: string) {
  return deleteDoc(doc(db, 'loungePosts', postId));
}

export function useReplies(postId: string | undefined) {
  const [replies, setReplies] = useState<LoungeReply[]>([]);
  useEffect(() => {
    if (!postId) { setReplies([]); return; }
    const q = query(collection(db, 'loungePosts', postId, 'replies'), orderBy('createdAt'));
    return onSnapshot(q, (snap) => setReplies(snap.docs.map((d) => ({ ...d.data(), id: d.id } as LoungeReply))), (err) => console.error('[useReplies]', err));
  }, [postId]);
  return replies;
}

export async function addReply(post: LoungePost, authorUid: string, authorName: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'loungePosts', post.id, 'replies'), { authorUid, authorName, text: trimmed, createdAt: Date.now() });
  await updateDoc(doc(db, 'loungePosts', post.id), { replyCount: increment(1) });
  // Notify the post's author (unless replying to your own post) so their
  // dashboard can surface a "someone replied" banner.
  if (authorUid !== post.authorUid) {
    await setDoc(doc(db, 'notifications', post.authorUid), {
      lastLoungeReply: { postId: post.id, postTextPreview: post.text.slice(0, 40), replyText: trimmed, authorName, createdAt: Date.now() } as LastLoungeReply,
    }, { merge: true });
  }
}
export function deleteReply(postId: string, replyId: string) {
  return deleteDoc(doc(db, 'loungePosts', postId, 'replies', replyId));
}

// The signed-in user's own most-recent-lounge-reply pointer, for the
// dashboard "someone replied to my post" banner.
export function useLastLoungeReply(uid: string | undefined) {
  const [last, setLast] = useState<LastLoungeReply | null>(null);
  useEffect(() => {
    if (!uid) { setLast(null); return; }
    return onSnapshot(doc(db, 'notifications', uid), (snap) => {
      setLast(snap.exists() ? ((snap.data().lastLoungeReply as LastLoungeReply) ?? null) : null);
    }, (err) => console.error('[useLastLoungeReply]', err));
  }, [uid]);
  return last;
}
