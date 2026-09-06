import React, { useMemo, useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useFriendships, useProfile } from './useProfile';
import { useRecentPosts, useReplies, createPost, deletePost, addReply, deleteReply, type LoungePost } from './useLounge';
import { Avatar } from './App';

function timeAgo(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

function PostCard({ post, myUid, expanded, onToggle }: { post: LoungePost; myUid: string; expanded: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const replies = useReplies(expanded ? post.id : undefined);
  const [replyText, setReplyText] = useState('');

  const submitReply = () => {
    if (!user || !replyText.trim()) return;
    addReply(post, user.uid, user.displayName || user.email || '', replyText);
    setReplyText('');
  };

  return (
    <div className="subcard rounded-[16px] p-4">
      <div className="flex items-start gap-3">
        <Avatar avatarId={post.authorAvatarId} fallback="⛸️" className="w-9 h-9 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[14px] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-[800]">{post.authorName}</span>
            <span className="text-[10px] text-[var(--c-6A6A66)] shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--c-E8E2D2)] whitespace-pre-wrap">{post.text}</p>
          <div className="mt-2.5 flex items-center gap-3">
            <button onClick={onToggle} className="text-[11px] font-[700] text-[var(--c-9A9A93)] hover:text-[var(--c-D4AF37)] flex items-center gap-1"><MessageSquare size={12}/> 답글 {post.replyCount || 0}</button>
            {post.authorUid===myUid && <button onClick={()=>deletePost(post.id)} className="text-[11px] font-[700] text-[var(--c-9A9A93)] hover:text-red-400 flex items-center gap-1"><Trash2 size={12}/> 삭제</button>}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pl-12 space-y-2.5">
          {replies.map(r=>(
            <div key={r.id} className="subcard rounded-[12px] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-[700] text-[var(--c-D4AF37)]">{r.authorName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--c-6A6A66)]">{timeAgo(r.createdAt)}</span>
                  {r.authorUid===myUid && <button onClick={()=>deleteReply(post.id, r.id)} className="text-[10px] font-[700] text-[var(--c-9A9A93)] hover:text-red-400">삭제</button>}
                </div>
              </div>
              <p className="mt-1 text-[12px] text-[var(--c-CFCFC8)] leading-[1.5] whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
          {replies.length===0 && <div className="text-[11px] text-[var(--c-6A6A66)] py-1">아직 답글이 없어요</div>}
          <div className="flex gap-2">
            <input
              value={replyText} onChange={e=>setReplyText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') submitReply(); }}
              placeholder="답글 남기기"
              className="field flex-1 h-9 rounded-full bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-3.5 text-[12px] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"
            />
            <button onClick={submitReply} className="h-9 px-3.5 rounded-full gold-gradient text-[var(--c-on-accent)] font-[800] text-[11px]">남기기</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoungeView() {
  const { user } = useAuth();
  const { profile: myProfile } = useProfile(user?.uid);
  const { friends } = useFriendships(user?.uid);
  const posts = useRecentPosts(50);
  const [text, setText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const friendSet = useMemo(() => new Set(friends), [friends]);
  // My own posts show alongside friends' — otherwise a post I just wrote
  // would appear in neither section (not a friend of myself, and excluded
  // from "everyone else" below).
  const friendPosts = useMemo(() => posts.filter(p => friendSet.has(p.authorUid) || p.authorUid === user?.uid).sort((a,b)=>b.createdAt-a.createdAt), [posts, friendSet, user?.uid]);
  // Shuffled once per posts-list change, not on every render, so the order
  // doesn't jump around under the user while they're mid-read.
  const otherPosts = useMemo(() => {
    const others = posts.filter(p => !friendSet.has(p.authorUid) && p.authorUid !== user?.uid);
    const arr = [...others];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [posts, friendSet, user?.uid]);

  const submitPost = () => {
    if (!user || !text.trim()) return;
    createPost(user.uid, myProfile?.displayName || user.displayName || user.email || '', myProfile?.avatarId, text);
    setText('');
  };

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="card p-5 lg:p-6">
        <div className="font-[700] text-[14px]">글쓰기</div>
        <textarea
          value={text} onChange={e=>setText(e.target.value)}
          placeholder="오늘 하루 어땠나요? 편하게 남겨보세요"
          className="field mt-3 w-full min-h-[70px] rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)] resize-none"
        />
        <button onClick={submitPost} disabled={!text.trim()} className="mt-2.5 h-10 px-5 rounded-full gold-gradient text-[var(--c-on-accent)] font-[800] text-[12px] disabled:opacity-40">등록</button>
      </div>

      {friendPosts.length > 0 && (
        <div className="card p-5 lg:p-6">
          <div className="font-[700] text-[14px]">내 글 · 친구</div>
          <div className="mt-3 space-y-2.5">
            {friendPosts.map(p => <PostCard key={p.id} post={p} myUid={user.uid} expanded={expandedId===p.id} onToggle={()=>setExpandedId(id=>id===p.id?null:p.id)} />)}
          </div>
        </div>
      )}

      <div className="card p-5 lg:p-6">
        <div className="font-[700] text-[14px]">모두의 이야기</div>
        <div className="mt-3 space-y-2.5">
          {otherPosts.map(p => <PostCard key={p.id} post={p} myUid={user.uid} expanded={expandedId===p.id} onToggle={()=>setExpandedId(id=>id===p.id?null:p.id)} />)}
          {otherPosts.length===0 && friendPosts.length===0 && <div className="text-center py-8 text-[12px] text-[var(--c-6A6A66)]">아직 글이 없어요 · 첫 글을 남겨보세요</div>}
        </div>
      </div>
    </div>
  );
}
