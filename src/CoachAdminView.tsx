import React, { useMemo, useState } from 'react';
import { Users, UserCog, MessageSquare, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useAllProfiles, saveProfile, useComments } from './useProfile';
import { useTrainingLogs } from './useTrainingLogs';
import { TYPE_META, logTypes, toLocalDateStr, Avatar, type UserProfile, type UserRole } from './App';

const FOCUS_EMOJIS = ['💪','🔥','⭐️','👍','🎯','🏆','❄️','👏'];

// Coach/parent: set or edit the goal message shown on the athlete's own
// dashboard (replaces the default motivational quote there).
function FocusGoalEditor({ athlete, authorName }: { athlete: UserProfile; authorName: string }) {
  // Local mirror of the goal so the UI updates immediately after a save,
  // independent of the parent's `athlete` prop (a point-in-time snapshot
  // from the roster list that won't itself refresh after this write).
  const [goal, setGoal] = useState(athlete.focusGoal);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal?.text || '');
  const [emoji, setEmoji] = useState(goal?.emoji || FOCUS_EMOJIS[0]);

  const startEdit = () => { setText(goal?.text || ''); setEmoji(goal?.emoji || FOCUS_EMOJIS[0]); setEditing(true); };
  const save = () => {
    if (!text.trim()) return;
    const next = { text: text.trim(), emoji, authorName, done: false, updatedAt: Date.now() };
    saveProfile(athlete.uid, { focusGoal: next });
    setGoal(next);
    setEditing(false);
  };
  const toggleDone = () => {
    if (!goal) return;
    const next = { ...goal, done: !goal.done };
    saveProfile(athlete.uid, { focusGoal: next });
    setGoal(next);
  };

  return (
    <div className="card p-5">
      <div className="font-[700] text-[13px] flex items-center gap-2"><Target size={14} className="text-[var(--c-D4AF37)]"/> 목표 메시지</div>
      {editing ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_EMOJIS.map(e=>(
              <button key={e} onClick={()=>setEmoji(e)} className={`w-9 h-9 rounded-[10px] border text-[16px] flex items-center justify-center ${emoji===e?'gold-gradient border-[var(--c-D4AF37)]':'bg-[var(--c-18181B)] border-[var(--c-232326)]'}`}>{e}</button>
            ))}
          </div>
          <textarea
            autoFocus value={text} onChange={e=>setText(e.target.value)}
            placeholder="예: 화이팅! 코너 진입만 더 신경 쓰면 돼"
            className="field w-full min-h-[70px] rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)] resize-none"
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={!text.trim()} className="flex-1 h-10 rounded-full gold-gradient text-[var(--c-on-accent)] font-[800] text-[12px] disabled:opacity-40">저장</button>
            <button onClick={()=>setEditing(false)} className="h-10 px-4 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[12px] font-[700] text-[var(--c-9A9A93)]">취소</button>
          </div>
        </div>
      ) : goal ? (
        <div className="mt-3 rounded-[14px] subcard p-3.5">
          <div className={`text-[13px] font-[600] leading-[1.5] ${goal.done?'text-[var(--c-6A6A66)] line-through':'text-[var(--c-E8E2D2)]'}`}>{goal.emoji} {goal.text}</div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] text-[var(--c-6A6A66)]">{goal.authorName}</span>
            <div className="flex gap-2">
              <button onClick={toggleDone} className={`text-[11px] font-[700] ${goal.done?'text-[var(--c-D4AF37)]':'text-[var(--c-9A9A93)] hover:text-[var(--c-D4AF37)]'}`}>{goal.done?'완료 취소':'완료로 표시'}</button>
              <button onClick={startEdit} className="text-[11px] font-[700] text-[var(--c-9A9A93)] hover:text-[var(--c-D4AF37)]">수정</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={startEdit} className="mt-3 w-full text-center py-6 text-[11px] text-[var(--c-6A6A66)] hover:text-[var(--c-D4AF37)] transition-colors rounded-[14px] subcard">아직 등록한 목표 메시지가 없어요 · 눌러서 등록해보세요</button>
      )}
    </div>
  );
}

// Admin-only: list every account, edit their display name and 선수/코치 role.
function MemberManagement() {
  const profiles = useAllProfiles(true);
  const [editingUid, setEditingUid] = useState<string|null>(null);
  const [draftName, setDraftName] = useState('');
  const sorted = useMemo(()=> profiles.slice().sort((a,b)=> (a.displayName||'').localeCompare(b.displayName||'')), [profiles]);

  return (
    <div className="card p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="font-[700] text-[14px] flex items-center gap-2"><UserCog size={16} className="text-[var(--c-D4AF37)]"/> 회원 관리</div>
        <span className="text-[10px] font-[700] tracking-[0.12em] px-2 h-5 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-3A3520)] text-[var(--c-D4AF37)] inline-flex items-center">{profiles.length}명</span>
      </div>
      <div className="mt-5 space-y-2">
        {sorted.map(p=>(
          <div key={p.uid} className="subcard rounded-[14px] p-3.5 flex items-center gap-3">
            <Avatar avatarId={p.avatarId} fallback={p.role==='coach' ? '🧑‍🏫' : p.role==='parent' ? '👪' : '⛸️'} className="w-9 h-9 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[14px] shrink-0" />
            <div className="flex-1 min-w-0">
              {editingUid===p.uid ? (
                <input
                  autoFocus value={draftName} onChange={e=>setDraftName(e.target.value)}
                  onBlur={()=>{ if(draftName.trim()) saveProfile(p.uid, { displayName: draftName.trim() }); setEditingUid(null); }}
                  onKeyDown={e=>{ if(e.key==='Enter') (e.target as HTMLInputElement).blur(); }}
                  className="field w-full h-8 rounded-[8px] bg-[var(--c-121214)] border border-[var(--c-3A3520)] px-2 text-[13px] font-[700] outline-none"
                />
              ) : (
                <button onClick={()=>{ setEditingUid(p.uid); setDraftName(p.displayName||''); }} className="text-[13px] font-[700] text-left hover:text-[var(--c-D4AF37)] transition-colors truncate block">{p.displayName || p.email}</button>
              )}
              <div className="text-[11px] text-[var(--c-6A6A66)] truncate">{p.email}</div>
            </div>
            <select
              value={p.role} onChange={e=>saveProfile(p.uid, { role: e.target.value as 'athlete'|'coach'|'parent' })}
              className="field h-8 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[11px] font-[700] text-[var(--c-F5F1E8)] px-2 outline-none shrink-0"
            >
              <option value="athlete">선수</option>
              <option value="coach">코치</option>
              <option value="parent">부모</option>
            </select>
          </div>
        ))}
        {profiles.length===0 && <div className="text-center py-8 text-[12px] text-[var(--c-6A6A66)]">회원이 없어요</div>}
      </div>
    </div>
  );
}

// Read-only view of one athlete's training log for a chosen date, plus a
// coach/admin comment thread.
function AthleteLogDetail({ athlete }: { athlete: UserProfile }) {
  const { user } = useAuth();
  const { logs } = useTrainingLogs(athlete.uid);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(()=> toLocalDateStr(new Date()));
  const [commentText, setCommentText] = useState('');
  const { comments, addComment } = useComments(athlete.uid, selectedDate);

  const selectedLog = logs.find(l=>l.date===selectedDate);
  const calendarDays = useMemo(()=>{
    const y=calendarMonth.getFullYear(), m=calendarMonth.getMonth();
    const first=new Date(y,m,1); const last=new Date(y,m+1,0);
    const start=(first.getDay()+6)%7; const days=last.getDate();
    const cells:(Date|null)[]=[]; for(let i=0;i<start;i++) cells.push(null); for(let d=1; d<=days; d++) cells.push(new Date(y,m,d)); while(cells.length%7!==0) cells.push(null); return cells;
  },[calendarMonth]);

  const submitComment = ()=>{
    if(!user || !commentText.trim()) return;
    addComment(user.uid, user.displayName || user.email || '코치', commentText);
    setCommentText('');
  };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5">
      <div className="card p-4 h-fit">
        <div className="flex items-center justify-between">
          <div className="font-[800] text-[13px]">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth()+1}월</div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setCalendarMonth(d=>{const nd=new Date(d); nd.setMonth(d.getMonth()-1); return nd;})} className="w-7 h-7 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center hover:border-[var(--c-3A3520)]"><ChevronLeft size={12}/></button>
            <button onClick={()=>setCalendarMonth(d=>{const nd=new Date(d); nd.setMonth(d.getMonth()+1); return nd;})} className="w-7 h-7 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center hover:border-[var(--c-3A3520)]"><ChevronRight size={12}/></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-0 text-center">
          {['월','화','수','목','금','토','일'].map(d=> <div key={d} className="h-[22px] flex items-center justify-center text-[10px] font-[700] text-[var(--c-6A6A66)]">{d}</div>)}
          {calendarDays.map((d,i)=>{
            if(!d) return <div key={i} className="h-[30px]"/>;
            const ds=toLocalDateStr(d);
            const log=logs.find(l=>l.date===ds);
            const isSel=ds===selectedDate;
            return (
              <div key={i} className="h-[30px] flex items-center justify-center">
                <button onClick={()=>setSelectedDate(ds)} className={`w-[26px] h-[26px] rounded-[8px] flex flex-col items-center justify-center border text-[11px] font-[700] ${isSel? 'bg-[var(--c-F5F1E8)] text-[var(--c-on-accent)] border-[var(--c-F5F1E8)]' : 'bg-[var(--c-101012)] border-[var(--c-1E1E22)] text-[var(--c-CFCFC8)] hover:border-[var(--c-2C2A20)]'}`}>
                  <span className="leading-none">{d.getDate()}</span>
                  {log && <span className={`mt-[1px] w-1 h-1 rounded-full ${isSel? 'bg-[var(--c-on-accent)]' : 'bg-[var(--c-D4AF37)]'}`}/>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <FocusGoalEditor athlete={athlete} authorName={user?.displayName || user?.email || '코치'} />
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="font-[800] text-[15px]">{selectedDate}</div>
            {selectedLog && (
              <div className="flex gap-1.5">
                {logTypes(selectedLog).map(t=>(
                  <span key={t} className="text-[10px] font-[700] px-2 h-5 rounded-full bg-[var(--c-1A1A1E)] border border-[var(--c-2A2A2E)] text-[var(--c-9A9A93)] inline-flex items-center">{TYPE_META[t].emoji} {TYPE_META[t].label}</span>
                ))}
              </div>
            )}
          </div>
          {!selectedLog ? (
            <div className="mt-4 py-8 text-center text-[13px] text-[var(--c-6A6A66)]">이 날짜엔 기록이 없어요</div>
          ) : (
            <div className="mt-4 space-y-4">
              {selectedLog.noteIce || (selectedLog.iceItems && selectedLog.iceItems.length>0) ? (
                <div className="subcard rounded-[14px] p-4">
                  <div className="label-caps text-[var(--c-D4AF37)]">⛸️ 빙상 훈련</div>
                  {selectedLog.noteIce && <p className="mt-2 text-[13px] leading-[1.6] text-[var(--c-E8E2D2)] whitespace-pre-wrap">{selectedLog.noteIce}</p>}
                  {selectedLog.iceItems && selectedLog.iceItems.length>0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedLog.iceItems.map(it=> <span key={it.id} className="px-3 h-7 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-2C2A20)] text-[12px] font-[600] text-[var(--c-D4AF37)] inline-flex items-center">{it.type} {it.value}{it.unit}</span>)}
                    </div>
                  )}
                </div>
              ) : null}
              {selectedLog.noteDry || (selectedLog.dryItems && selectedLog.dryItems.length>0) ? (
                <div className="subcard rounded-[14px] p-4">
                  <div className="label-caps text-[var(--c-D4AF37)]">🏋️ 육상 훈련</div>
                  {selectedLog.noteDry && <p className="mt-2 text-[13px] leading-[1.6] text-[var(--c-E8E2D2)] whitespace-pre-wrap">{selectedLog.noteDry}</p>}
                  {selectedLog.dryItems && selectedLog.dryItems.length>0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedLog.dryItems.map(it=> <span key={it.id} className="px-3 h-7 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-2C2A20)] text-[12px] font-[600] text-[var(--c-C9A86A)] inline-flex items-center">{it.type} {it.value}{it.unit}</span>)}
                    </div>
                  )}
                </div>
              ) : null}
              {selectedLog.isRest && (
                <div className="subcard rounded-[14px] p-4 text-center text-[13px] text-[var(--c-9A9A93)]">🌑 리커버리 데이{selectedLog.sleepHours!=null && ` · 수면 ${selectedLog.sleepHours.toFixed(1)}h`}</div>
              )}
              {selectedLog.laps || (selectedLog.timeRecords && selectedLog.timeRecords.length>0) ? (
                <div className="subcard rounded-[14px] p-4 flex flex-wrap gap-4">
                  {selectedLog.laps && <div><div className="label-caps">바퀴수</div><div className="mt-1 font-[800] text-[16px]">{selectedLog.laps}바퀴</div></div>}
                  {selectedLog.timeRecords?.map((r,i)=>(
                    <div key={i}><div className="label-caps">{r.distance}m</div><div className="mt-1 font-[800] text-[16px] text-[var(--c-D4AF37)]">{r.time}</div></div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {selectedLog && (
          <div className="card p-5">
            <div className="font-[700] text-[13px] flex items-center gap-2"><MessageSquare size={14} className="text-[var(--c-D4AF37)]"/> 코멘트</div>
            <div className="mt-3 space-y-2.5">
              {comments.map(c=>(
                <div key={c.id} className="subcard rounded-[12px] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-[700] text-[var(--c-D4AF37)]">{c.authorName}</span>
                    <span className="text-[10px] text-[var(--c-6A6A66)]">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-[var(--c-CFCFC8)] leading-[1.5] whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
              {comments.length===0 && <div className="text-[12px] text-[var(--c-6A6A66)] py-1">아직 코멘트가 없어요</div>}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={commentText} onChange={e=>setCommentText(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') submitComment(); }}
                placeholder="선수에게 코멘트 남기기"
                className="field flex-1 h-10 rounded-full bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 text-[13px] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"
              />
              <button onClick={submitComment} className="h-10 px-4 rounded-full gold-gradient text-[var(--c-on-accent)] font-[800] text-[12px]">남기기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Coach: athletes with coachId == my uid. Parent: athletes with parentId ==
// my uid. Admin: every athlete.
function Roster({ role, myUid, onSelect }: { role: UserRole; myUid: string; onSelect:(p:UserProfile)=>void }) {
  const profiles = useAllProfiles(true);
  const [query, setQuery] = useState('');
  const athletes = useMemo(()=>{
    const base = profiles.filter(p=>p.role==='athlete' && (role==='admin' || (role==='parent' ? p.parentId===myUid : p.coachId===myUid)));
    return query.trim() ? base.filter(p=>(p.displayName||'').includes(query.trim())) : base;
  }, [profiles, role, myUid, query]);
  const title = role==='admin' ? '전체 선수' : role==='parent' ? '내 아이' : '내 선수';
  const emptyLabel = role==='admin' ? '등록된 선수가 없어요' : role==='parent' ? '아직 연결된 아이가 없어요' : '아직 배정된 선수가 없어요';

  return (
    <div className="card p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="font-[700] text-[14px] flex items-center gap-2"><Users size={16} className="text-[var(--c-D4AF37)]"/> {title}</div>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 검색" className="field h-8 w-[140px] rounded-full bg-[var(--c-101012)] border border-[var(--c-2A2A2E)] px-3 text-[12px] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"/>
      </div>
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        {athletes.map(p=>(
          <button key={p.uid} onClick={()=>onSelect(p)} className="subcard rounded-[16px] p-4 text-left transition-all flex items-center gap-3">
            <Avatar avatarId={p.avatarId} fallback="⛸️" className="w-10 h-10 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[16px]" />
            <div className="min-w-0">
              <div className="text-[13px] font-[800] truncate">{p.displayName || p.email}</div>
              <div className="text-[11px] text-[var(--c-6A6A66)] truncate">{p.email}</div>
            </div>
          </button>
        ))}
        {athletes.length===0 && <div className="sm:col-span-2 text-center py-10 text-[12px] text-[var(--c-6A6A66)]">{emptyLabel}</div>}
      </div>
    </div>
  );
}

export default function CoachAdminView({ role }: { role: 'coach' | 'admin' | 'parent' }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'roster'|'members'>(role==='admin' ? 'members' : 'roster');
  const [selectedAthlete, setSelectedAthlete] = useState<UserProfile|null>(null);

  if (!user) return null;

  return (
    <div className="space-y-5">
      {role==='admin' && (
        <div className="flex gap-1.5 p-1 rounded-full bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] w-fit">
          {([['roster','선수 기록'],['members','회원 관리']] as const).map(([val,label])=>(
            <button key={val} onClick={()=>{ setTab(val); setSelectedAthlete(null); }} className={`h-9 px-4 rounded-full text-[12px] font-[700] transition-all ${tab===val? 'gold-gradient text-[var(--c-on-accent)]' : 'text-[var(--c-9A9A93)]'}`}>{label}</button>
          ))}
        </div>
      )}

      {tab==='members' ? (
        <MemberManagement />
      ) : selectedAthlete ? (
        <div>
          <button onClick={()=>setSelectedAthlete(null)} className="mb-4 h-9 px-4 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[12px] font-[700] flex items-center gap-1.5 hover:border-[var(--c-3A3520)]"><ChevronLeft size={14}/> {selectedAthlete.displayName} 목록으로</button>
          <AthleteLogDetail athlete={selectedAthlete} />
        </div>
      ) : (
        <Roster role={role} myUid={user.uid} onSelect={setSelectedAthlete} />
      )}
    </div>
  );
}
