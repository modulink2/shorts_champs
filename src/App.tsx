import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Trophy, Target, Activity, Calendar, BarChart3, TrendingUp, Award, Flame, Crown, ExternalLink, Link2, Play, LogOut } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import { useAuth } from './AuthContext';
import { useTrainingLogs } from './useTrainingLogs';

// Types
type TrainingType = 'ice' | 'dry' | 'rest';
type ViewType = 'dashboard' | 'diary' | 'records' | 'growth';
type Mood = 1 | 2 | 3 | 4 | 5;

export interface TimeRecord { distance: number; time: string; seconds: number; }
export interface TrainingLog {
  id: string; date: string; type: TrainingType; minutes: number; condition: number; rpe: number; laps?: number; km?: number;
  timeRecords?: TimeRecord[]; dryItems?: string[]; pain: boolean; note: string; focus?: number; sleepHours?: number;
  youtubeUrl?: string; instaUrl?: string;
}
interface BodyRecord { date: string; height: number; weight: number; }
interface Goal { id:string; title:string; target:string; current:string; progress:number; icon:string; }
interface Mental { subject:string; value:number; fullMark:number; }

const TRACK = 111.12;
const GOLD = '#D4AF37';
const GOLD_BRIGHT = '#FFD700';
const GOLD_GRAD = 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #FFC700 100%)';

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    // youtu.be/ID
    const shortMatch = trimmed.match(/(?:youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    // youtube.com/watch?v=ID, embed, v, shorts
    const longMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (longMatch) return longMatch[1];
    // query param
    const u = new URL(trimmed);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v && v.length >= 11) return v.substring(0,11);
      // /embed/ID already handled but fallback
      const parts = u.pathname.split('/');
      const last = parts.pop() || parts.pop();
      if (last && /^[A-Za-z0-9_-]{11}$/.test(last)) return last;
    }
    // fallback: if user pasted just ID
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
    return null;
  } catch {
    // if not a valid URL but might be ID
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
}
function isValidInstaUrl(url: string): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.hostname.includes('instagram.com') || u.hostname.includes('instagr.am');
  } catch {
    return false;
  }
}
function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '…';
}

const MOODS: { id: Mood; emoji: string; label: string }[] = [
  { id: 1, emoji: '👑', label: '최고' },
  { id: 2, emoji: '✨', label: '좋음' },
  { id: 3, emoji: '⚪', label: '보통' },
  { id: 4, emoji: '🌙', label: '힘듦' },
  { id: 5, emoji: '🩹', label: '아픔' },
];
const TYPE_META: Record<TrainingType, { label: string; emoji: string; color: string }> = {
  ice: { label: '빙상', emoji: '⛸️', color: GOLD },
  dry: { label: '육상', emoji: '🏋️', color: '#C9A86A' },
  rest: { label: '리커버리', emoji: '🌑', color: '#4A4A4E' },
};

const mockBody: BodyRecord[] = [
  { date: '07월', height: 147.1, weight: 37.8 },
  { date: '08월', height: 148.2, weight: 38.5 },
  { date: '09월', height: 149.0, weight: 39.1 },
  { date: '10월', height: 149.8, weight: 39.8 },
  { date: '11월', height: 150.5, weight: 40.2 },
  { date: '12월', height: 151.2, weight: 40.8 },
];
const mockMental: Mental[] = [
  { subject: '집중력', value: 88, fullMark: 100 },
  { subject: '지구력', value: 82, fullMark: 100 },
  { subject: '스피드', value: 91, fullMark: 100 },
  { subject: '유연성', value: 76, fullMark: 100 },
  { subject: '멘탈', value: 84, fullMark: 100 },
  { subject: '코너링', value: 90, fullMark: 100 },
];
const mockGoals: Goal[] = [
  { id:'g1', title:'500m 50초 벽 돌파', target:'50.00', current:'52.14', progress:78, icon:'🏆' },
  { id:'g2', title:'주 5일 빙상 훈련', target:'5일', current:'4일', progress:80, icon:'⛸️' },
  { id:'g3', title:'월 1000바퀴 챌린지', target:'1000', current:'847', progress:84, icon:'👑' },
];

export default function App() {
  const { user, logOut } = useAuth();
  const { logs, saveLog: saveLogRemote, deleteLog: deleteLogRemote } = useTrainingLogs(user?.uid);
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [showModal, setShowModal] = useState(false);
  const [diaryEditMode, setDiaryEditMode] = useState(false);
  const [editing, setEditing] = useState<Partial<TrainingLog> & { mood?: Mood; time500?: string; time1000?: string }>({});
  const [toast, setToast] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [time500Input, setTime500Input] = useState('');
  const [time1000Input, setTime1000Input] = useState('');
  const [searchType, setSearchType] = useState<'all'|'ice'|'dry'|'rest'>('all');

  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),2600); return ()=>clearTimeout(t);} },[toast]);
  // Switch to edit mode automatically when changing to diary view? keep false initially
  useEffect(()=>{ if(view!=='diary') setDiaryEditMode(false); },[view]);

  const todayStr = new Date().toISOString().slice(0,10);

  const filteredLogs = useMemo(()=> searchType==='all' ? logs : logs.filter(l=>l.type===searchType), [logs, searchType]);
  const thisMonthLogs = useMemo(()=> logs.filter(l=>{ const d=new Date(l.date); const n=new Date(); return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear(); }),[logs]);
  const thisWeekLogs = useMemo(()=>{
    const now=new Date(); const start=new Date(now); const dayIdx=(now.getDay()+6)%7; start.setDate(now.getDate()-dayIdx);
    return logs.filter(l=>{ const d=new Date(l.date); return d>=start; });
  },[logs]);
  const totalLapsMonth = useMemo(()=> thisMonthLogs.reduce((a,b)=>a+(b.laps||0),0),[thisMonthLogs]);
  const totalKmMonth = useMemo(()=> thisMonthLogs.reduce((a,b)=>a+(b.km||0),0),[thisMonthLogs]);
  const totalLapsWeek = useMemo(()=> thisWeekLogs.reduce((a,b)=>a+(b.laps||0),0),[thisWeekLogs]);

  const best500 = useMemo(()=>{
    let best=Infinity; let str='-';
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(r.distance===500 && r.seconds<best){ best=r.seconds; str=r.time; } }));
    return { time:str, sec:best };
  },[logs]);
  const best1000 = useMemo(()=>{
    let best=Infinity; let str='-';
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(r.distance===1000 && r.seconds<best){ best=r.seconds; str=r.time; } }));
    return { time:str, sec:best };
  },[logs]);

  const time500List = useMemo(()=>{
    const arr: { date:string; seconds:number; time:string }[]=[];
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(r.distance===500) arr.push({date:l.date, seconds:r.seconds, time:r.time}); }));
    return arr.sort((a,b)=> a.date.localeCompare(b.date)).slice(-12);
  },[logs]);
  const time1000List = useMemo(()=>{
    const arr: { date:string; seconds:number; time:string }[]=[];
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(r.distance===1000) arr.push({date:l.date, seconds:r.seconds, time:r.time}); }));
    return arr.sort((a,b)=> b.date.localeCompare(a.date)).slice(0,8);
  },[logs]);

  const weeklyVolume = useMemo(()=>{
    const days: { name:string; laps:number; date:string }[] = [];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const ds=d.toISOString().slice(0,10);
      const log=logs.find(l=>l.date===ds);
      days.push({ name: ['월','화','수','목','금','토','일'][(d.getDay()+6)%7], laps: log?.laps||0, date: ds });
    }
    return days;
  },[logs]);

  const conditionTrend = useMemo(()=>{
    return logs.slice(-14).map(l=>({ date: l.date.slice(5).replace('-','/'), cond: 6 - l.condition, rpe: l.rpe }));
  },[logs]);

  const typeDist = useMemo(()=>{
    const ice = logs.filter(l=>l.type==='ice').length;
    const dry = logs.filter(l=>l.type==='dry').length;
    const rest = logs.filter(l=>l.type==='rest').length;
    return [{ name:'빙상', value:ice, color:'#D4AF37' }, { name:'육상', value:dry, color:'#C9A86A' }, { name:'휴식', value:rest, color:'#2A2A2E' }];
  },[logs]);

  const lapAnalysis = useMemo(()=>{
    const iceLogs = logs.filter(l=>l.type==='ice' && l.laps).slice(-10);
    return iceLogs.map(l=>({ date:l.date.slice(5).replace('-','/'), laps:l.laps||0, km:l.km||0 }));
  },[logs]);

  const calendarDays = useMemo(()=>{
    const y=calendarMonth.getFullYear(), m=calendarMonth.getMonth();
    const first=new Date(y,m,1); const last=new Date(y,m+1,0);
    const start=(first.getDay()+6)%7; const days=last.getDate();
    const cells:(Date|null)[]=[]; for(let i=0;i<start;i++) cells.push(null); for(let d=1; d<=days; d++) cells.push(new Date(y,m,d)); while(cells.length%7!==0) cells.push(null); return cells;
  },[calendarMonth]);

  const formatDiaryTitle = (dateStr:string)=>{
    try{
      const d=new Date(dateStr+'T00:00:00');
      const month=d.getMonth()+1;
      const day=d.getDate();
      const wk=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][d.getDay()];
      return `${month}월 ${day}일, ${wk}의 훈련`;
    }catch{ return dateStr; }
  };
  const recentLogsWithRecord = useMemo(()=> logs.filter(l=>l.type!=='rest' || (l.note&&l.note.length>0)).slice(-5).reverse(), [logs]);
  const selectedLog = useMemo(()=> logs.find(l=>l.date===selectedDate), [logs, selectedDate]);

 const openLog = (dateStr:string)=>{
   const existing = logs.find(l=>l.date===dateStr);
   if(existing){
     const t500 = existing.timeRecords?.find(r=>r.distance===500)?.time || '';
     const t1000 = existing.timeRecords?.find(r=>r.distance===1000)?.time || '';
      setEditing({ ...existing, mood: (existing.condition as Mood)||2, time500: t500, time1000: t1000, youtubeUrl: existing.youtubeUrl||'', instaUrl: existing.instaUrl||'' });
      setTime500Input(t500); setTime1000Input(t1000);
    }else{
      setEditing({ date:dateStr, type:'ice', minutes:70, mood:2 as Mood, laps:55, rpe:5, dryItems:[], note:'', time500:'', time1000:'', condition:2, focus:4, sleepHours:8, youtubeUrl:'', instaUrl:'' });
      setTime500Input(''); setTime1000Input('');
    }
    setSelectedDate(dateStr);
    if(view==='diary'){
      setDiaryEditMode(true);
    }else{
      setShowModal(true);
    }
  };

  const saveLog = ()=>{
    if(!editing.date) return;
    const laps = editing.type==='ice' ? (editing.laps||0) : undefined;
    const km = laps ? +(laps*TRACK/1000).toFixed(2) : undefined;
    const timeRecs: TimeRecord[]=[];
    const parseTime = (raw:string)=>{
      raw=raw.trim(); if(!raw) return null;
      let sec=0;
      if(raw.includes(':')){ const [mm, ss]=raw.split(':'); sec=parseInt(mm)*60+parseFloat(ss); } else sec=parseFloat(raw)||0;
      if(sec<=0) return null;
      return { sec, display: raw.includes(':')? raw : sec.toFixed(2) };
    };
    const p500 = parseTime(time500Input);
    if(p500) timeRecs.push({ distance:500, time:p500.display, seconds:p500.sec });
    const p1000 = parseTime(time1000Input);
    if(p1000) timeRecs.push({ distance:1000, time:p1000.display, seconds:p1000.sec });
    const prev = logs.find(l=>l.date===editing.date);
    prev?.timeRecords?.forEach(r=>{ if(r.distance===1500) timeRecs.push(r); });

    const cleanYt = (editing.youtubeUrl||'').trim();
    const cleanInsta = (editing.instaUrl||'').trim();
    const newLog: TrainingLog = {
      id: editing.date!, date: editing.date!, type: (editing.type as TrainingType)||'ice',
      minutes: editing.type==='rest'?0: (editing.minutes||0),
      condition: (editing.mood as number)||2,
      rpe: editing.rpe||5, laps, km, timeRecords: timeRecs,
      dryItems: editing.dryItems||[], pain: (editing.mood===5), note: editing.note||'',
      focus: editing.focus||4, sleepHours: editing.sleepHours||8,
      youtubeUrl: cleanYt || undefined,
      instaUrl: cleanInsta || undefined
    };
    saveLogRemote(newLog);
    setShowModal(false); setDiaryEditMode(false); setToast('기록 완료 · 챔피언의 하루가 쌓였어요 👑');
  };

  const deleteLog = (dateStr:string)=>{
    deleteLogRemote(dateStr);
    setDiaryEditMode(false);
    setToast('기록이 삭제되었어요');
  };

  return (
    <div className="min-h-screen w-full bg-[#060608] text-[#F5F1E8] selection:bg-[#D4AF37]/20 antialiased overflow-x-hidden">
      {/* subtle radial gold vignette */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(212,175,55,0.10),transparent_60%),radial-gradient(60%_40%_at_90%_10%,rgba(201,168,106,0.06),transparent_50%)]" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:flex w-[256px] shrink-0 flex-col bg-[#08080A] border-r border-[#1C1A12] sticky top-0 h-screen">
          <div className="h-[72px] px-6 flex items-center gap-3 border-b border-[#1C1A12]">
            <div className="w-9 h-9 rounded-[12px] gold-gradient flex items-center justify-center text-[#060608] font-[900] text-[16px] shadow-[0_0_20px_rgba(212,175,55,0.4)]">S</div>
            <div>
              <div className="font-[800] text-[13px] tracking-[-0.02em] leading-none">SHORT TRACK</div>
              <div className="text-[10px] font-[700] tracking-[0.18em] text-[#D4AF37] mt-1">CHAMPION EDITION</div>
            </div>
          </div>
          <div className="p-3 space-y-1.5 flex-1">
            {[
              { id:'dashboard', label:'대시보드', icon:BarChart3, desc:'OVERALL' },
              { id:'diary', label:'훈련일지', icon:Calendar, desc:'LOGS' },
              { id:'records', label:'기록분석', icon:Trophy, desc:'RECORDS' },
              { id:'growth', label:'성장리포트', icon:TrendingUp, desc:'GROWTH' },
            ].map(tab=>{
              const active=view===tab.id;
              const Icon=tab.icon;
              return (
                <button key={tab.id} onClick={()=>setView(tab.id as ViewType)} className={`group w-full h-[56px] rounded-[14px] flex items-center gap-3 px-3.5 text-left transition-all border ${active?'bg-[#121214] border-[#3A3520] shadow-[0_0_20px_rgba(212,175,55,0.12)]':'bg-transparent border-transparent hover:bg-[#121214] hover:border-[#2A2A2E]'}`}>
                  <div className={`w-[1.5px] self-stretch rounded-full -ml-3.5 mr-1 transition-all ${active?'bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]':'bg-transparent group-hover:bg-[#2A2A2E]'}`} />
                  <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center border transition-all ${active?'gold-gradient text-[#060608] border-[#D4AF37]/30 shadow-[0_0_12px_rgba(212,175,55,0.3)]':'bg-[#151519] border-[#232326] text-[#9A9A93] group-hover:text-[#F5F1E8]'}`}>
                    <Icon size={18} strokeWidth={active?2.5:1.8}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-[700] tracking-[-0.01em] leading-none ${active?'text-[#F5F1E8]':'text-[#CFCFC8]'}`}>{tab.label}</div>
                    <div className={`text-[10px] font-[600] tracking-[0.12em] mt-1 ${active?'text-[#D4AF37]':'text-[#6A6A66]'}`}>{tab.desc}</div>
                  </div>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />}
                </button>
              );
            })}
            <div className="pt-6 px-3">
              <div className="card-gold rounded-[16px] p-4 overflow-hidden">
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-[#D4AF37]" />
                  <span className="label-caps text-[#D4AF37]">Today's Focus</span>
                </div>
                <div className="mt-2.5 text-[12px] font-[600] leading-[1.4] text-[#E8E2D2]">"코너에서 더 낮게, 더 빠르게. 챔피언은 디테일에서 갈린다."</div>
                <div className="mt-3 h-[1px] bg-[#2A2A20]" />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-[500] text-[#9A9A93]">시즌 D-47</span>
                  <span className="text-[11px] font-[700] text-[#D4AF37]">72% 달성</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-[#1C1A12]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#18181B] border border-[#2A2A2E] flex items-center justify-center text-[14px]">⛸️</div>
              <div className="min-w-0">
                <div className="text-[12px] font-[700] truncate">{user?.displayName || '챔피언'}</div>
                <div className="text-[10px] font-[500] text-[#9A9A93] truncate">{user?.email}</div>
              </div>
              <button onClick={logOut} className="ml-auto text-[10px] font-[700] text-[#9A9A93] hover:text-[#D4AF37] transition-colors shrink-0">로그아웃</button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Top bar mobile + desktop header */}
          <header className="sticky top-0 z-20 backdrop-blur-[20px] bg-[#060608]/80 border-b border-[#1C1A12]">
            <div className="h-[64px] lg:h-[72px] px-4 lg:px-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="lg:hidden w-8 h-8 rounded-[10px] gold-gradient flex items-center justify-center text-[#060608] font-[900]">S</div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[18px] lg:text-[22px] font-[800] tracking-[-0.03em] leading-none">
                      {view==='dashboard' && '대시보드'}
                      {view==='diary' && '훈련일지'}
                      {view==='records' && '기록분석'}
                      {view==='growth' && '성장리포트'}
                    </h1>
                    <span className="hidden sm:inline-flex h-5 px-2 rounded-full bg-[#1A1912] border border-[#3A3520] text-[10px] font-[700] tracking-[0.1em] text-[#D4AF37] items-center">BLACK & GOLD</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-[500] text-[#9A9A93]">{new Date().toLocaleDateString('ko-KR',{month:'long', day:'numeric', weekday:'short'})} · 챔피언 모드</span>
                    <span className="w-1 h-1 rounded-full bg-[#2A2A2E]" />
                    <span className="text-[11px] font-[600] text-[#D4AF37]">오늘도 1% 성장</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 pl-3 pr-1 h-9 rounded-full bg-[#101012] border border-[#2A2A2E]">
                  <div className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center"><Flame size={12} className="text-[#060608]"/></div>
                  <span className="text-[11px] font-[700] text-[#F5F1E8]">스트릭 12일</span>
                  <span className="h-6 px-2.5 rounded-full gold-gradient text-[#060608] text-[11px] font-[800] flex items-center">LVL 8</span>
                </div>
                <button onClick={()=>openLog(todayStr)} className="h-9 lg:h-10 px-4 lg:px-5 rounded-full gold-gradient text-[#060608] font-[800] text-[12px] lg:text-[13px] flex items-center gap-1.5 shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_28px_rgba(212,175,55,0.35)] active:scale-[0.98] transition-all">
                  <span className="hidden sm:inline">✦</span> 기록하기
                </button>
                <button onClick={logOut} title="로그아웃" className="lg:hidden w-9 h-9 rounded-full bg-[#101012] border border-[#2A2A2E] flex items-center justify-center text-[#9A9A93] hover:text-[#D4AF37] hover:border-[#3A3520] transition-colors">
                  <LogOut size={15} />
                </button>
              </div>
            </div>
            {/* Mobile tabs */}
            <div className="lg:hidden px-4 pb-3 flex gap-1.5 overflow-x-auto">
              {[
                { id:'dashboard', label:'대시보드' },
                { id:'diary', label:'훈련일지' },
                { id:'records', label:'기록분석' },
                { id:'growth', label:'성장리포트' },
              ].map(tab=>{
                const active=view===tab.id;
                return (
                  <button key={tab.id} onClick={()=>setView(tab.id as ViewType)} className={`whitespace-nowrap h-8 px-4 rounded-full text-[12px] font-[700] border transition-all ${active?'gold-gradient text-[#060608] border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.3)]':'bg-[#101012] border-[#2A2A2E] text-[#9A9A93]'}`}>{tab.label}</button>
                );
              })}
            </div>
          </header>

          <main className="px-4 lg:px-10 py-6 lg:py-8 pb-[96px] lg:pb-10 space-y-6 lg:space-y-8 max-w-[1280px] mx-auto">
            {view==='dashboard' && (
              <>
                {/* KPI 4 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 lg:gap-5">
                  <div className="card p-4 lg:p-5">
                    <div className="flex items-start justify-between">
                      <span className="label-caps">Weekly Days</span>
                      <div className="w-7 h-7 rounded-full bg-[#18181B] border border-[#2A2A2E] flex items-center justify-center"><Calendar size={14} className="text-[#D4AF37]"/></div>
                    </div>
                    <div className="mt-3 big-num text-[32px] lg:text-[38px] gold-text">{thisWeekLogs.length}<span className="text-[16px] text-[#9A9A93] ml-1 font-[600]">일</span></div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#1A1A1E] overflow-hidden"><div className="h-full gold-gradient rounded-full" style={{width:`${Math.min(100, thisWeekLogs.length/5*100)}%`}}/></div>
                      <span className="text-[10px] font-[700] text-[#9A9A93]">목표 5일</span>
                    </div>
                  </div>
                  <div className="card p-4 lg:p-5">
                    <div className="flex items-start justify-between">
                      <span className="label-caps">Total Laps</span>
                      <div className="w-7 h-7 rounded-full bg-[#18181B] border border-[#2A2A2E] flex items-center justify-center"><Activity size={14} className="text-[#D4AF37]"/></div>
                    </div>
                    <div className="mt-3 big-num text-[32px] lg:text-[38px] text-[#F5F1E8]">{totalLapsMonth.toLocaleString()}<span className="text-[14px] text-[#9A9A93] ml-1 font-[600]">바퀴</span></div>
                    <div className="mt-2 text-[11px] font-[500] text-[#9A9A93]">이번달 · <span className="text-[#D4AF37] font-[700]">+{totalLapsWeek} 이번주</span></div>
                  </div>
                  <div className="card p-4 lg:p-5">
                    <div className="flex items-start justify-between">
                      <span className="label-caps">Distance</span>
                      <div className="w-7 h-7 rounded-full bg-[#18181B] border border-[#2A2A2E] flex items-center justify-center"><Target size={14} className="text-[#D4AF37]"/></div>
                    </div>
                    <div className="mt-3 big-num text-[32px] lg:text-[38px] text-[#F5F1E8]">{totalKmMonth.toFixed(1)}<span className="text-[14px] text-[#9A9A93] ml-1 font-[600]">km</span></div>
                    <div className="mt-2 text-[11px] font-[500] text-[#9A9A93]">트랙 111.12m 기준</div>
                  </div>
                  <div className="card p-4 lg:p-5 bg-[#101012] border-[#3A3520] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(212,175,55,0.15),transparent_60%)]" />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <span className="label-caps text-[#D4AF37]">Best 500m</span>
                        <div className="w-7 h-7 rounded-full gold-gradient flex items-center justify-center"><Trophy size={14} className="text-[#060608]"/></div>
                      </div>
                      <div className="mt-3 big-num text-[30px] lg:text-[34px] gold-text">{best500.time==='-'?'--':best500.time}</div>
                      <div className="mt-2 text-[11px] font-[600] text-[#C9A86A]">Personal Best · 상위 8% 진입</div>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5 lg:gap-6">
                  {/* Weekly volume */}
                  <div className="card p-5 lg:p-6">
                    <div className="flex items-center justify-between">
                      <div className="font-[700] text-[14px] tracking-[-0.01em]">주간 볼륨 · 바퀴수</div>
                      <div className="flex items-center gap-1.5 text-[10px] font-[700] tracking-[0.08em] text-[#9A9A93]"><span className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"/>LAPS</div>
                    </div>
                    <div className="mt-5 h-[168px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyVolume} barCategoryGap="32%">
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#9A9A93', fontWeight:600 }} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill:'rgba(212,175,55,0.04)' }} contentStyle={{ background:'#121214', border:'1px solid #2C2A20', borderRadius:12, fontSize:12 }} labelStyle={{ color:'#9A9A93' }}/>
                          <Bar dataKey="laps" radius={[8,8,4,4]}>
                            {weeklyVolume.map((_,i)=> <Cell key={i} fill={weeklyVolume[i].laps>0 ? '#D4AF37' : '#232326'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {weeklyVolume.map((d,i)=>(
                        <div key={i} className="text-center">
                          <div className={`text-[10px] font-[700] ${d.laps>60?'text-[#D4AF37]':'text-[#6A6A66]'}`}>{d.laps>0? `${d.laps}`:'-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Condition & RPE */}
                  <div className="card p-5 lg:p-6">
                    <div className="flex items-center justify-between">
                      <div className="font-[700] text-[14px]">컨디션 & RPE 추세</div>
                      <div className="flex gap-2 text-[10px] font-[600]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#D4AF37]"/>컨디션</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4A4A4E]"/>RPE</span>
                      </div>
                    </div>
                    <div className="mt-5 h-[168px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={conditionTrend}>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#6A6A66' }} interval="preserveStartEnd" />
                          <YAxis domain={[0,10]} hide />
                          <Tooltip contentStyle={{ background:'#121214', border:'1px solid #2C2A20', borderRadius:12, fontSize:11 }}/>
                          <Line type="monotone" dataKey="cond" stroke="#D4AF37" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="rpe" stroke="#3A3A3E" strokeWidth={1.5} dot={false} strokeDasharray="4 4"/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 p-3 rounded-[12px] bg-[#0E0E10] border border-[#1E1C14] flex items-center justify-between">
                      <span className="text-[11px] font-[600] text-[#9A9A93]">평균 RPE</span>
                      <span className="text-[13px] font-[800] text-[#F5F1E8]">{(conditionTrend.reduce((a,b)=>a+b.rpe,0)/conditionTrend.length||0).toFixed(1)} / 10</span>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5 lg:gap-6">
                  {/* Recent trainings */}
                  <div className="card p-5 lg:p-6">
                    <div className="flex items-center justify-between">
                      <div className="font-[700] text-[14px]">최근 훈련</div>
                      <div className="flex gap-1.5">
                        {(['all','ice','dry','rest'] as const).map(t=>(
                          <button key={t} onClick={()=>setSearchType(t)} className={`h-6 px-2.5 rounded-full text-[11px] font-[700] border transition-all ${searchType===t?'gold-gradient text-[#060608] border-[#D4AF37]':'bg-[#18181B] border-[#232326] text-[#9A9A93] hover:text-[#F5F1E8]'}`}>{t==='all'?'전체': TYPE_META[t as TrainingType].label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5 max-h-[320px] overflow-auto pr-1">
                      {filteredLogs.slice(-8).reverse().map(log=>{
                        const meta=TYPE_META[log.type];
                        return (
                          <div key={log.id} className="group h-[64px] rounded-[14px] bg-[#101012] border border-[#1E1E22] hover:border-[#2C2A20] hover:bg-[#15151A] flex items-center gap-3 px-3.5 transition-all">
                            <div className="w-10 h-10 rounded-[12px] bg-[#18181B] border border-[#232326] flex items-center justify-center text-[16px]">{meta.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-[700]">{log.date.slice(5).replace('-','/')}</span>
                                <span className="text-[10px] font-[600] px-1.5 h-4 rounded-full bg-[#1A1A1E] border border-[#2A2A2E] text-[#9A9A93]">{meta.label}</span>
                                {log.laps && <span className="text-[10px] font-[600] text-[#D4AF37]">{log.laps}바퀴</span>}
                              </div>
                              <div className="text-[11px] font-[500] text-[#9A9A93] truncate mt-0.5">{log.note}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[12px] font-[800] text-[#F5F1E8]">{log.timeRecords?.[0]?.time || '-'}</div>
                              <div className="text-[10px] font-[600] text-[#6A6A66]">RPE {log.rpe}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Goal card */}
                  <div className="space-y-4">
                    <div className="card p-5 lg:p-6 bg-[#0E0E10] border-[#2C2A20] overflow-hidden">
                      <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(212,175,55,0.14),transparent)] pointer-events-none" />
                      <div className="flex items-center justify-between relative">
                        <div className="font-[700] text-[14px] flex items-center gap-2"><Crown size={16} className="text-[#D4AF37]"/> 시즌 목표</div>
                        <span className="text-[10px] font-[700] tracking-[0.12em] px-2 h-5 rounded-full bg-[#1A1912] border border-[#3A3520] text-[#D4AF37] inline-flex items-center">3 GOALS</span>
                      </div>
                      <div className="mt-5 space-y-4 relative">
                        {mockGoals.map(g=>(
                          <div key={g.id} className="rounded-[14px] bg-[#121214] border border-[#1E1C14] p-3.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2"><span>{g.icon}</span><span className="text-[12px] font-[700]">{g.title}</span></div>
                              <span className="text-[11px] font-[800] px-2 h-5 rounded-full gold-gradient text-[#060608] inline-flex items-center">{g.progress}%</span>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full bg-[#1E1E22] overflow-hidden"><div className="h-full rounded-full gold-gradient" style={{width:`${g.progress}%`}}/></div>
                            <div className="mt-2 flex justify-between text-[10px] font-[600] text-[#9A9A93]"><span>현재 {g.current}</span><span>목표 {g.target}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A1912] border border-[#3A3520] flex items-center justify-center"><Award size={18} className="text-[#D4AF37]"/></div>
                      <div>
                        <div className="text-[12px] font-[700]">챔피언 마인드셋</div>
                        <div className="text-[11px] font-[500] text-[#9A9A93] leading-[1.3] mt-0.5">기록보다 루틴. 매일 같은 시간, 같은 집중.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {view==='diary' && (
              <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
                {/* LEFT 320px sticky */}
                <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-[88px] space-y-4">
                  {/* Mini Calendar */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-[800] text-[13px] tracking-[-0.02em]">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth()+1}월</div>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>setCalendarMonth(d=>{const nd=new Date(d); nd.setMonth(d.getMonth()-1); return nd;})} className="w-7 h-7 rounded-full bg-[#18181B] border border-[#232326] flex items-center justify-center hover:border-[#3A3520] transition-colors"><ChevronLeft size={12}/></button>
                        <button onClick={()=>setCalendarMonth(d=>{const nd=new Date(d); nd.setMonth(d.getMonth()+1); return nd;})} className="w-7 h-7 rounded-full bg-[#18181B] border border-[#232326] flex items-center justify-center hover:border-[#3A3520] transition-colors"><ChevronRight size={12}/></button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-0 text-center">
                      {['월','화','수','목','금','토','일'].map(d=> <div key={d} className="h-[24px] flex items-center justify-center text-[10px] font-[700] text-[#6A6A66]">{d}</div>)}
                      {calendarDays.map((d,i)=>{
                        if(!d) return <div key={i} className="h-[32px] flex items-center justify-center"/>;
                        const ds=d.toISOString().slice(0,10);
                        const log=logs.find(l=>l.date===ds);
                        const isToday=ds===todayStr;
                        const isSel=ds===selectedDate;
                        return (
                          <div key={i} className="h-[32px] flex items-center justify-center">
                            <button onClick={()=>{setSelectedDate(ds); setDiaryEditMode(false);}} className={`w-[28px] h-[28px] rounded-[8px] flex flex-col items-center justify-center border text-[11px] font-[700] transition-all relative ${isSel? 'bg-[#F5F1E8] text-[#060608] border-[#F5F1E8] shadow-[0_2px_10px_rgba(245,241,232,0.25)]' : isToday? 'bg-[#121214] border-[#D4AF37] text-[#F5F1E8]' : 'bg-[#101012] border-[#1E1E22] text-[#CFCFC8] hover:border-[#2C2A20] hover:bg-[#151519]'}`}>
                              <span className="leading-none">{d.getDate()}</span>
                              {log && <span className={`mt-[1px] w-1 h-1 rounded-full ${isSel? 'bg-[#060608]' : log.type==='ice' ? 'bg-[#D4AF37]' : log.type==='dry' ? 'bg-[#C9A86A]' : 'bg-[#4A4A4E]'}`} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-3 text-[10px] font-[600] text-[#6A6A66]">
                      <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#D4AF37]"/>빙상</span>
                      <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#C9A86A]"/>육상</span>
                      <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#4A4A4E]"/>휴식</span>
                    </div>
                  </div>

                  {/* Selected date summary card gold border */}
                  <div className="rounded-[16px] bg-[#101012] border border-[#3A3520] p-4 shadow-[0_0_0_1px_rgba(212,175,55,0.08)_inset,0_8px_24px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between">
                      <span className="label-caps text-[#D4AF37]">선택일 요약</span>
                      <span className="text-[11px] font-[700] text-[#F5F1E8]">{selectedDate.slice(5).replace('-','/')}</span>
                    </div>
                    {selectedLog ? (
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-[10px] bg-[#18181B] border border-[#232326] flex items-center justify-center text-[16px]">{TYPE_META[selectedLog.type].emoji}</div>
                          <span className="text-[13px] font-[800]">{TYPE_META[selectedLog.type].label}</span>
                          <span className="ml-auto text-[12px]">{MOODS.find(m=>m.id===selectedLog.condition)?.emoji}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-[10px] bg-[#121214] border border-[#1E1E22] py-2"><div className="text-[10px] font-[700] text-[#6A6A66]">바퀴</div><div className="text-[13px] font-[800] mt-0.5 text-[#F5F1E8]">{selectedLog.laps ?? '-'}</div></div>
                          <div className="rounded-[10px] bg-[#121214] border border-[#1E1E22] py-2"><div className="text-[10px] font-[700] text-[#6A6A66]">시간</div><div className="text-[11px] font-[700] mt-0.5 text-[#D4AF37]">{selectedLog.timeRecords?.[0]?.time ?? '-'}</div></div>
                          <div className="rounded-[10px] bg-[#121214] border border-[#1E1E22] py-2"><div className="text-[10px] font-[700] text-[#6A6A66]">RPE</div><div className="text-[13px] font-[800] mt-0.5 text-[#F5F1E8]">{selectedLog.rpe}</div></div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 py-4 text-center rounded-[12px] bg-[#0E0E10] border border-[#1E1E22]">
                        <div className="text-[12px] font-[600] text-[#9A9A93]">기록 없음</div>
                        <div className="text-[11px] text-[#6A6A66] mt-1">이날은 아직 비어있어요</div>
                      </div>
                    )}
                  </div>

                  {/* Recent logs */}
                  <div className="card p-4 bg-[#0E0E10] border-[#1E1C14]">
                    <div className="font-[700] text-[12px] flex items-center gap-1.5"><Flame size={12} className="text-[#D4AF37]"/> 훈련 기록이 있는 날</div>
                    <div className="mt-3 space-y-1.5">
                      {recentLogsWithRecord.map(l=>{
                        const isActive=l.date===selectedDate;
                        return (
                          <button key={l.id} onClick={()=>{setSelectedDate(l.date); setDiaryEditMode(false);}} className={`w-full text-left h-[44px] rounded-[12px] border px-3 flex items-center gap-2 transition-all ${isActive?'bg-[#F5F1E8] border-[#F5F1E8] text-[#060608] shadow-[0_2px_12px_rgba(245,241,232,0.2)]':'bg-[#101012] border-[#1E1E22] text-[#CFCFC8] hover:border-[#2C2A20] hover:bg-[#15151A]'}`}>
                            <span className="text-[11px] font-[700] text-[#6A6A66] w-[36px]">{l.date.slice(5)}</span>
                            <span className="text-[14px]">{TYPE_META[l.type].emoji}</span>
                            <span className="text-[12px] font-[700] flex-1 truncate">{l.note || TYPE_META[l.type].label}</span>
                            <span className="text-[11px] font-[700] opacity-70">{l.laps? `${l.laps}바` : ''}</span>
                          </button>
                        );
                      })}
                      {recentLogsWithRecord.length===0 && <div className="text-[11px] text-[#6A6A66] py-2">기록이 없어요</div>}
                    </div>
                  </div>
                </div>

                {/* RIGHT blog-style main */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="rounded-[24px] bg-[#101012] border border-[#1E1C14] lg:border-l-[#3A3520] lg:border-l-[1.5px] min-h-[600px] p-6 lg:p-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#D4AF37]/40 via-[#D4AF37]/10 to-transparent"/>
                    {/* Date title */}
                    <div>
                      <h1 className="text-[28px] lg:text-[32px] font-[800] tracking-[-0.03em] leading-[1.1] text-[#F5F1E8]">{formatDiaryTitle(selectedDate)}</h1>
                      <div className="mt-3 h-[3px] w-[48px] gold-gradient rounded-full"/>
                      <div className="mt-3 text-[13px] font-[500] text-[#9A9A93]">{selectedDate} · {selectedLog? '기록 있음' : '기록 없음'} {selectedLog? `· ${TYPE_META[selectedLog.type].label} ${selectedLog.laps? `${selectedLog.laps}바퀴`:''}` : ''}</div>
                    </div>

                    <div className="mt-8 h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>

                    {diaryEditMode ? (
                      <div className="mt-8">
                        <div className="flex items-center justify-between">
                          <h2 className="text-[24px] lg:text-[28px] font-[800] tracking-[-0.02em]">오늘의 훈련 기록하기</h2>
                          <button onClick={()=>setDiaryEditMode(false)} className="h-9 px-4 rounded-full bg-[#18181B] border border-[#232326] text-[12px] font-[700] hover:border-[#3A3520]">취소</button>
                        </div>
                        <p className="mt-2 text-[14px] font-[500] text-[#9A9A93] leading-[1.6]">챔피언은 기록한다 · 디테일이 차이를 만든다. 여백을 넓게, 천천히 채워요.</p>

                        <div className="mt-8 space-y-10">
                          <div>
                            <div className="label-caps text-[#D4AF37] text-[11px]">오늘의 컨디션</div>
                            <div className="mt-4 grid grid-cols-5 gap-2.5">
                              {MOODS.map(m=>{
                                const active=editing.mood===m.id;
                                return (
                                  <button key={m.id} onClick={()=>setEditing({...editing, mood:m.id, condition:m.id})} className={`h-[72px] rounded-[16px] border flex flex-col items-center justify-center gap-1.5 transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608] shadow-[0_0_18px_rgba(212,175,55,0.35)] scale-[1.02]' : 'bg-[#121214] border-[#232326] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]'}`}>
                                    <span className="text-[20px] leading-none">{m.emoji}</span>
                                    <span className="text-[11px] font-[700]">{m.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>

                          <div>
                            <div className="label-caps text-[#D4AF37] text-[11px]">훈련 타입</div>
                            <div className="mt-4 grid grid-cols-3 gap-3">
                              {(Object.keys(TYPE_META) as TrainingType[]).map(t=>{
                                const active=editing.type===t;
                                const meta=TYPE_META[t];
                                return (
                                  <button key={t} onClick={()=>setEditing({...editing, type:t})} className={`min-h-[84px] rounded-[18px] border p-4 flex flex-col items-center justify-center gap-2 transition-all ${active? 'bg-[#F5F1E8] border-[#F5F1E8] text-[#060608] shadow-[0_0_20px_rgba(245,241,232,0.25)]' : 'bg-[#121214] border-[#232326] hover:border-[#3A3520] text-[#CFCFC8]'}`}>
                                    <span className="text-[28px] leading-none">{meta.emoji}</span>
                                    <span className="text-[13px] font-[800]">{meta.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>

                          {editing.type==='ice' && (
                            <div className="space-y-8">
                              <div className="grid lg:grid-cols-2 gap-4">
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">바퀴수 · LAPS</div>
                                  <div className="mt-4 flex items-center gap-3">
                                    <button onClick={()=>setEditing({...editing, laps: Math.max(0,(editing.laps||0)-5)})} className="w-11 h-11 rounded-full bg-[#18181B] border border-[#232326] font-[800] text-[18px]">−</button>
                                    <div className="flex-1 h-[56px] rounded-[14px] bg-[#121214] border border-[#1E1E22] flex items-center justify-center gap-2">
                                      <input type="number" inputMode="numeric" value={editing.laps||0} onChange={e=>setEditing({...editing, laps: parseInt(e.target.value)||0})} className="w-[80px] bg-transparent text-center font-[800] text-[26px] outline-none"/>
                                      <span className="text-[12px] font-[700] text-[#6A6A66]">바퀴</span>
                                    </div>
                                    <button onClick={()=>setEditing({...editing, laps: (editing.laps||0)+5})} className="w-11 h-11 rounded-full gold-gradient text-[#060608] font-[800] text-[18px]">+</button>
                                  </div>
                                  <div className="mt-3 text-[11px] font-[600] text-[#6A6A66] text-center">{((editing.laps||0)*TRACK/1000).toFixed(2)}km · 111.12m 기준</div>
                                </div>
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">강도 · RPE (1~10)</div>
                                  <div className="mt-4 flex flex-wrap gap-1.5">
                                    {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                                      const active=(editing.rpe||5)>=n;
                                      return <button key={n} onClick={()=>setEditing({...editing, rpe:n})} className={`w-9 h-9 rounded-full text-[12px] font-[800] border transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608]' : 'bg-[#18181B] border-[#232326] text-[#4A4A4E]'}`}>{n}</button>;
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="grid lg:grid-cols-2 gap-4">
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">500m 기록</div>
                                  <input value={time500Input} onChange={e=>setTime500Input(e.target.value)} placeholder="58.32" inputMode="decimal" className="mt-4 w-full h-[56px] rounded-[14px] bg-[#121214] border border-[#1E1E22] px-4 text-[18px] font-[700] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                                </div>
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">1000m 기록</div>
                                  <input value={time1000Input} onChange={e=>setTime1000Input(e.target.value)} placeholder="1:52.10" inputMode="decimal" className="mt-4 w-full h-[56px] rounded-[14px] bg-[#121214] border border-[#1E1E22] px-4 text-[18px] font-[700] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                                </div>
                              </div>
                            </div>
                          )}

                          {editing.type==='dry' && (
                            <div className="space-y-6">
                              <div className="grid lg:grid-cols-2 gap-4">
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">훈련 시간</div>
                                  <div className="mt-4 flex items-center gap-3">
                                    <button onClick={()=>setEditing({...editing, minutes: Math.max(0,(editing.minutes||0)-10)})} className="w-11 h-11 rounded-full bg-[#18181B] border border-[#232326] font-[800] text-[18px]">−</button>
                                    <div className="flex-1 h-[56px] rounded-[14px] bg-[#121214] border border-[#1E1E22] flex items-center justify-center gap-2">
                                      <input type="number" value={editing.minutes||0} onChange={e=>setEditing({...editing, minutes: parseInt(e.target.value)||0})} className="w-[80px] bg-transparent text-center font-[800] text-[26px] outline-none"/>
                                      <span className="text-[12px] font-[700] text-[#6A6A66]">분</span>
                                    </div>
                                    <button onClick={()=>setEditing({...editing, minutes: (editing.minutes||0)+10})} className="w-11 h-11 rounded-full gold-gradient text-[#060608] font-[800] text-[18px]">+</button>
                                  </div>
                                </div>
                                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                  <div className="label-caps">항목 선택 · 3개까지</div>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {['러닝','점프','코어','웨이트','스트레칭','스프린트','밸런스'].map(item=>{
                                      const active=editing.dryItems?.includes(item);
                                      return (
                                        <button key={item} onClick={()=>{
                                          const cur=editing.dryItems||[];
                                          const next= active? cur.filter(c=>c!==item) : cur.length<3? [...cur, item] : cur;
                                          setEditing({...editing, dryItems:next});
                                        }} className={`h-10 px-4 rounded-full border text-[13px] font-[700] transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608]' : 'bg-[#18181B] border-[#232326] text-[#9A9A93] hover:border-[#3A3520]'}`}>{item}</button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                         {editing.type==='rest' && (
                           <div className="rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 text-center">
                             <div className="w-16 h-16 mx-auto rounded-full bg-[#121214] border border-[#2C2A20] flex items-center justify-center text-[28px]">🌑</div>
                             <div className="mt-4 font-[800] text-[18px]">리커버리 데이</div>
                             <div className="mt-2 text-[14px] font-[500] text-[#9A9A93] leading-[1.6]">잘 쉬는 것도 전략. 내일 더 강하게 돌아오자.</div>
                           </div>
                         )}


                          {/* Media links section */}
                          <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/30 via-[#2A2A20] to-transparent"/>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link2 size={14} className="text-[#D4AF37]" />
                              <div className="label-caps text-[#D4AF37] text-[11px]">오늘의 영상 / 사진 링크</div>
                            </div>
                            <div className="mt-1 text-[11px] font-[500] text-[#6A6A66]">훈련 영상을 붙이면 본문에서 바로 볼 수 있어요</div>
                            <div className="mt-5 grid gap-4">
                              <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 rounded-full bg-[#FF0000]/15 border border-[#FF0000]/20 flex items-center justify-center"><Play size={12} className="text-[#FF4D4D]" /></div>
                                  <span className="text-[12px] font-[700] text-[#F5F1E8]">유튜브 영상</span>
                                  <span className="text-[10px] font-[600] text-[#6A6A66]">선택</span>
                                </div>
                                <input type="url" value={editing.youtubeUrl||''} onChange={e=>setEditing({...editing, youtubeUrl:e.target.value})} placeholder="유튜브 공유 링크를 붙여넣으세요" className="w-full h-[48px] rounded-[12px] bg-[#121214] border border-[#1E1E22] px-4 text-[13px] font-[500] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                                {editing.youtubeUrl && extractYouTubeId(editing.youtubeUrl) && (
                                  <div className="mt-3 text-[11px] font-[600] text-[#D4AF37] flex items-center gap-1"><Play size={10}/> 미리보기 가능 · ID: {extractYouTubeId(editing.youtubeUrl)}</div>
                                )}
                              </div>
                              <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#feda75] to-[#d62976] flex items-center justify-center"><Link2 size={12} className="text-white"/></div>
                                  <span className="text-[12px] font-[700] text-[#F5F1E8]">인스타그램</span>
                                  <span className="text-[10px] font-[600] text-[#6A6A66]">선택</span>
                                </div>
                                <input type="url" value={editing.instaUrl||''} onChange={e=>setEditing({...editing, instaUrl:e.target.value})} placeholder="인스타그램 공유 링크를 붙여넣으세요" className="w-full h-[48px] rounded-[12px] bg-[#121214] border border-[#1E1E22] px-4 text-[13px] font-[500] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                                {editing.instaUrl && isValidInstaUrl(editing.instaUrl) && (
                                  <div className="mt-3 text-[11px] font-[600] text-[#C9A86A]">✓ 인스타그램 링크 감지됨</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>

                          <div>
                            <div className="label-caps text-[#D4AF37] text-[11px]">한줄 일기 · 오늘의 디테일</div>
                            <textarea value={editing.note||''} onChange={e=>setEditing({...editing, note:e.target.value})} placeholder="오늘 제일 잘한 디테일은? 내일은 무엇을 더 잘할까? 구체적으로 적을수록 다음 훈련이 빨라져요." className="mt-4 w-full min-h-[140px] rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] px-5 py-4 text-[16px] font-[500] leading-[1.7] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                            <div className="mt-3 text-[11px] font-[600] text-[#6A6A66]">{(editing.note||'').length}/200 · 챔피언은 디테일을 기록한다</div>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button onClick={saveLog} className="flex-1 h-[56px] rounded-[16px] gold-gradient text-[#060608] font-[800] text-[16px] shadow-[0_0_24px_rgba(212,175,55,0.3)] hover:shadow-[0_0_32px_rgba(212,175,55,0.45)] active:scale-[0.98] transition-all">기록 저장</button>
                            <button onClick={()=>setDiaryEditMode(false)} className="h-[56px] px-8 rounded-[16px] bg-[#18181B] border border-[#232326] text-[14px] font-[700] text-[#CFCFC8] hover:border-[#3A3520]">취소</button>
                          </div>
                        </div>
                      </div>
                    ) : selectedLog ? (
                      <div className="mt-8">
                        {/* Hero gradient */}
                        <div className="relative overflow-hidden rounded-[20px] h-[180px] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(212,175,55,0.22),transparent_60%),linear-gradient(135deg,#121214,#0E0E10)] border border-[#2C2A20] flex items-center justify-between px-8">
                          <div className="flex items-center gap-5">
                            <div className="w-[72px] h-[72px] rounded-[18px] bg-[#18181B] border border-[#2C2A20] flex items-center justify-center text-[36px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">{TYPE_META[selectedLog.type].emoji}</div>
                            <div>
                              <div className="inline-flex h-8 px-4 rounded-full gold-gradient text-[#060608] text-[12px] font-[800] tracking-[0.06em] items-center shadow-[0_0_16px_rgba(212,175,55,0.3)]">{TYPE_META[selectedLog.type].label} · {selectedLog.date}</div>
                              <div className="mt-3 font-[800] text-[20px] leading-[1.2]">오늘의 챔피언 로그</div>
                              <div className="mt-1 text-[13px] font-[500] text-[#9A9A93]">컨디션 {MOODS.find(m=>m.id===selectedLog.condition)?.label} · 집중 {selectedLog.focus}/5 · 수면 {selectedLog.sleepHours?.toFixed(1)}h</div>
                            </div>
                          </div>
                          <div className="hidden lg:flex w-[96px] h-[96px] rounded-full border border-[#D4AF37]/20 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(212,175,55,0.15),transparent)] items-center justify-center text-[40px] opacity-80">⛸️</div>
                        </div>

                        {/* Huge stats */}
                        <div className="mt-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
                          <div>
                            <div className="label-caps text-[#D4AF37]">바퀴수 · LAPS</div>
                            <div className="mt-2 flex items-baseline gap-3">
                              <span className="text-[72px] font-[800] leading-[0.9] tracking-[-0.05em] gold-text">{selectedLog.laps ?? '-'}</span>
                              <span className="text-[18px] font-[700] text-[#9A9A93]">바퀴</span>
                              {selectedLog.km && <span className="ml-2 text-[14px] font-[600] text-[#6A6A66]">{selectedLog.km}km</span>}
                            </div>
                            <div className="mt-6 h-[1px] bg-gradient-to-r from-[#D4AF37]/20 to-transparent"/>
                            <div className="mt-6">
                              <div className="label-caps text-[#9A9A93]">타임 기록</div>
                              <div className="mt-4 flex flex-wrap gap-3">
                                {selectedLog.timeRecords && selectedLog.timeRecords.length>0 ? selectedLog.timeRecords.map((r,i)=>(
                                  <div key={i} className="rounded-[14px] bg-[#0E0E10] border border-[#1E1C14] px-5 py-4 min-w-[132px]">
                                    <div className="text-[11px] font-[700] tracking-[0.1em] text-[#D4AF37]">{r.distance}M</div>
                                    <div className="mt-1 font-[800] text-[22px] tracking-[-0.02em] text-[#F5F1E8]">{r.time}</div>
                                  </div>
                                )) : <div className="text-[14px] text-[#6A6A66]">기록 없음 · 다음엔 타임을 재보자</div>}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div>
                              <div className="label-caps">RPE · 강도</div>
                              <div className="mt-3 flex gap-1.5">
                                {Array.from({length:10}).map((_,idx)=>{
                                  const filled=(selectedLog.rpe||0)>idx;
                                  return <div key={idx} className={`flex-1 h-[28px] rounded-[8px] border transition-all ${filled? 'gold-gradient border-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.25)]' : 'bg-[#18181B] border-[#232326]'}`}/>;
                                })}
                              </div>
                              <div className="mt-2 text-[12px] font-[700] text-[#9A9A93]">RPE {selectedLog.rpe} / 10 · {selectedLog.rpe && selectedLog.rpe<=3?'가볍게': selectedLog.rpe && selectedLog.rpe<=6?'보통':'강하게'}</div>
                            </div>
                            <div className="rounded-[14px] bg-[#0E0E10] border border-[#1E1C14] p-4">
                              <div className="label-caps">컨디션</div>
                              <div className="mt-3 flex items-center gap-3">
                                <span className="text-[28px]">{MOODS.find(m=>m.id===selectedLog.condition)?.emoji}</span>
                                <span className="text-[16px] font-[700]">{MOODS.find(m=>m.id===selectedLog.condition)?.label}</span>
                                <span className="ml-auto text-[12px] font-[600] text-[#9A9A93]">{selectedLog.focus} 집중 · {selectedLog.sleepHours?.toFixed(1)}h 수면</span>
                              </div>
                              {selectedLog.dryItems && selectedLog.dryItems.length>0 && (
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                  {selectedLog.dryItems.map(it=> <span key={it} className="px-3 h-7 rounded-full bg-[#1A1912] border border-[#2C2A20] text-[12px] font-[600] text-[#C9A86A]">{it}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                       {/* Blockquote */}
                       <div className="mt-10 relative rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 lg:p-10 overflow-hidden">
                         <div className="absolute top-4 left-6 text-[56px] font-[900] leading-none text-[#D4AF37]/10">“</div>
                         <div className="relative">
                           <div className="label-caps text-[#D4AF37]">한줄 일기</div>
                           <blockquote className="mt-4 text-[20px] lg:text-[22px] font-[600] leading-[1.6] tracking-[-0.01em] text-[#E8E2D2]">“{selectedLog.note || '오늘의 디테일을 기록해보세요. 코너 진입 각도, 스타트 느낌, 호흡 등 작은 것 하나가 내일을 바꿉니다.'}”</blockquote>
                         </div>
                       </div>

                        {/* Media Embeds - YouTube & Instagram */}
                        {(selectedLog.youtubeUrl || selectedLog.instaUrl) && (
                          <div className="mt-8">
                            <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/30 via-[#2A2A20] to-transparent mb-6"/>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-1 h-4 gold-gradient rounded-full"/>
                              <span className="label-caps text-[#D4AF37]">오늘의 영상 / 사진</span>
                            </div>
                            <div className={`grid gap-4 ${(selectedLog.youtubeUrl && selectedLog.instaUrl) ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                              {selectedLog.youtubeUrl && (() => {
                                const vid = extractYouTubeId(selectedLog.youtubeUrl);
                                if (!vid) return null;
                                return (
                                  <div className="rounded-[16px] border border-[#2C2A20] overflow-hidden bg-[#0E0E10] shadow-[0_0_0_1px_rgba(212,175,55,0.08)_inset,0_8px_24px_rgba(0,0,0,0.4)]">
                                    <div className="flex items-center justify-between px-4 h-10 bg-[#121214] border-b border-[#1E1C14]">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center"><Play size={12} className="text-white" /></div>
                                        <span className="text-[11px] font-[800] tracking-[0.08em] text-[#F5F1E8]">YOUTUBE</span>
                                        <span className="text-[11px] font-[500] text-[#9A9A93] hidden sm:inline">훈련 영상</span>
                                      </div>
                                      <a href={selectedLog.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-[600] text-[#9A9A93] hover:text-[#D4AF37] flex items-center gap-1">원본 보기 <ExternalLink size={10}/></a>
                                    </div>
                                    <div className="relative aspect-video bg-black">
                                      <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="absolute inset-0 w-full h-full"
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                              {selectedLog.instaUrl && isValidInstaUrl(selectedLog.instaUrl) && (
                                <div className="rounded-[16px] p-[1.5px] bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] h-fit">
                                  <div className="rounded-[14.5px] bg-[#151518] p-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#962fbf] flex items-center justify-center shadow-[0_2px_10px_rgba(214,41,118,0.35)]">
                                        <Link2 size={18} className="text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-[800] text-[#F5F1E8] flex items-center gap-1.5">Instagram에서 보기 <span className="w-1 h-1 rounded-full bg-[#D4AF37] inline-block"/></div>
                                        <div className="text-[11px] font-[500] text-[#9A9A93] truncate mt-0.5">{truncateUrl(selectedLog.instaUrl, 36)}</div>
                                      </div>
                                    </div>
                                    <div className="mt-4 rounded-[12px] bg-[#1C1C20] border border-[#232326] p-3">
                                      <div className="flex items-center gap-2 text-[11px] font-[600] text-[#9A9A93]">
                                        <div className="w-5 h-5 rounded-full bg-[#232326] flex items-center justify-center">📸</div>
                                        <span className="truncate">{selectedLog.instaUrl}</span>
                                      </div>
                                    </div>
                                    <a href={selectedLog.instaUrl} target="_blank" rel="noopener noreferrer" className="mt-4 w-full h-11 rounded-full bg-[#F5F1E8] text-[#060608] font-[800] text-[13px] flex items-center justify-center gap-2 hover:bg-white transition-colors">
                                      <Link2 size={14}/> 인스타그램 열기 <ExternalLink size={12}/>
                                    </a>
                                    <div className="mt-3 text-[10px] font-[500] text-[#6A6A66] text-center">외부 링크 · 새 탭에서 열립니다</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Coach bubble */}
                        <div className="mt-6 rounded-[16px] bg-[#121214] border border-[#2C2A20] p-5 flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#1A1912] border border-[#3A3520] flex items-center justify-center shrink-0"><Crown size={16} className="text-[#D4AF37]"/></div>
                          <div>
                            <div className="text-[12px] font-[800] text-[#D4AF37] tracking-[0.06em]">COACH FEEDBACK</div>
                            <div className="mt-1.5 text-[14px] font-[500] leading-[1.6] text-[#CFCFC8]">{selectedLog.type==='ice' ? '코너 진입 시 상체 기울기 좋았어. 다음엔 아웃-인-아웃 라인 연습하면 0.3초 더 줄일 수 있어.' : selectedLog.type==='dry' ? '코어 안정성이 올라왔어. 점프 후 착지 밸런스 유지가 핵심이야.' : '잘 쉬었네. 내일 빙판에서 가볍게 풀고 본 훈련 들어가자.'}</div>
                          </div>
                        </div>

                        {/* Edit/delete */}
                        <div className="mt-10 flex gap-3">
                          <button onClick={()=>{const t500=selectedLog.timeRecords?.find(r=>r.distance===500)?.time||''; const t1000=selectedLog.timeRecords?.find(r=>r.distance===1000)?.time||''; setEditing({...selectedLog, mood:selectedLog.condition as Mood, time500:t500, time1000:t1000}); setTime500Input(t500); setTime1000Input(t1000); setDiaryEditMode(true);}} className="h-[48px] px-8 rounded-full bg-[#F5F1E8] text-[#060608] font-[800] text-[14px] hover:bg-white transition-colors">수정하기</button>
                          <button onClick={()=>deleteLog(selectedLog.date)} className="h-[48px] px-6 rounded-full bg-[#18181B] border border-[#232326] text-[13px] font-[700] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]">삭제</button>
                          <span className="ml-auto hidden lg:inline-flex items-center text-[11px] font-[600] text-[#6A6A66]">BLACK & GOLD · {selectedLog.date}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-12 py-16 text-center">
                        <div className="w-[88px] h-[88px] mx-auto rounded-full bg-[radial-gradient(60%_60%_at_50%_30%,rgba(212,175,55,0.18),transparent_70%),#121214] border border-[#2C2A20] flex items-center justify-center text-[36px] shadow-[0_0_32px_rgba(212,175,55,0.12)]">📝</div>
                        <h3 className="mt-6 text-[24px] font-[800] tracking-[-0.02em]">이 날의 기록을 남겨보세요</h3>
                        <p className="mt-3 text-[15px] font-[500] leading-[1.6] text-[#9A9A93] max-w-[360px] mx-auto">선택한 날짜에 훈련 기록이 없어요. 챔피언의 하루를 블로그처럼 남겨보자. 작은 디테일이 큰 차이를 만든다.</p>
                        <button onClick={()=>openLog(selectedDate)} className="mt-8 h-[52px] px-10 rounded-full gold-gradient text-[#060608] font-[800] text-[15px] shadow-[0_0_24px_rgba(212,175,55,0.35)] hover:shadow-[0_0_32px_rgba(212,175,55,0.45)] active:scale-[0.98] transition-all inline-flex items-center gap-2"><span className="text-[16px]">✦</span> 훈련 기록하기</button>
                        <div className="mt-10 h-[1px] bg-gradient-to-r from-transparent via-[#2A2A20] to-transparent max-w-[320px] mx-auto"/>
                        <div className="mt-6 text-[11px] font-[600] tracking-[0.08em] text-[#6A6A66]">TIP: 매일 같은 시간에 기록하면 루틴이 된다</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view==='records' && (
              <div className="space-y-5">
                <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-4 lg:gap-5">
                  <div className="card p-5 lg:p-6">
                    <div className="flex items-center justify-between">
                      <div className="font-[700] text-[14px] flex items-center gap-2"><TrendingUp size={16} className="text-[#D4AF37]"/> 500m 기록 흐름 · PB 추적</div>
                      <span className="text-[10px] font-[700] px-2.5 h-5 rounded-full bg-[#1A1912] border border-[#3A3520] text-[#D4AF37] inline-flex items-center">최근 12회</span>
                    </div>
                    <div className="mt-6 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={time500List}>
                          <defs>
                            <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.28}/>
                              <stop offset="100%" stopColor="#D4AF37" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#6A6A66' }} tickFormatter={(v:string)=>v.slice(5)} />
                          <YAxis domain={['dataMin - 1','dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#6A6A66' }} width={40} />
                          <Tooltip contentStyle={{ background:'#121214', border:'1px solid #2C2A20', borderRadius:12, fontSize:11 }} />
                          <Area type="monotone" dataKey="seconds" stroke="#D4AF37" strokeWidth={2.5} fill="url(#goldFill)" dot={{ r:3, fill:'#060608', stroke:'#D4AF37', strokeWidth:2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3 text-center">
                        <div className="label-caps">Best</div>
                        <div className="mt-1 font-[800] text-[14px] gold-text">{best500.time}</div>
                      </div>
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3 text-center">
                        <div className="label-caps">Avg 5</div>
                        <div className="mt-1 font-[800] text-[14px] text-[#F5F1E8]">{time500List.length? (time500List.slice(-5).reduce((a,b)=>a+b.seconds,0)/Math.min(5,time500List.length)).toFixed(2) : '-'}</div>
                      </div>
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3 text-center">
                        <div className="label-caps">Target</div>
                        <div className="mt-1 font-[800] text-[14px] text-[#D4AF37]">50.00</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="card p-5">
                      <div className="font-[700] text-[13px]">Personal Best Timeline</div>
                      <div className="mt-3 space-y-2">
                        {time500List.slice().reverse().slice(0,5).map((r,i)=>(
                          <div key={i} className="h-12 rounded-[12px] bg-[#101012] border border-[#1E1E22] px-3 flex items-center justify-between group hover:border-[#2C2A20] transition-all">
                            <span className="text-[11px] font-[600] text-[#9A9A93]">{r.date.slice(5).replace('-','/')}</span>
                            <span className="font-[800] text-[13px] text-[#F5F1E8]">{r.time}<span className="ml-1 text-[10px] font-[600] text-[#D4AF37]">{i===0?'PB':''}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card p-5">
                      <div className="font-[700] text-[13px]">훈련 분포 · Donut</div>
                      <div className="mt-3 h-[140px] flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                          <PieChart>
                            <Pie data={typeDist} dataKey="value" innerRadius={36} outerRadius={54} paddingAngle={4} stroke="none">
                              {typeDist.map((e,i)=> <Cell key={i} fill={e.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          {typeDist.map(d=>(
                            <div key={d.name} className="flex items-center gap-2 text-[11px] font-[600]"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/><span className="text-[#9A9A93]">{d.name}</span><span className="ml-auto font-[800] text-[#F5F1E8]">{d.value}</span></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-4 lg:gap-5">
                  <div className="card p-5 lg:p-6">
                    <div className="font-[700] text-[13px]">Lap Analysis · 최근 10회 빙상</div>
                    <div className="mt-5 h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lapAnalysis}>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#6A6A66' }}/>
                          <YAxis hide />
                          <Tooltip contentStyle={{ background:'#121214', border:'1px solid #2C2A20', borderRadius:12, fontSize:11 }} />
                          <Bar dataKey="laps" fill="#D4AF37" radius={[6,6,0,0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card p-5 lg:p-6">
                    <div className="font-[700] text-[13px]">1000m / 1500m 기록</div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3">
                        <div className="label-caps">Best 1000m</div>
                        <div className="mt-1 font-[800] text-[16px] text-[#F5F1E8]">{best1000.time}</div>
                      </div>
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3">
                        <div className="label-caps">Best 1500m</div>
                        <div className="mt-1 font-[800] text-[16px] text-[#F5F1E8]">{logs.flatMap(l=>l.timeRecords||[]).filter(r=>r.distance===1500).sort((a,b)=>a.seconds-b.seconds)[0]?.time || '-'}</div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 max-h-[128px] overflow-auto">
                      {time1000List.map((r,i)=>(
                        <div key={i} className="h-9 rounded-[10px] bg-[#101012] border border-[#1E1E22] px-3 flex items-center justify-between text-[11px]">
                          <span className="text-[#9A9A93] font-[600]">{r.date.slice(5)}</span>
                          <span className="font-[700]">{r.time}</span>
                        </div>
                      ))}
                      {time1000List.length===0 && <div className="text-[11px] text-[#6A6A66] text-center py-6">1000m 기록이 아직 없어요</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view==='growth' && (
              <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 lg:gap-5">
                <div className="space-y-4 lg:space-y-5">
                  <div className="card p-5 lg:p-6">
                    <div className="flex items-center justify-between">
                      <div className="font-[700] text-[14px]">Body Growth · 신체 성장</div>
                      <span className="text-[10px] font-[700] tracking-[0.1em] px-2.5 h-5 rounded-full bg-[#1A1912] border border-[#3A3520] text-[#D4AF37] inline-flex items-center">6개월</span>
                    </div>
                    <div className="mt-6 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mockBody}>
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#9A9A93', fontWeight:600 }} />
                          <YAxis domain={['dataMin -1','dataMax +1']} axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#6A6A66' }} width={36} />
                          <Tooltip contentStyle={{ background:'#121214', border:'1px solid #2C2A20', borderRadius:12, fontSize:11 }} />
                          <Line type="monotone" dataKey="height" stroke="#D4AF37" strokeWidth={2.5} dot={{ r:4, strokeWidth:2, fill:'#060608', stroke:'#D4AF37' }} />
                          <Line type="monotone" dataKey="weight" stroke="#4A4A4E" strokeWidth={1.5} dot={false} strokeDasharray="4 4"/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex gap-2 text-[11px] font-[600]">
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#D4AF37] rounded-full"/>키 cm</span>
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#4A4A4E] rounded-full border border-dashed border-[#4A4A4E]"/>몸무게 kg</span>
                      <span className="ml-auto font-[700] text-[#D4AF37]">+4.1cm / +3.0kg 성장</span>
                    </div>
                  </div>
                  <div className="card p-5 lg:p-6">
                    <div className="font-[700] text-[14px]">시즌 목표 · Season Goals</div>
                    <div className="mt-5 grid sm:grid-cols-3 gap-3">
                      {mockGoals.map(g=>(
                        <div key={g.id} className="rounded-[16px] bg-[#101012] border border-[#1E1C14] p-4">
                          <div className="w-10 h-10 rounded-full bg-[#1A1912] border border-[#2C2A20] flex items-center justify-center text-[18px]">{g.icon}</div>
                          <div className="mt-3 font-[700] text-[12px] leading-[1.3]">{g.title}</div>
                          <div className="mt-2 h-1.5 rounded-full bg-[#1E1E22] overflow-hidden"><div className="h-full gold-gradient rounded-full" style={{width:`${g.progress}%`}}/></div>
                          <div className="mt-2 text-[10px] font-[600] text-[#9A9A93]">{g.progress}% 달성</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-[14px] bg-[#0E0E10] border border-[#1E1C14] p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center"><Crown size={16} className="text-[#060608]"/></div>
                      <div>
                        <div className="text-[12px] font-[700]">Olympic Roadmap</div>
                        <div className="text-[11px] font-[500] text-[#9A9A93]">지금 페이스 유지하면 시즌 50초 컷 가능. 코너링 안정성이 핵심.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 lg:space-y-5">
                  <div className="card p-5 lg:p-6">
                    <div className="font-[700] text-[14px]">Mental & Skills Radar</div>
                    <div className="mt-4 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={mockMental} outerRadius={88}>
                          <PolarGrid stroke="#232326" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize:11, fill:'#9A9A93', fontWeight:600 }} />
                          <PolarRadiusAxis angle={30} domain={[0,100]} tick={false} axisLine={false} />
                          <Radar dataKey="value" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.22} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {mockMental.slice(0,3).map(m=>(
                        <div key={m.subject} className="rounded-[10px] bg-[#101012] border border-[#1E1E22] p-2.5 text-center">
                          <div className="label-caps text-[9px]">{m.subject}</div>
                          <div className="mt-1 font-[800] text-[13px] text-[#D4AF37]">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card p-5">
                    <div className="font-[700] text-[13px]">성장 코멘트</div>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1C14] p-3">
                        <div className="text-[11px] font-[700] text-[#D4AF37]">코치 노트</div>
                        <div className="mt-1 text-[11px] font-[500] leading-[1.5] text-[#CFCFC8]">코너 진입 시 상체 기울기 좋아졌어. 이제 아웃-인-아웃 라인만 더 연습하면 0.5초는 더 줄일 수 있어.</div>
                      </div>
                      <div className="rounded-[12px] bg-[#101012] border border-[#1E1C14] p-3">
                        <div className="text-[11px] font-[700] text-[#C9A86A]">다음주 포커스</div>
                        <div className="mt-1 text-[11px] font-[500] leading-[1.5] text-[#CFCFC8]">· 스타트 3회 추가 · 코어 15분 루틴 · 수면 8시간 확보</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating action mobile */}
      <button onClick={()=>openLog(todayStr)} className="lg:hidden fixed bottom-[18px] right-4 z-20 h-12 px-5 rounded-full gold-gradient text-[#060608] font-[800] text-[13px] shadow-[0_0_24px_rgba(212,175,55,0.4)] flex items-center gap-1.5 active:scale-[0.98]">✦ 기록</button>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[24px] z-[90] bg-[#F5F1E8] text-[#060608] px-5 h-11 rounded-full flex items-center gap-2 text-[12px] font-[800] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(212,175,55,0.3)] border border-[#D4AF37]/30">
          <span className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center text-[12px]">👑</span>{toast}
        </div>
      )}

      {/* Modal - pro form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6">
          <div className="absolute inset-0 bg-[#060608]/80 backdrop-blur-[12px]" onClick={()=>setShowModal(false)}/>
          <div className="relative w-full lg:max-w-[640px] max-h-[92vh] lg:max-h-[88vh] overflow-auto rounded-t-[28px] lg:rounded-[28px] bg-[#0C0C0E] border border-[#2C2A20] shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(212,175,55,0.15)_inset]">
            <div className="sticky top-0 z-10 bg-[#0C0C0E]/90 backdrop-blur-xl border-b border-[#1E1C14] px-6 h-[68px] flex items-center justify-between">
              <div>
                <div className="font-[800] text-[15px] tracking-[-0.02em] flex items-center gap-2"><span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-[#060608] text-[12px]">✦</span>{editing.date} 훈련 기록</div>
                <div className="text-[11px] font-[500] text-[#9A9A93] mt-1">챔피언은 기록한다 · 디테일이 차이를 만든다</div>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-9 h-9 rounded-full bg-[#18181B] border border-[#232326] flex items-center justify-center hover:border-[#3A3520]"><X size={16}/></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Mood */}
              <div>
                <div className="label-caps mb-3">오늘의 컨디션</div>
                <div className="grid grid-cols-5 gap-2">
                  {MOODS.map(m=>{
                    const active=editing.mood===m.id;
                    return (
                      <button key={m.id} onClick={()=>setEditing({...editing, mood:m.id, condition:m.id})} className={`h-[68px] rounded-[16px] border flex flex-col items-center justify-center gap-1 transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608] shadow-[0_0_16px_rgba(212,175,55,0.4)] scale-[1.02]' : 'bg-[#121214] border-[#232326] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]'}`}>
                        <span className="text-[18px] leading-none">{m.emoji}</span>
                        <span className="text-[11px] font-[700]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="label-caps mb-3">훈련 타입</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {(Object.keys(TYPE_META) as TrainingType[]).map(t=>{
                    const active=editing.type===t;
                    const meta=TYPE_META[t];
                    return (
                      <button key={t} onClick={()=>setEditing({...editing, type:t})} className={`min-h-[64px] rounded-[16px] border p-3 flex flex-col items-center justify-center gap-1 transition-all ${active? 'bg-[#F5F1E8] border-[#F5F1E8] text-[#060608] shadow-[0_0_16px_rgba(245,241,232,0.2)]' : 'bg-[#121214] border-[#232326] hover:border-[#3A3520] text-[#CFCFC8]'}`}>
                        <span className="text-[22px] leading-none">{meta.emoji}</span>
                        <span className="text-[12px] font-[700]">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editing.type==='ice' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card !p-4">
                      <div className="label-caps">Laps</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={()=>setEditing({...editing, laps: Math.max(0,(editing.laps||0)-5)})} className="w-9 h-9 rounded-full bg-[#18181B] border border-[#232326] font-[800]">−</button>
                        <div className="flex-1 h-11 rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] flex items-center justify-center gap-1">
                          <input type="number" inputMode="numeric" value={editing.laps||0} onChange={e=>setEditing({...editing, laps: parseInt(e.target.value)||0})} className="w-[64px] bg-transparent text-center font-[800] text-[20px] outline-none"/>
                          <span className="text-[11px] font-[600] text-[#6A6A66]">바퀴</span>
                        </div>
                        <button onClick={()=>setEditing({...editing, laps: (editing.laps||0)+5})} className="w-9 h-9 rounded-full gold-gradient text-[#060608] font-[800]">+</button>
                      </div>
                      <div className="mt-2 text-[10px] font-[600] text-[#6A6A66] text-center">{((editing.laps||0)*TRACK/1000).toFixed(2)}km · 111.12m/랩</div>
                    </div>
                    <div className="card !p-4">
                      <div className="label-caps">RPE · 강도</div>
                      <div className="mt-3 flex items-center gap-1">
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                          const active=(editing.rpe||5)>=n;
                          return <button key={n} onClick={()=>setEditing({...editing, rpe:n})} className={`flex-1 h-7 rounded-full text-[10px] font-[800] border transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608]' : 'bg-[#18181B] border-[#232326] text-[#4A4A4E]'}`}>{n}</button>;
                        })}
                      </div>
                      <div className="mt-2 text-[10px] font-[600] text-[#6A6A66] text-center">현재 RPE {editing.rpe||5} · { (editing.rpe||5)<=3?'가볍게' : (editing.rpe||5)<=6?'보통':'강하게' }</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card !p-4">
                      <div className="label-caps">500m Time</div>
                      <div className="mt-3 flex items-center gap-2">
                        <input value={time500Input} onChange={e=>setTime500Input(e.target.value)} placeholder="58.32" inputMode="decimal" className="flex-1 h-11 rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] px-3 text-[14px] font-[700] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                      </div>
                    </div>
                    <div className="card !p-4">
                      <div className="label-caps">1000m Time</div>
                      <div className="mt-3 flex items-center gap-2">
                        <input value={time1000Input} onChange={e=>setTime1000Input(e.target.value)} placeholder="1:52.10" inputMode="decimal" className="flex-1 h-11 rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] px-3 text-[14px] font-[700] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editing.type==='dry' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card !p-4">
                      <div className="label-caps">Minutes</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={()=>setEditing({...editing, minutes: Math.max(0,(editing.minutes||0)-10)})} className="w-9 h-9 rounded-full bg-[#18181B] border border-[#232326] font-[800]">−</button>
                        <div className="flex-1 h-11 rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] flex items-center justify-center gap-1">
                          <input type="number" value={editing.minutes||0} onChange={e=>setEditing({...editing, minutes: parseInt(e.target.value)||0})} className="w-[56px] bg-transparent text-center font-[800] text-[20px] outline-none"/>
                          <span className="text-[11px] font-[600] text-[#6A6A66]">분</span>
                        </div>
                        <button onClick={()=>setEditing({...editing, minutes: (editing.minutes||0)+10})} className="w-9 h-9 rounded-full gold-gradient text-[#060608] font-[800]">+</button>
                      </div>
                    </div>
                    <div className="card !p-4">
                      <div className="label-caps">Focus Level</div>
                      <div className="mt-3 flex gap-1.5">
                        {[1,2,3,4,5].map(n=>(
                          <button key={n} onClick={()=>setEditing({...editing, focus:n})} className={`flex-1 h-11 rounded-[12px] border font-[700] text-[12px] ${editing.focus===n?'gold-gradient border-[#D4AF37] text-[#060608]':'bg-[#18181B] border-[#232326] text-[#9A9A93]'}`}>{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="card !p-4">
                    <div className="label-caps mb-3">훈련 항목 · 3개까지</div>
                    <div className="flex flex-wrap gap-2">
                      {['러닝','점프','코어','웨이트','스트레칭','스프린트','밸런스'].map(item=>{
                        const active=editing.dryItems?.includes(item);
                        return (
                          <button key={item} onClick={()=>{
                            const cur=editing.dryItems||[];
                            const next= active? cur.filter(c=>c!==item) : cur.length<3? [...cur, item] : cur;
                            setEditing({...editing, dryItems:next});
                          }} className={`h-9 px-3.5 rounded-full border text-[12px] font-[700] transition-all ${active? 'gold-gradient border-[#D4AF37] text-[#060608]' : 'bg-[#18181B] border-[#232326] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]'}`}>{item}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {editing.type==='rest' && (
                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1C14] p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#121214] border border-[#2C2A20] flex items-center justify-center text-[22px]">🌑</div>
                  <div className="mt-3 font-[700] text-[13px]">리커버리 데이</div>
                  <div className="mt-1 text-[11px] font-[500] text-[#9A9A93]">잘 쉬는 것도 챔피언의 전략. 내일 더 강하게.</div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[12px] bg-[#121214] border border-[#1E1E22] p-3"><div className="label-caps">Sleep</div><div className="mt-1 flex items-center gap-2"><input type="number" step="0.5" value={editing.sleepHours||8} onChange={e=>setEditing({...editing, sleepHours: parseFloat(e.target.value)||0})} className="w-full bg-transparent font-[800] text-[16px] outline-none"/>h</div></div>
                    <div className="rounded-[12px] bg-[#121214] border border-[#1E1E22] p-3"><div className="label-caps">컨디션 회복</div><div className="mt-1 text-[12px] font-[700] text-[#D4AF37]">80% 예상</div></div>
                  </div>
                </div>
              )}

              <div className="card !p-4">
                <div className="label-caps">오늘의 노트 · 챔피언 다이어리</div>
                <textarea value={editing.note||''} onChange={e=>setEditing({...editing, note:e.target.value})} placeholder="오늘 제일 잘한 디테일은? 내일은 무엇을 더 잘할까?" className="mt-3 w-full min-h-[80px] rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                <div className="mt-3 flex items-center justify-between text-[10px] font-[600] text-[#6A6A66]">
                  <span>팁: 구체적일수록 다음 훈련이 빨라져요</span>
                  <span className="text-[#D4AF37]">{(editing.note||'').length}/120</span>
                </div>
              </div>

              <button onClick={saveLog} className="w-full h-[52px] rounded-[16px] gold-gradient text-[#060608] font-[800] text-[14px] tracking-[-0.01em] shadow-[0_0_24px_rgba(212,175,55,0.3)] hover:shadow-[0_0_32px_rgba(212,175,55,0.45)] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Crown size={16}/> 기록 저장 · 챔피언의 하루 추가
              </button>
              <div className="text-center text-[10px] font-[500] text-[#6A6A66] pb-2 tracking-[0.04em]">BLACK & GOLD EDITION · FOR FUTURE OLYMPIAN</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
