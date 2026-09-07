import React, { useMemo, useState } from 'react';
import { MessageSquare, Trash2, Plus, X, Check, Clock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useFriendships, useProfile, sendFriendRequest } from './useProfile';
import { useRecentPosts, useReplies, createPost, deletePost, addReply, deleteReply, type LoungePost } from './useLounge';
import { Avatar } from './App';

type Relation = 'none' | 'pending' | 'friend';

function timeAgo(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

// The author's avatar doubles as a quick "add friend" button — a badge shows
// the current relation, and only the 'none' state is clickable.
function AuthorAvatar({ authorUid, avatarId, myUid, relation, onRequest }: {
  authorUid: string; avatarId?: string; myUid: string; relation: Relation; onRequest: () => void;
}) {
  const isSelf = authorUid === myUid;
  const clickable = !isSelf && relation === 'none';
  return (
    <button
      type="button" onClick={clickable ? onRequest : undefined}
      className={`relative shrink-0 rounded-full ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      title={clickable ? '친구 신청' : undefined}
    >
      <Avatar avatarId={avatarId} fallback="⛸️" className="w-9 h-9 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[14px]" />
      {!isSelf && relation === 'pending' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--c-121214)] border border-[var(--c-232326)] flex items-center justify-center"><Clock size={9} className="text-[var(--c-9A9A93)]"/></span>
      )}
      {!isSelf && relation === 'friend' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--c-D4AF37)] flex items-center justify-center"><Check size={9} strokeWidth={3} className="text-[var(--c-060608)]"/></span>
      )}
      {!isSelf && relation === 'none' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full gold-gradient flex items-center justify-center"><Plus size={10} strokeWidth={3} className="text-[var(--c-on-accent)]"/></span>
      )}
    </button>
  );
}

function PostCard({ post, myUid, relation, onFriendRequest, expanded, onToggle }: {
  post: LoungePost; myUid: string; relation: Relation; onFriendRequest: (uid: string) => void;
  expanded: boolean; onToggle: () => void;
}) {
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
        <AuthorAvatar authorUid={post.authorUid} avatarId={post.authorAvatarId} myUid={myUid} relation={relation} onRequest={()=>onFriendRequest(post.authorUid)} />
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

const PAGE_SIZE = 20;

export default function LoungeView() {
  const { user } = useAuth();
  const { profile: myProfile } = useProfile(user?.uid);
  const { friends, incoming, outgoing } = useFriendships(user?.uid);
  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const posts = useRecentPosts(limitCount);
  const [text, setText] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const friendSet = useMemo(() => new Set(friends), [friends]);
  const pendingSet = useMemo(() => new Set([...incoming, ...outgoing]), [incoming, outgoing]);
  const relationOf = (uid: string): Relation => {
    if (friendSet.has(uid)) return 'friend';
    if (pendingSet.has(uid)) return 'pending';
    return 'none';
  };

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

  // A fetch that comes back shorter than what we asked for means there's
  // nothing older left in the collection.
  const hasMore = posts.length >= limitCount;

  const submitPost = () => {
    if (!user || !text.trim()) return;
    createPost(user.uid, myProfile?.displayName || user.displayName || user.email || '', myProfile?.avatarId, text);
    setText('');
    setComposerOpen(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-5">
      {friendPosts.length > 0 && (
        <div className="card p-5 lg:p-6">
          <div className="font-[700] text-[14px]">내 글 · 친구</div>
          <div className="mt-3 space-y-2.5">
            {friendPosts.map(p => <PostCard key={p.id} post={p} myUid={user.uid} relation={relationOf(p.authorUid)} onFriendRequest={(uid)=>sendFriendRequest(user.uid, uid)} expanded={expandedId===p.id} onToggle={()=>setExpandedId(id=>id===p.id?null:p.id)} />)}
          </div>
        </div>
      )}

      <div className="card p-5 lg:p-6">
        <div className="font-[700] text-[14px]">모두의 이야기</div>
        <div className="mt-3 space-y-2.5">
          {otherPosts.map(p => <PostCard key={p.id} post={p} myUid={user.uid} relation={relationOf(p.authorUid)} onFriendRequest={(uid)=>sendFriendRequest(user.uid, uid)} expanded={expandedId===p.id} onToggle={()=>setExpandedId(id=>id===p.id?null:p.id)} />)}
          {otherPosts.length===0 && friendPosts.length===0 && <div className="text-center py-8 text-[12px] text-[var(--c-6A6A66)]">아직 글이 없어요 · 첫 글을 남겨보세요</div>}
        </div>
        {hasMore && (
          <button onClick={()=>setLimitCount(c=>c+PAGE_SIZE)} className="mt-4 w-full h-10 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[12px] font-[700] text-[var(--c-9A9A93)] hover:border-[var(--c-3A3520)] hover:text-[var(--c-F5F1E8)]">더보기</button>
        )}
      </div>

      <button
        onClick={()=>setComposerOpen(true)}
        title="글쓰기"
        className="fixed bottom-[144px] lg:bottom-8 right-4 lg:right-8 z-30 w-14 h-14 rounded-full gold-gradient text-[var(--c-on-accent)] shadow-[0_0_24px_rgba(var(--c-D4AF37-rgb),0.4)] flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus size={26} strokeWidth={2.5}/>
      </button>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[12px]" onClick={()=>setComposerOpen(false)}/>
          <div className="relative w-full lg:max-w-[560px] max-h-[92dvh] overflow-auto rounded-t-[28px] lg:rounded-[28px] bg-[var(--c-0C0C0E)]/80 backdrop-blur-2xl border border-[var(--c-2C2A20)] shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(var(--c-D4AF37-rgb),0.15)_inset]">
            <div className="sticky top-0 z-10 bg-[var(--c-0C0C0E)]/90 backdrop-blur-xl border-b border-[var(--c-1E1C14)] px-6 h-[68px] flex items-center justify-between">
              <div className="font-[800] text-[15px] tracking-[-0.02em]">글쓰기</div>
              <button onClick={()=>setComposerOpen(false)} className="w-9 h-9 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center hover:border-[var(--c-3A3520)]"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                autoFocus value={text} onChange={e=>setText(e.target.value)}
                placeholder="오늘 하루 어땠나요? 편하게 남겨보세요"
                className="field w-full min-h-[140px] rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)] resize-none"
              />
              <button onClick={submitPost} disabled={!text.trim()} className="w-full h-[52px] rounded-[16px] gold-gradient text-[var(--c-on-accent)] font-[800] text-[14px] disabled:opacity-40 active:scale-[0.98] transition-all">등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
