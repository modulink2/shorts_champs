import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, UserPlus, Check } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useAllProfiles, useFriendships, sendFriendRequest, acceptFriendRequest, removeFriendship } from './useProfile';
import { useTrainingLogs } from './useTrainingLogs';
import { Avatar, toLocalDateStr, formatCareer, type UserProfile } from './App';

type Relation = 'none' | 'outgoing' | 'incoming' | 'friend';

function FriendCard({ profile, relation, onRequest, onAccept, onDecline, onOpen }: {
  profile: UserProfile; relation: Relation;
  onRequest: () => void; onAccept: () => void; onDecline: () => void; onOpen: () => void;
}) {
  return (
    <div className="subcard rounded-[16px] p-4 flex items-center gap-3">
      <button onClick={relation==='friend' ? onOpen : undefined} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <Avatar avatarId={profile.avatarId} fallback="⛸️" className="w-10 h-10 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[16px]" />
        <div className="min-w-0">
          <div className="text-[13px] font-[800] truncate">{profile.displayName || profile.email}</div>
          <div className="text-[11px] text-[var(--c-6A6A66)] truncate">{profile.role==='coach'?'코치':profile.role==='parent'?'부모':'선수'}</div>
        </div>
      </button>
      {relation==='none' && <button onClick={onRequest} className="h-8 px-3 rounded-full gold-gradient text-[var(--c-on-accent)] text-[11px] font-[800] shrink-0">친구 신청</button>}
      {relation==='outgoing' && <button onClick={onDecline} className="h-8 px-3 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[11px] font-[700] text-[var(--c-9A9A93)] shrink-0">요청 취소</button>}
      {relation==='incoming' && (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onAccept} className="h-8 px-3 rounded-full gold-gradient text-[var(--c-on-accent)] text-[11px] font-[800]">수락</button>
          <button onClick={onDecline} className="h-8 px-3 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[11px] font-[700] text-[var(--c-9A9A93)]">거절</button>
        </div>
      )}
      {relation==='friend' && <button onClick={onDecline} className="h-8 px-3 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[11px] font-[700] text-[var(--c-9A9A93)] shrink-0">친구 끊기</button>}
    </div>
  );
}

// Read-only calendar + selected-day log — no comments/goal editing (friend view, not coach view).
function FriendTrainingCalendar({ uid }: { uid: string }) {
  const { logs } = useTrainingLogs(uid);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateStr(new Date()));
  const selectedLog = logs.find(l => l.date === selectedDate);
  const calendarDays = useMemo(() => {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0);
    const start = (first.getDay() + 6) % 7; const days = last.getDate();
    const cells: (Date | null)[] = []; for (let i = 0; i < start; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d)); while (cells.length % 7 !== 0) cells.push(null); return cells;
  }, [calendarMonth]);

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5">
      <div className="card p-4 h-fit">
        <div className="flex items-center justify-between">
          <div className="font-[800] text-[13px]">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCalendarMonth(d => { const nd = new Date(d); nd.setMonth(d.getMonth() - 1); return nd; })} className="w-7 h-7 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center hover:border-[var(--c-3A3520)]"><ChevronLeft size={12} /></button>
            <button onClick={() => setCalendarMonth(d => { const nd = new Date(d); nd.setMonth(d.getMonth() + 1); return nd; })} className="w-7 h-7 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center hover:border-[var(--c-3A3520)]"><ChevronRight size={12} /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-0 text-center">
          {['월','화','수','목','금','토','일'].map(d => <div key={d} className="h-[22px] flex items-center justify-center text-[10px] font-[700] text-[var(--c-6A6A66)]">{d}</div>)}
          {calendarDays.map((d, i) => {
            if (!d) return <div key={i} className="h-[30px]" />;
            const ds = toLocalDateStr(d);
            const log = logs.find(l => l.date === ds);
            const isSel = ds === selectedDate;
            return (
              <div key={i} className="h-[30px] flex items-center justify-center">
                <button onClick={() => setSelectedDate(ds)} className={`w-[26px] h-[26px] rounded-[8px] flex flex-col items-center justify-center border text-[11px] font-[700] ${isSel ? 'bg-[var(--c-F5F1E8)] text-[var(--c-on-accent)] border-[var(--c-F5F1E8)]' : 'bg-[var(--c-101012)] border-[var(--c-1E1E22)] text-[var(--c-CFCFC8)] hover:border-[var(--c-2C2A20)]'}`}>
                  <span className="leading-none">{d.getDate()}</span>
                  {log && <span className={`mt-[1px] w-1 h-1 rounded-full ${isSel ? 'bg-[var(--c-on-accent)]' : 'bg-[var(--c-D4AF37)]'}`} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card p-5">
        <div className="font-[800] text-[15px]">{selectedDate}</div>
        {!selectedLog ? (
          <div className="mt-4 py-8 text-center text-[13px] text-[var(--c-6A6A66)]">이 날짜엔 기록이 없어요</div>
        ) : (
          <div className="mt-4 space-y-4">
            {selectedLog.noteIce || (selectedLog.iceItems && selectedLog.iceItems.length > 0) ? (
              <div className="subcard rounded-[14px] p-4">
                <div className="label-caps text-[var(--c-D4AF37)]">⛸️ 빙상 훈련</div>
                {selectedLog.noteIce && <p className="mt-2 text-[13px] leading-[1.6] text-[var(--c-E8E2D2)] whitespace-pre-wrap">{selectedLog.noteIce}</p>}
                {selectedLog.iceItems && selectedLog.iceItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedLog.iceItems.map(it => <span key={it.id} className="px-3 h-7 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-2C2A20)] text-[12px] font-[600] text-[var(--c-D4AF37)] inline-flex items-center">{it.type} {it.value}{it.unit}</span>)}
                  </div>
                )}
              </div>
            ) : null}
            {selectedLog.noteDry || (selectedLog.dryItems && selectedLog.dryItems.length > 0) ? (
              <div className="subcard rounded-[14px] p-4">
                <div className="label-caps text-[var(--c-D4AF37)]">🏋️ 육상 훈련</div>
                {selectedLog.noteDry && <p className="mt-2 text-[13px] leading-[1.6] text-[var(--c-E8E2D2)] whitespace-pre-wrap">{selectedLog.noteDry}</p>}
                {selectedLog.dryItems && selectedLog.dryItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedLog.dryItems.map(it => <span key={it.id} className="px-3 h-7 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-2C2A20)] text-[12px] font-[600] text-[var(--c-C9A86A)] inline-flex items-center">{it.type} {it.value}{it.unit}</span>)}
                  </div>
                )}
              </div>
            ) : null}
            {selectedLog.isRest && (
              <div className="subcard rounded-[14px] p-4 text-center text-[13px] text-[var(--c-9A9A93)]">🌑 리커버리 데이{selectedLog.sleepHours != null && ` · 수면 ${selectedLog.sleepHours.toFixed(1)}h`}</div>
            )}
            {selectedLog.laps || (selectedLog.timeRecords && selectedLog.timeRecords.length > 0) ? (
              <div className="subcard rounded-[14px] p-4 flex flex-wrap gap-4">
                {selectedLog.laps && <div><div className="label-caps">바퀴수</div><div className="mt-1 font-[800] text-[16px]">{selectedLog.laps}바퀴</div></div>}
                {selectedLog.timeRecords?.map((r, i) => (
                  <div key={i}><div className="label-caps">{r.distance}m</div><div className="mt-1 font-[800] text-[16px] text-[var(--c-D4AF37)]">{r.time}</div></div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only detail: friend's public profile card + (if trainingPublic) their training calendar.
function FriendDetail({ profile }: { profile: UserProfile }) {
  return (
    <div className="space-y-5">
      {profile.infoPublic ? (
        <div className="card p-5 lg:p-6">
          <div className="font-[700] text-[14px]">{profile.displayName} 정보</div>
          <div className="mt-3 space-y-2.5">
            {profile.startYearMonth && <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600]">쇼트트랙 시작</span><span className="font-[700] text-[var(--c-F5F1E8)]">{formatCareer(profile.startYearMonth)}</span></div>}
            {profile.coachName && <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600]">담당 코치</span><span className="font-[700] text-[var(--c-F5F1E8)]">{profile.coachName}</span></div>}
            {profile.rinkAddress && <div className="flex items-center justify-between gap-3 text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600] shrink-0">소속 링크장</span><span className="font-[700] text-[var(--c-F5F1E8)] text-right truncate">{profile.rinkAddress}</span></div>}
            {profile.teamName && <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600]">소속팀</span><span className="font-[700] text-[var(--c-F5F1E8)]">{profile.teamName}</span></div>}
            {profile.skateInfo && <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600]">스케이트화</span><span className="font-[700] text-[var(--c-F5F1E8)]">{profile.skateInfo}</span></div>}
            {profile.bladeInfo && <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--c-6A6A66)] font-[600]">날 정보</span><span className="font-[700] text-[var(--c-F5F1E8)]">{profile.bladeInfo}</span></div>}
          </div>
        </div>
      ) : (
        <div className="card p-5 lg:p-6 text-center text-[13px] text-[var(--c-6A6A66)]">비공개 정보예요</div>
      )}
      {profile.trainingPublic ? (
        <FriendTrainingCalendar uid={profile.uid} />
      ) : (
        <div className="card p-5 lg:p-6 text-center text-[13px] text-[var(--c-6A6A66)]">훈련정보가 비공개예요</div>
      )}
    </div>
  );
}

export default function FriendsView() {
  const { user } = useAuth();
  const profiles = useAllProfiles(true);
  const { friends, incoming, outgoing } = useFriendships(user?.uid);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserProfile | null>(null);

  const byUid = useMemo(() => new Map(profiles.map(p => [p.uid, p])), [profiles]);
  const relationOf = (uid: string): Relation => {
    if (friends.includes(uid)) return 'friend';
    if (outgoing.includes(uid)) return 'outgoing';
    if (incoming.includes(uid)) return 'incoming';
    return 'none';
  };

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q || !user) return [];
    return profiles.filter(p => p.uid !== user.uid && (p.displayName || '').includes(q));
  }, [profiles, search, user]);

  const incomingProfiles = incoming.map(uid => byUid.get(uid)).filter((p): p is UserProfile => !!p);
  const friendProfiles = friends.map(uid => byUid.get(uid)).filter((p): p is UserProfile => !!p);

  if (!user) return null;

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="mb-4 h-9 px-4 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] text-[12px] font-[700] flex items-center gap-1.5 hover:border-[var(--c-3A3520)]"><ChevronLeft size={14} /> 내 친구 목록으로</button>
        <FriendDetail profile={selected} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 lg:p-6">
        <div className="font-[700] text-[14px] flex items-center gap-2"><Search size={16} className="text-[var(--c-D4AF37)]" /> 친구 찾기</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름으로 검색" className="field mt-3 w-full h-11 rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 text-[13px] font-[600] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]" />
        {search.trim() && (
          <div className="mt-3 space-y-2">
            {searchResults.map(p => (
              <FriendCard
                key={p.uid} profile={p} relation={relationOf(p.uid)}
                onRequest={() => sendFriendRequest(user.uid, p.uid)}
                onAccept={() => acceptFriendRequest(user.uid, p.uid)}
                onDecline={() => removeFriendship(user.uid, p.uid)}
                onOpen={() => setSelected(p)}
              />
            ))}
            {searchResults.length === 0 && <div className="text-center py-6 text-[12px] text-[var(--c-6A6A66)]">일치하는 계정이 없어요</div>}
          </div>
        )}
      </div>

      {incomingProfiles.length > 0 && (
        <div className="card p-5 lg:p-6">
          <div className="font-[700] text-[14px] flex items-center gap-2"><UserPlus size={16} className="text-[var(--c-D4AF37)]" /> 받은 친구 요청</div>
          <div className="mt-3 space-y-2">
            {incomingProfiles.map(p => (
              <FriendCard
                key={p.uid} profile={p} relation="incoming"
                onRequest={() => {}} onOpen={() => {}}
                onAccept={() => acceptFriendRequest(user.uid, p.uid)}
                onDecline={() => removeFriendship(user.uid, p.uid)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card p-5 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="font-[700] text-[14px] flex items-center gap-2"><Check size={16} className="text-[var(--c-D4AF37)]" /> 내 친구</div>
          <span className="text-[10px] font-[700] tracking-[0.12em] px-2 h-5 rounded-full bg-[var(--c-1A1912)] border border-[var(--c-3A3520)] text-[var(--c-D4AF37)] inline-flex items-center">{friendProfiles.length}명</span>
        </div>
        <div className="mt-3 space-y-2">
          {friendProfiles.map(p => (
            <FriendCard
              key={p.uid} profile={p} relation="friend"
              onRequest={() => {}} onAccept={() => {}}
              onDecline={() => removeFriendship(user.uid, p.uid)}
              onOpen={() => setSelected(p)}
            />
          ))}
          {friendProfiles.length === 0 && <div className="text-center py-8 text-[12px] text-[var(--c-6A6A66)]">아직 친구가 없어요 · 위에서 검색해보세요</div>}
        </div>
      </div>
    </div>
  );
}
