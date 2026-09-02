import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Trophy, Calendar, BarChart3, TrendingUp, Award, Flame, Crown, ExternalLink, Link2, Play, LogOut, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useAuth } from './AuthContext';
import { useTrainingLogs } from './useTrainingLogs';
import { useGoals } from './useGoals';
import { useItemTypes } from './useItemTypes';
import { downloadTrainingReport } from './reportPdf';

// Types
type TrainingType = 'ice' | 'dry' | 'rest';
type ViewType = 'dashboard' | 'diary' | 'records' | 'growth';

export interface TimeRecord { distance: number; time: string; seconds: number; }
// A logged instance of a user-defined item type (e.g. "러닝 30분").
export interface TrainingItem { id: string; type: string; value: number; unit: string; }
export interface TrainingLog {
  id: string; date: string;
  isRest: boolean; noteIce?: string; noteDry?: string;
  minutes?: number; rpe?: number; laps?: number; km?: number;
  timeRecords?: TimeRecord[]; iceItems?: TrainingItem[]; dryItems?: TrainingItem[]; focus?: number; sleepHours?: number;
  youtubeUrl?: string; instaUrl?: string;
}
export interface Goal { id:string; title:string; target:string; current:string; progress:number; icon:string; }
// A user-managed item type (name + unit) available in the ice or dry item picker.
export interface ItemType { id: string; category: 'ice' | 'dry'; name: string; unit: string; }

const GOLD = '#D4AF37';
const GOLD_BRIGHT = '#FFD700';
const GOLD_GRAD = 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #FFC700 100%)';

// Short-track record distances — still used to display historical PB data.
const DISTANCES = [111, 222, 333, 500, 1000, 1500] as const;
// Units selectable when defining a custom ice/dry item type.
export const ITEM_UNITS = ['시간', '분', '바퀴', '셋트', '개', '회'];
// Seeded once per new user (see useItemTypes) so 육상 starts with familiar items.
export const DEFAULT_ITEM_TYPES: { category: 'ice' | 'dry'; name: string; unit: string }[] = [
  { category: 'dry', name: '러닝', unit: '분' },
  { category: 'dry', name: '점프', unit: '셋트' },
  { category: 'dry', name: '코어', unit: '분' },
  { category: 'dry', name: '웨이트', unit: '분' },
  { category: 'dry', name: '스트레칭', unit: '분' },
  { category: 'dry', name: '스프린트', unit: '바퀴' },
  { category: 'dry', name: '밸런스', unit: '분' },
];

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
function parseTimeInput(raw: string): { sec: number; display: string } | null {
  raw = raw.trim(); if (!raw) return null;
  let sec = 0;
  if (raw.includes(':')) { const [mm, ss] = raw.split(':'); sec = parseInt(mm) * 60 + parseFloat(ss); } else sec = parseFloat(raw) || 0;
  if (sec <= 0) return null;
  return { sec, display: raw.includes(':') ? raw : sec.toFixed(2) };
}

export const TYPE_META: Record<TrainingType, { label: string; emoji: string; color: string }> = {
  ice: { label: '빙상', emoji: '⛸️', color: GOLD },
  dry: { label: '육상', emoji: '🏋️', color: '#C9A86A' },
  rest: { label: '리커버리', emoji: '🌑', color: '#4A4A4E' },
};
// Which training types apply to a log — a day can be both ice and dry at once.
export function logTypes(log: TrainingLog): TrainingType[] {
  const types: TrainingType[] = [];
  if ((log.noteIce && log.noteIce.trim()) || (log.iceItems && log.iceItems.length>0)) types.push('ice');
  if ((log.noteDry && log.noteDry.trim()) || (log.dryItems && log.dryItems.length>0)) types.push('dry');
  if (log.isRest) types.push('rest');
  return types;
}
function logSummary(log: TrainingLog): string {
  const itemsText = (items?: TrainingItem[]) => (items||[]).map(it=>`${it.type} ${it.value}${it.unit}`).join(', ');
  const parts = [log.noteIce || itemsText(log.iceItems), log.noteDry || itemsText(log.dryItems)].filter(Boolean);
  return parts.join(' · ');
}

function TimeInputsEditor({ timeInputs, onChange }: { timeInputs: Record<number,string>; onChange:(distance:number,value:string)=>void }) {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {DISTANCES.map(d=>(
        <div key={d} className="rounded-[14px] bg-[#101012] border border-[#1E1E22] p-4">
          <div className="label-caps">{d}m</div>
          <input
            value={timeInputs[d]||''} onChange={e=>onChange(d, e.target.value)}
            placeholder={d>=1000 ? 'm:ss.ss' : 'ss.ss'} inputMode="decimal"
            className="mt-3 w-full h-11 rounded-[10px] bg-[#0E0E10] border border-[#1E1E22] px-3 text-[14px] font-[700] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"
          />
        </div>
      ))}
    </div>
  );
}

// User-managed item picker: add/delete custom item types (name+unit) per
// category, click a type to reveal a value input, register it onto the log.
function ItemPicker({ itemTypes, items, onAddType, onDeleteType, onAddItem, onRemoveItem, compact }: {
  itemTypes: ItemType[]; items: TrainingItem[];
  onAddType:(name:string, unit:string)=>void; onDeleteType:(id:string)=>void;
  onAddItem:(item:Omit<TrainingItem,'id'>)=>void; onRemoveItem:(id:string)=>void;
  compact?: boolean;
}) {
  const [activeTypeId, setActiveTypeId] = useState<string|null>(null);
  const [value, setValue] = useState('');
  const [showAddType, setShowAddType] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState(ITEM_UNITS[0]);
  const activeType = itemTypes.find(t=>t.id===activeTypeId);

  return (
    <div className={compact ? 'card !p-4' : 'rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5'}>
      <div className="label-caps mb-3">항목 선택 · 클릭 후 값 입력</div>
      <div className="flex flex-wrap gap-2">
        {itemTypes.map(t=>(
          <div key={t.id} className="relative group">
            <button type="button" onClick={()=>{ setActiveTypeId(t.id); setValue(''); }} className={`h-9 pl-3.5 pr-3.5 rounded-full border text-[12px] font-[700] transition-all ${activeTypeId===t.id? 'gold-gradient border-[#D4AF37] text-[#060608]' : 'bg-[#18181B] border-[#232326] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]'}`}>{t.name}</button>
            <button type="button" onClick={()=>onDeleteType(t.id)} title="항목 삭제" className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#232326] border border-[#3A3520] text-[9px] text-[#9A9A93] opacity-0 group-hover:opacity-100 flex items-center justify-center leading-none">×</button>
          </div>
        ))}
        <button type="button" onClick={()=>setShowAddType(v=>!v)} className="h-9 px-3.5 rounded-full border border-dashed border-[#3A3520] text-[12px] font-[700] text-[#D4AF37]">+ 새 항목</button>
      </div>

      {showAddType && (
        <div className="mt-3 flex items-center gap-2">
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="항목 이름" className="flex-1 h-9 rounded-[10px] bg-[#121214] border border-[#1E1E22] px-3 text-[12px] font-[600] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
          <select value={newUnit} onChange={e=>setNewUnit(e.target.value)} className="h-9 rounded-[10px] bg-[#121214] border border-[#1E1E22] px-2 text-[12px] font-[700] outline-none">
            {ITEM_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
          <button type="button" onClick={()=>{ if(newName.trim()){ onAddType(newName.trim(), newUnit); setNewName(''); setShowAddType(false); } }} className="h-9 px-3.5 rounded-full gold-gradient text-[#060608] font-[800] text-[12px]">추가</button>
        </div>
      )}

      {activeType && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] font-[700] text-[#F5F1E8]">{activeType.name}</span>
          <input type="number" value={value} onChange={e=>setValue(e.target.value)} autoFocus className="w-20 h-9 rounded-[10px] bg-[#121214] border border-[#1E1E22] text-center font-[700] outline-none"/>
          <span className="text-[12px] font-[600] text-[#6A6A66]">{activeType.unit}</span>
          <button type="button" onClick={()=>{ const n=parseFloat(value); if(n>0){ onAddItem({type:activeType.name, value:n, unit:activeType.unit}); setActiveTypeId(null); setValue(''); } }} className="ml-auto h-9 px-4 rounded-full gold-gradient text-[#060608] font-[800] text-[12px]">등록</button>
        </div>
      )}

      {items.length>0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map(it=>(
            <span key={it.id} className="h-8 pl-3 pr-1.5 rounded-full bg-[#18181B] border border-[#232326] text-[12px] font-[700] text-[#CFCFC8] inline-flex items-center gap-1.5">
              {it.type} {it.value}{it.unit}
              <button type="button" onClick={()=>onRemoveItem(it.id)} className="w-5 h-5 rounded-full bg-[#232326] hover:bg-[#3A3520] flex items-center justify-center text-[10px] leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { user, logOut } = useAuth();
  const { logs, saveLog: saveLogRemote, deleteLog: deleteLogRemote } = useTrainingLogs(user?.uid);
  const { goals, saveGoal: saveGoalRemote, deleteGoal: deleteGoalRemote } = useGoals(user?.uid);
  const { itemTypes, saveItemType, deleteItemType } = useItemTypes(user?.uid);
  const iceItemTypes = useMemo(()=> itemTypes.filter(t=>t.category==='ice'), [itemTypes]);
  const dryItemTypes = useMemo(()=> itemTypes.filter(t=>t.category==='dry'), [itemTypes]);
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [showModal, setShowModal] = useState(false);
  const [diaryEditMode, setDiaryEditMode] = useState(false);
  const [editing, setEditing] = useState<Partial<TrainingLog>>({});
  const [toast, setToast] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [searchType, setSearchType] = useState<'all'|'ice'|'dry'|'rest'>('all');
  const [goalForm, setGoalForm] = useState<Goal | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [recordDate, setRecordDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [recordLaps, setRecordLaps] = useState(0);
  const [recordTimeInputs, setRecordTimeInputs] = useState<Record<number,string>>({});

  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),2600); return ()=>clearTimeout(t);} },[toast]);
  // Switch to edit mode automatically when changing to diary view? keep false initially
  useEffect(()=>{ if(view!=='diary') setDiaryEditMode(false); },[view]);

  useEffect(()=>{
    // Only reload when the date picker changes, never on every `logs` update —
    // otherwise Firestore's post-write resync would wipe out unsaved typing.
    const existing = logs.find(l=>l.date===recordDate);
    setRecordLaps(existing?.laps || 0);
    const inputs: Record<number,string> = {};
    DISTANCES.forEach(d=>{ inputs[d] = existing?.timeRecords?.find(r=>r.distance===d)?.time || ''; });
    setRecordTimeInputs(inputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordDate]);

  const todayStr = new Date().toISOString().slice(0,10);

  const filteredLogs = useMemo(()=> searchType==='all' ? logs : logs.filter(l=> logTypes(l).includes(searchType)), [logs, searchType]);
  const thisWeekLogs = useMemo(()=>{
    const now=new Date(); const start=new Date(now); const dayIdx=(now.getDay()+6)%7; start.setDate(now.getDate()-dayIdx);
    return logs.filter(l=>{ const d=new Date(l.date); return d>=start; });
  },[logs]);

  const bestByDistance = useMemo(()=>{
    const map: Record<number, { time:string; sec:number }> = {};
    DISTANCES.forEach(d=>{ map[d] = { time:'-', sec:Infinity }; });
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(map[r.distance] && r.seconds<map[r.distance].sec){ map[r.distance] = { time:r.time, sec:r.seconds }; } }));
    return map;
  },[logs]);
  const best500 = bestByDistance[500];

  const time500List = useMemo(()=>{
    const arr: { date:string; seconds:number; time:string }[]=[];
    logs.forEach(l=> l.timeRecords?.forEach(r=>{ if(r.distance===500) arr.push({date:l.date, seconds:r.seconds, time:r.time}); }));
    return arr.sort((a,b)=> a.date.localeCompare(b.date)).slice(-12);
  },[logs]);

  const typeDist = useMemo(()=>{
    const ice = logs.filter(l=>l.noteIce && l.noteIce.trim()).length;
    const dry = logs.filter(l=>l.noteDry && l.noteDry.trim()).length;
    const rest = logs.filter(l=>l.isRest).length;
    return [{ name:'빙상', value:ice, color:'#D4AF37' }, { name:'육상', value:dry, color:'#C9A86A' }, { name:'휴식', value:rest, color:'#2A2A2E' }];
  },[logs]);

  const lapAnalysis = useMemo(()=>{
    const iceLogs = logs.filter(l=>l.laps).slice(-10);
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
  const recentLogsWithRecord = useMemo(()=> logs.slice(-5).reverse(), [logs]);
  const selectedLog = useMemo(()=> logs.find(l=>l.date===selectedDate), [logs, selectedDate]);

 const openLog = (dateStr:string)=>{
   const existing = logs.find(l=>l.date===dateStr);
   if(existing){
      setEditing({ ...existing, youtubeUrl: existing.youtubeUrl||'', instaUrl: existing.instaUrl||'' });
    }else{
      setEditing({ date:dateStr, isRest:false, noteIce:'', noteDry:'', iceItems:[], dryItems:[], sleepHours:8, youtubeUrl:'', instaUrl:'' });
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
    // Laps/RPE/minutes/focus/time records no longer have input UI here — carry
    // over whatever the log already had (nothing for a brand-new entry) unchanged.
    const prevLog = logs.find(l=>l.date===editing.date);

    const cleanYt = (editing.youtubeUrl||'').trim();
    const cleanInsta = (editing.instaUrl||'').trim();
    const isRest = !!editing.isRest;
    const newLog: TrainingLog = {
      id: editing.date!, date: editing.date!,
      isRest,
      noteIce: isRest ? undefined : (editing.noteIce||'').trim() || undefined,
      noteDry: isRest ? undefined : (editing.noteDry||'').trim() || undefined,
      minutes: prevLog?.minutes,
      rpe: prevLog?.rpe, laps: prevLog?.laps, km: prevLog?.km, timeRecords: prevLog?.timeRecords||[],
      iceItems: isRest ? [] : (editing.iceItems||[]),
      dryItems: isRest ? [] : (editing.dryItems||[]),
      focus: prevLog?.focus, sleepHours: editing.sleepHours||8,
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

  const addIceItem = (item:Omit<TrainingItem,'id'>)=> setEditing({...editing, iceItems:[...(editing.iceItems||[]), {...item, id: crypto.randomUUID()}]});
  const removeIceItem = (id:string)=> setEditing({...editing, iceItems:(editing.iceItems||[]).filter(it=>it.id!==id)});
  const addDryItem = (item:Omit<TrainingItem,'id'>)=> setEditing({...editing, dryItems:[...(editing.dryItems||[]), {...item, id: crypto.randomUUID()}]});
  const removeDryItem = (id:string)=> setEditing({...editing, dryItems:(editing.dryItems||[]).filter(it=>it.id!==id)});

  const saveRecordEntry = ()=>{
    const prevLog = logs.find(l=>l.date===recordDate);
    const timeRecs: TimeRecord[] = DISTANCES.map(d=>{
      const p = parseTimeInput(recordTimeInputs[d]||'');
      return p ? { distance:d, time:p.display, seconds:p.sec } : null;
    }).filter((r): r is TimeRecord => r !== null);
    const laps = recordLaps || undefined;
    const km = laps ? +(laps*111.12/1000).toFixed(2) : undefined;
    const merged: TrainingLog = prevLog
      ? { ...prevLog, laps, km, timeRecords: timeRecs }
      : { id: recordDate, date: recordDate, isRest: false, laps, km, timeRecords: timeRecs };
    saveLogRemote(merged);
    setToast('기록이 저장됐어요 · 분석에 반영됩니다');
  };

  const exportReport = async (log: TrainingLog) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadTrainingReport(log, user?.displayName || '챔피언');
    } catch (err) {
      console.error('PDF export failed:', err);
      setToast('보고서 생성에 실패했어요');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060608] text-[#F5F1E8] selection:bg-[#D4AF37]/20 antialiased overflow-x-hidden">
      {/* subtle radial gold vignette */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(212,175,55,0.14),transparent_60%),radial-gradient(60%_40%_at_90%_10%,rgba(201,168,106,0.09),transparent_50%),radial-gradient(50%_45%_at_5%_60%,rgba(212,175,55,0.07),transparent_55%),radial-gradient(45%_40%_at_85%_90%,rgba(201,168,106,0.06),transparent_55%)]" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:flex w-[256px] shrink-0 flex-col bg-[#08080A]/70 backdrop-blur-2xl border-r border-[#1C1A12] sticky top-0 h-screen">
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
              { id:'records', label:'기록입력/분석', icon:Trophy, desc:'RECORDS' },
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
                      {view==='records' && '기록입력/분석'}
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
                { id:'records', label:'기록입력/분석' },
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
                {/* KPI */}
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
                        const types=logTypes(log);
                        return (
                          <div key={log.id} className="group h-[64px] rounded-[14px] bg-[#101012] border border-[#1E1E22] hover:border-[#2C2A20] hover:bg-[#15151A] flex items-center gap-3 px-3.5 transition-all">
                            <div className="w-10 h-10 rounded-[12px] bg-[#18181B] border border-[#232326] flex items-center justify-center text-[16px]">{types.map(t=>TYPE_META[t].emoji).join('') || '📝'}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-[700]">{log.date.slice(5).replace('-','/')}</span>
                                {types.map(t=> <span key={t} className="text-[10px] font-[600] px-1.5 h-4 rounded-full bg-[#1A1A1E] border border-[#2A2A2E] text-[#9A9A93]">{TYPE_META[t].label}</span>)}
                                {log.laps && <span className="text-[10px] font-[600] text-[#D4AF37]">{log.laps}바퀴</span>}
                              </div>
                              <div className="text-[11px] font-[500] text-[#9A9A93] truncate mt-0.5">{logSummary(log)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[12px] font-[800] text-[#F5F1E8]">{log.timeRecords?.[0]?.time || '-'}</div>
                              <div className="text-[10px] font-[600] text-[#6A6A66]">{log.rpe!=null ? `RPE ${log.rpe}` : ''}</div>
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
                        <span className="text-[10px] font-[700] tracking-[0.12em] px-2 h-5 rounded-full bg-[#1A1912] border border-[#3A3520] text-[#D4AF37] inline-flex items-center">{goals.length} GOALS</span>
                      </div>
                      <div className="mt-5 space-y-4 relative">
                        {goals.slice(0,3).map(g=>(
                          <div key={g.id} className="rounded-[14px] bg-[#121214] border border-[#1E1C14] p-3.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2"><span>{g.icon}</span><span className="text-[12px] font-[700]">{g.title}</span></div>
                              <span className="text-[11px] font-[800] px-2 h-5 rounded-full gold-gradient text-[#060608] inline-flex items-center">{g.progress}%</span>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full bg-[#1E1E22] overflow-hidden"><div className="h-full rounded-full gold-gradient" style={{width:`${g.progress}%`}}/></div>
                            <div className="mt-2 flex justify-between text-[10px] font-[600] text-[#9A9A93]"><span>현재 {g.current}</span><span>목표 {g.target}</span></div>
                          </div>
                        ))}
                        {goals.length===0 && <div className="text-center py-6 text-[11px] text-[#6A6A66]">성장리포트 탭에서 시즌 목표를 등록해보세요</div>}
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
                              {log && (
                                <span className="mt-[1px] flex gap-[2px]">
                                  {logTypes(log).map(t=> <span key={t} className={`w-1 h-1 rounded-full ${isSel? 'bg-[#060608]' : t==='ice' ? 'bg-[#D4AF37]' : t==='dry' ? 'bg-[#C9A86A]' : 'bg-[#4A4A4E]'}`} />)}
                                </span>
                              )}
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
                          {logTypes(selectedLog).map(t=>(
                            <div key={t} className="flex items-center gap-1.5">
                              <div className="w-8 h-8 rounded-[10px] bg-[#18181B] border border-[#232326] flex items-center justify-center text-[16px]">{TYPE_META[t].emoji}</div>
                              <span className="text-[13px] font-[800]">{TYPE_META[t].label}</span>
                            </div>
                          ))}
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
                            <span className="text-[14px]">{logTypes(l).map(t=>TYPE_META[t].emoji).join('') || '📝'}</span>
                            <span className="text-[12px] font-[700] flex-1 truncate">{logSummary(l) || logTypes(l).map(t=>TYPE_META[t].label).join(', ')}</span>
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
                      <div className="mt-3 text-[13px] font-[500] text-[#9A9A93]">{selectedDate} · {selectedLog? '기록 있음' : '기록 없음'} {selectedLog? `· ${logTypes(selectedLog).map(t=>TYPE_META[t].label).join(', ')} ${selectedLog.laps? `${selectedLog.laps}바퀴`:''}` : ''}</div>
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
                            <button onClick={()=>setEditing({...editing, isRest: !editing.isRest})} className={`w-full h-[64px] rounded-[18px] border flex items-center gap-3 px-5 transition-all ${editing.isRest? 'bg-[#F5F1E8] border-[#F5F1E8] text-[#060608]' : 'bg-[#121214] border-[#232326] text-[#CFCFC8] hover:border-[#3A3520]'}`}>
                              <span className="text-[22px] leading-none">🌑</span>
                              <span className="text-[14px] font-[800] flex-1 text-left">오늘은 리커버리(휴식) 데이예요</span>
                              <span className={`w-11 h-6 rounded-full relative transition-all ${editing.isRest? 'bg-[#D4AF37]' : 'bg-[#232326]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${editing.isRest? 'left-[22px]' : 'left-0.5'}`}/></span>
                            </button>
                          </div>

                          {editing.isRest ? (
                            <div className="rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 text-center">
                              <div className="w-16 h-16 mx-auto rounded-full bg-[#121214] border border-[#2C2A20] flex items-center justify-center text-[28px]">🌑</div>
                              <div className="mt-4 font-[800] text-[18px]">리커버리 데이</div>
                              <div className="mt-2 text-[14px] font-[500] text-[#9A9A93] leading-[1.6]">잘 쉬는 것도 전략. 내일 더 강하게 돌아오자.</div>
                            </div>
                          ) : (
                            <>
                              <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>
                              <div>
                                <div className="label-caps text-[#D4AF37] text-[11px]">⛸️ 빙상 훈련 · 오늘의 디테일</div>
                                <div className="mt-4"><ItemPicker itemTypes={iceItemTypes} items={editing.iceItems||[]} onAddType={(name,unit)=>saveItemType({id:crypto.randomUUID(), category:'ice', name, unit})} onDeleteType={deleteItemType} onAddItem={addIceItem} onRemoveItem={removeIceItem} /></div>
                                <textarea value={editing.noteIce||''} onChange={e=>setEditing({...editing, noteIce:e.target.value})} placeholder="오늘 빙상 훈련은 어땠나요? 코너 진입 각도, 스타트 느낌 등을 자유롭게 적어보세요." className="mt-4 w-full min-h-[120px] rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] px-5 py-4 text-[16px] font-[500] leading-[1.7] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                                <div className="mt-3 text-[11px] font-[600] text-[#6A6A66]">{(editing.noteIce||'').length}/200 · 훈련이 없었다면 비워두세요</div>
                              </div>

                              <div className="h-[1px] bg-gradient-to-r from-[#D4AF37]/20 via-[#2A2A20] to-transparent"/>
                              <div>
                                <div className="label-caps text-[#D4AF37] text-[11px]">🏋️ 육상 훈련 · 오늘의 디테일</div>
                                <div className="mt-4"><ItemPicker itemTypes={dryItemTypes} items={editing.dryItems||[]} onAddType={(name,unit)=>saveItemType({id:crypto.randomUUID(), category:'dry', name, unit})} onDeleteType={deleteItemType} onAddItem={addDryItem} onRemoveItem={removeDryItem} /></div>
                                <textarea value={editing.noteDry||''} onChange={e=>setEditing({...editing, noteDry:e.target.value})} placeholder="오늘 육상 훈련은 어땠나요?" className="mt-4 w-full min-h-[120px] rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] px-5 py-4 text-[16px] font-[500] leading-[1.7] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                                <div className="mt-3 text-[11px] font-[600] text-[#6A6A66]">{(editing.noteDry||'').length}/200 · 훈련이 없었다면 비워두세요</div>
                              </div>
                            </>
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
                            <div className="w-[72px] h-[72px] rounded-[18px] bg-[#18181B] border border-[#2C2A20] flex items-center justify-center text-[36px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">{logTypes(selectedLog).map(t=>TYPE_META[t].emoji).join(' ') || '📝'}</div>
                            <div>
                              <div className="inline-flex h-8 px-4 rounded-full gold-gradient text-[#060608] text-[12px] font-[800] tracking-[0.06em] items-center shadow-[0_0_16px_rgba(212,175,55,0.3)]">{logTypes(selectedLog).map(t=>TYPE_META[t].label).join(' + ') || '기록'} · {selectedLog.date}</div>
                              <div className="mt-3 font-[800] text-[20px] leading-[1.2]">오늘의 챔피언 로그</div>
                              {(selectedLog.focus!=null || selectedLog.sleepHours!=null) && (
                                <div className="mt-1 text-[13px] font-[500] text-[#9A9A93]">{selectedLog.focus!=null && `집중 ${selectedLog.focus}/5`}{selectedLog.focus!=null && selectedLog.sleepHours!=null && ' · '}{selectedLog.sleepHours!=null && `수면 ${selectedLog.sleepHours.toFixed(1)}h`}</div>
                              )}
                            </div>
                          </div>
                          <div className="hidden lg:flex w-[96px] h-[96px] rounded-full border border-[#D4AF37]/20 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(212,175,55,0.15),transparent)] items-center justify-center text-[40px] opacity-80">⛸️</div>
                        </div>

                       {/* Ice note */}
                       {(selectedLog.noteIce || (selectedLog.iceItems && selectedLog.iceItems.length>0)) && (
                         <div className="mt-10 relative rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 lg:p-10 overflow-hidden">
                           <div className="absolute top-4 left-6 text-[56px] font-[900] leading-none text-[#D4AF37]/10">“</div>
                           <div className="relative">
                             <div className="label-caps text-[#D4AF37]">⛸️ 빙상 훈련</div>
                             {selectedLog.noteIce && <blockquote className="mt-4 text-[20px] lg:text-[22px] font-[600] leading-[1.6] tracking-[-0.01em] text-[#E8E2D2]">“{selectedLog.noteIce}”</blockquote>}
                             {selectedLog.iceItems && selectedLog.iceItems.length>0 && (
                               <div className="mt-5 flex flex-wrap gap-1.5">
                                 {selectedLog.iceItems.map(it=> <span key={it.id} className="px-3 h-7 rounded-full bg-[#1A1912] border border-[#2C2A20] text-[12px] font-[600] text-[#D4AF37]">{it.type} {it.value}{it.unit}</span>)}
                               </div>
                             )}
                           </div>
                         </div>
                       )}

                       {/* Dry note */}
                       {(selectedLog.noteDry || (selectedLog.dryItems && selectedLog.dryItems.length>0)) && (
                         <div className="mt-10 relative rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 lg:p-10 overflow-hidden">
                           <div className="absolute top-4 left-6 text-[56px] font-[900] leading-none text-[#D4AF37]/10">“</div>
                           <div className="relative">
                             <div className="label-caps text-[#D4AF37]">🏋️ 육상 훈련</div>
                             {selectedLog.noteDry && <blockquote className="mt-4 text-[20px] lg:text-[22px] font-[600] leading-[1.6] tracking-[-0.01em] text-[#E8E2D2]">“{selectedLog.noteDry}”</blockquote>}
                             {selectedLog.dryItems && selectedLog.dryItems.length>0 && (
                               <div className="mt-5 flex flex-wrap gap-1.5">
                                 {selectedLog.dryItems.map(it=> <span key={it.id} className="px-3 h-7 rounded-full bg-[#1A1912] border border-[#2C2A20] text-[12px] font-[600] text-[#C9A86A]">{it.type} {it.value}{it.unit}</span>)}
                               </div>
                             )}
                           </div>
                         </div>
                       )}

                       {!selectedLog.noteIce && !selectedLog.noteDry && !(selectedLog.iceItems&&selectedLog.iceItems.length) && !(selectedLog.dryItems&&selectedLog.dryItems.length) && !selectedLog.isRest && (
                         <div className="mt-10 rounded-[20px] bg-[#0E0E10] border border-[#1E1C14] p-8 text-center text-[14px] text-[#6A6A66]">기록된 내용이 없어요</div>
                       )}

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
                            <div className="mt-1.5 text-[14px] font-[500] leading-[1.6] text-[#CFCFC8]">{selectedLog.isRest ? '잘 쉬었네. 내일 빙판에서 가볍게 풀고 본 훈련 들어가자.' : selectedLog.noteIce && selectedLog.noteDry ? '빙상, 육상 둘 다 챙겼네! 이 페이스 유지하면서 회복도 신경 쓰자.' : selectedLog.noteIce ? '코너 진입 시 상체 기울기 좋았어. 다음엔 아웃-인-아웃 라인 연습하면 0.3초 더 줄일 수 있어.' : selectedLog.noteDry ? '코어 안정성이 올라왔어. 점프 후 착지 밸런스 유지가 핵심이야.' : '오늘의 훈련을 기록해보세요.'}</div>
                          </div>
                        </div>

                        {/* Edit/delete */}
                        <div className="mt-10 flex gap-3">
                          <button onClick={()=>{
                            setEditing({...selectedLog});
                            setDiaryEditMode(true);
                          }} className="h-[48px] px-8 rounded-full bg-[#F5F1E8] text-[#060608] font-[800] text-[14px] hover:bg-white transition-colors">수정하기</button>
                          <button onClick={()=>deleteLog(selectedLog.date)} className="h-[48px] px-6 rounded-full bg-[#18181B] border border-[#232326] text-[13px] font-[700] text-[#9A9A93] hover:border-[#3A3520] hover:text-[#F5F1E8]">삭제</button>
                          <button onClick={()=>exportReport(selectedLog)} disabled={pdfBusy} className="h-[48px] px-6 rounded-full bg-[#18181B] border border-[#232326] text-[13px] font-[700] text-[#D4AF37] hover:border-[#3A3520] flex items-center gap-2 disabled:opacity-50"><FileDown size={15}/> {pdfBusy ? '생성 중...' : '보고서 출력'}</button>
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
                {/* Input */}
                <div className="card p-5 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className="font-[700] text-[14px] flex items-center gap-2"><Trophy size={16} className="text-[#D4AF37]"/> 기록 입력</div>
                    <input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)} className="h-9 px-3 rounded-full bg-[#101012] border border-[#2A2A2E] text-[12px] font-[700] text-[#F5F1E8] outline-none"/>
                  </div>
                  <div className="mt-5 rounded-[16px] bg-[#0E0E10] border border-[#1E1E22] p-5">
                    <div className="label-caps">바퀴수 선택 · LAPS</div>
                    <div className="mt-4 flex items-center gap-3">
                      <button onClick={()=>setRecordLaps(Math.max(0,recordLaps-5))} className="w-11 h-11 rounded-full bg-[#18181B] border border-[#232326] font-[800] text-[18px]">−</button>
                      <div className="flex-1 h-[56px] rounded-[14px] bg-[#121214] border border-[#1E1E22] flex items-center justify-center gap-2">
                        <input type="number" inputMode="numeric" value={recordLaps} onChange={e=>setRecordLaps(parseInt(e.target.value)||0)} className="w-[80px] bg-transparent text-center font-[800] text-[26px] outline-none"/>
                        <span className="text-[12px] font-[700] text-[#6A6A66]">바퀴</span>
                      </div>
                      <button onClick={()=>setRecordLaps(recordLaps+5)} className="w-11 h-11 rounded-full gold-gradient text-[#060608] font-[800] text-[18px]">+</button>
                    </div>
                    <div className="mt-3 text-[11px] font-[600] text-[#6A6A66] text-center">{(recordLaps*111.12/1000).toFixed(2)}km · 111.12m 기준</div>
                  </div>
                  <div className="mt-4">
                    <div className="label-caps mb-3">시간 입력 · TIME</div>
                    <TimeInputsEditor timeInputs={recordTimeInputs} onChange={(d,v)=>setRecordTimeInputs({...recordTimeInputs, [d]:v})} />
                  </div>
                  <button onClick={saveRecordEntry} className="mt-5 w-full h-[52px] rounded-[16px] gold-gradient text-[#060608] font-[800] text-[14px] shadow-[0_0_24px_rgba(212,175,55,0.3)] hover:shadow-[0_0_32px_rgba(212,175,55,0.45)] active:scale-[0.98] transition-all">기록 저장</button>
                </div>

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
                    <div className="font-[700] text-[13px]">거리별 베스트 기록</div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {DISTANCES.filter(d=>d!==500).map(d=>(
                        <div key={d} className="rounded-[12px] bg-[#101012] border border-[#1E1E22] p-3">
                          <div className="label-caps">Best {d}m</div>
                          <div className="mt-1 font-[800] text-[16px] text-[#F5F1E8]">{bestByDistance[d].time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view==='growth' && (
              <div className="card p-5 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="font-[700] text-[14px]">시즌 목표 · Season Goals</div>
                  <button onClick={()=>setGoalForm({ id: crypto.randomUUID(), title:'', target:'', current:'', progress:0, icon:'🏆' })} className="h-8 px-3.5 rounded-full gold-gradient text-[#060608] text-[11px] font-[800]">+ 목표 추가</button>
                </div>
                <div className="mt-5 grid sm:grid-cols-3 gap-3">
                  {goals.map(g=>(
                    <div key={g.id} className="rounded-[16px] bg-[#101012] border border-[#1E1C14] p-4">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-full bg-[#1A1912] border border-[#2C2A20] flex items-center justify-center text-[18px]">{g.icon}</div>
                        <div className="flex gap-1">
                          <button onClick={()=>setGoalForm(g)} className="w-6 h-6 rounded-full bg-[#18181B] border border-[#232326] text-[10px] text-[#9A9A93] hover:text-[#F5F1E8]">✎</button>
                          <button onClick={()=>deleteGoalRemote(g.id)} className="w-6 h-6 rounded-full bg-[#18181B] border border-[#232326] text-[10px] text-[#9A9A93] hover:text-[#F5F1E8]">×</button>
                        </div>
                      </div>
                      <div className="mt-3 font-[700] text-[12px] leading-[1.3]">{g.title}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#1E1E22] overflow-hidden"><div className="h-full gold-gradient rounded-full" style={{width:`${g.progress}%`}}/></div>
                      <div className="mt-2 flex justify-between text-[10px] font-[600] text-[#9A9A93]"><span>{g.current}</span><span>{g.progress}% · 목표 {g.target}</span></div>
                    </div>
                  ))}
                  {goals.length===0 && !goalForm && <div className="sm:col-span-3 text-center py-8 text-[12px] text-[#6A6A66]">아직 등록된 목표가 없어요 · 위 버튼으로 추가해보세요</div>}
                </div>
                {goalForm && (
                  <div className="mt-5 rounded-[16px] bg-[#0E0E10] border border-[#1E1C14] p-4 space-y-3">
                    <div className="grid grid-cols-[56px_1fr] gap-2">
                      <input value={goalForm.icon} onChange={e=>setGoalForm({...goalForm, icon:e.target.value})} maxLength={2} className="h-10 rounded-[10px] bg-[#121214] border border-[#1E1E22] text-center text-[18px] outline-none"/>
                      <input value={goalForm.title} onChange={e=>setGoalForm({...goalForm, title:e.target.value})} placeholder="목표 제목 (예: 500m 50초 벽 돌파)" className="h-10 rounded-[10px] bg-[#121214] border border-[#1E1E22] px-3 text-[13px] font-[600] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={goalForm.current} onChange={e=>setGoalForm({...goalForm, current:e.target.value})} placeholder="현재 (예: 52.14)" className="h-10 rounded-[10px] bg-[#121214] border border-[#1E1E22] px-3 text-[13px] font-[600] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                      <input value={goalForm.target} onChange={e=>setGoalForm({...goalForm, target:e.target.value})} placeholder="목표 (예: 50.00)" className="h-10 rounded-[10px] bg-[#121214] border border-[#1E1E22] px-3 text-[13px] font-[600] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E]"/>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-[600] text-[#9A9A93]"><span>달성률</span><span className="text-[#D4AF37] font-[800]">{goalForm.progress}%</span></div>
                      <input type="range" min={0} max={100} value={goalForm.progress} onChange={e=>setGoalForm({...goalForm, progress: parseInt(e.target.value)})} className="mt-2 w-full accent-[#D4AF37]"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>{ saveGoalRemote(goalForm); setGoalForm(null); }} disabled={!goalForm.title.trim()} className="flex-1 h-10 rounded-full gold-gradient text-[#060608] font-[800] text-[12px] disabled:opacity-40">저장</button>
                      <button onClick={()=>setGoalForm(null)} className="h-10 px-4 rounded-full bg-[#18181B] border border-[#232326] text-[12px] font-[700] text-[#9A9A93]">취소</button>
                    </div>
                  </div>
                )}
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
          <div className="relative w-full lg:max-w-[640px] max-h-[92vh] lg:max-h-[88vh] overflow-auto rounded-t-[28px] lg:rounded-[28px] bg-[#0C0C0E]/80 backdrop-blur-2xl border border-[#2C2A20] shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(212,175,55,0.15)_inset]">
            <div className="sticky top-0 z-10 bg-[#0C0C0E]/90 backdrop-blur-xl border-b border-[#1E1C14] px-6 h-[68px] flex items-center justify-between">
              <div>
                <div className="font-[800] text-[15px] tracking-[-0.02em] flex items-center gap-2"><span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-[#060608] text-[12px]">✦</span>{editing.date} 훈련 기록</div>
                <div className="text-[11px] font-[500] text-[#9A9A93] mt-1">챔피언은 기록한다 · 디테일이 차이를 만든다</div>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-9 h-9 rounded-full bg-[#18181B] border border-[#232326] flex items-center justify-center hover:border-[#3A3520]"><X size={16}/></button>
            </div>

            <div className="p-6 space-y-6">
              <button onClick={()=>setEditing({...editing, isRest: !editing.isRest})} className={`w-full h-[56px] rounded-[16px] border flex items-center gap-3 px-4 transition-all ${editing.isRest? 'bg-[#F5F1E8] border-[#F5F1E8] text-[#060608]' : 'bg-[#121214] border-[#232326] text-[#CFCFC8] hover:border-[#3A3520]'}`}>
                <span className="text-[18px] leading-none">🌑</span>
                <span className="text-[13px] font-[800] flex-1 text-left">오늘은 리커버리(휴식) 데이예요</span>
                <span className={`w-10 h-[22px] rounded-full relative transition-all ${editing.isRest? 'bg-[#D4AF37]' : 'bg-[#232326]'}`}><span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all ${editing.isRest? 'left-[20px]' : 'left-0.5'}`}/></span>
              </button>

              {editing.isRest ? (
                <div className="rounded-[16px] bg-[#0E0E10] border border-[#1E1C14] p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#121214] border border-[#2C2A20] flex items-center justify-center text-[22px]">🌑</div>
                  <div className="mt-3 font-[700] text-[13px]">리커버리 데이</div>
                  <div className="mt-1 text-[11px] font-[500] text-[#9A9A93]">잘 쉬는 것도 챔피언의 전략. 내일 더 강하게.</div>
                  <div className="mt-4 rounded-[12px] bg-[#121214] border border-[#1E1E22] p-3"><div className="label-caps">Sleep</div><div className="mt-1 flex items-center gap-2"><input type="number" step="0.5" value={editing.sleepHours||8} onChange={e=>setEditing({...editing, sleepHours: parseFloat(e.target.value)||0})} className="w-full bg-transparent font-[800] text-[16px] outline-none"/>h</div></div>
                </div>
              ) : (
                <>
                  <div className="card !p-4">
                    <div className="label-caps mb-3">⛸️ 빙상 훈련 · 오늘의 디테일</div>
                    <ItemPicker itemTypes={iceItemTypes} items={editing.iceItems||[]} onAddType={(name,unit)=>saveItemType({id:crypto.randomUUID(), category:'ice', name, unit})} onDeleteType={deleteItemType} onAddItem={addIceItem} onRemoveItem={removeIceItem} compact />
                    <textarea value={editing.noteIce||''} onChange={e=>setEditing({...editing, noteIce:e.target.value})} placeholder="오늘 빙상 훈련은 어땠나요?" className="mt-3 w-full min-h-[70px] rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                  </div>
                  <div className="card !p-4">
                    <div className="label-caps mb-3">🏋️ 육상 훈련 · 오늘의 디테일</div>
                    <ItemPicker itemTypes={dryItemTypes} items={editing.dryItems||[]} onAddType={(name,unit)=>saveItemType({id:crypto.randomUUID(), category:'dry', name, unit})} onDeleteType={deleteItemType} onAddItem={addDryItem} onRemoveItem={removeDryItem} compact />
                    <textarea value={editing.noteDry||''} onChange={e=>setEditing({...editing, noteDry:e.target.value})} placeholder="오늘 육상 훈련은 어땠나요?" className="mt-3 w-full min-h-[70px] rounded-[12px] bg-[#0E0E10] border border-[#1E1E22] px-4 py-3 text-[13px] font-[500] leading-[1.5] outline-none focus:border-[#3A3520] placeholder:text-[#4A4A4E] resize-none"/>
                  </div>
                </>
              )}

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
