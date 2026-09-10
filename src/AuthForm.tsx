import React, { useState } from 'react';
import { Crown, Send } from 'lucide-react';
import { useAuth } from './AuthContext';
import Logo from './Logo';

function mapError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return '이미 가입된 이메일이에요.';
    case 'auth/invalid-email': return '이메일 형식을 확인해주세요.';
    case 'auth/weak-password': return '비밀번호는 6자 이상이어야 해요.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return '이메일 또는 비밀번호가 올바르지 않아요.';
    default: return '문제가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
}

export default function AuthForm() {
  const { signUp, logIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'athlete'|'coach'|'parent'>('athlete');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') await signUp(email, password, name, role);
      else if (mode === 'reset') { await resetPassword(email); setResetSent(true); }
      else await logIn(email, password);
    } catch (err: any) {
      setError(mapError(err?.code || ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--c-060608)] text-[var(--c-F5F1E8)] antialiased flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src="/images/login-hero.jpg" alt=""
          onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
          className="absolute inset-0 w-full h-full object-cover object-[32%_45%]"
        />
        <div className="absolute inset-0 bg-[var(--c-060608)]/25" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(var(--c-D4AF37-rgb),0.10),transparent_60%),radial-gradient(60%_40%_at_90%_10%,rgba(var(--c-C9A86A-rgb),0.06),transparent_50%)]" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--c-D4AF37)]/40 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56}/>
        </div>

        <div
          className="card p-6"
          style={{
            '--c-0E0E10': '#F4F7FA', '--c-1E1E22': '#D6DCE3', '--c-9A9A93': '#67788A',
            '--c-4A4A4E': '#B2BFC9', '--c-3A3520': '#AAB8C8',
            '--field-bg': '#F2F3F5', '--field-border': '#E3E5E8',
            color: '#131A22',
          } as React.CSSProperties}
        >
          {mode === 'reset' ? (
            <div className="mb-6">
              <div className="font-[800] text-[16px]">비밀번호 재설정</div>
              <div className="mt-1 text-[12px] font-[500] text-[var(--c-6A6A66)]">가입한 이메일로 재설정 링크를 보내드려요</div>
            </div>
          ) : (
            <div className="flex gap-1.5 p-1 rounded-full bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] mb-6">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 h-9 rounded-full text-[12px] font-[700] transition-all ${mode === m ? 'gold-gradient text-[var(--c-on-accent)] shadow-[0_0_16px_rgba(var(--c-D4AF37-rgb),0.25)]' : 'text-[var(--c-9A9A93)]'}`}
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
          )}

          {mode === 'reset' && resetSent ? (
            <div className="rounded-[12px] bg-[rgba(var(--c-D4AF37-rgb),0.1)] border border-[var(--c-D4AF37)]/30 px-4 py-3.5 text-[13px] font-[600] text-[#8a6d1c]">
              {email}로 재설정 링크를 보냈어요. 메일함을 확인해주세요.
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="label-caps">이름</label>
                  <input
                    required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="예: 서윤" autoComplete="name"
                    className="field mt-1.5 w-full h-11 rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 text-[13px] font-[500] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"
                  />
                </div>
                <div>
                  <label className="label-caps">회원 분류</label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {([['athlete','선수'],['coach','코치'],['parent','부모']] as const).map(([val,label])=>(
                      <button
                        key={val} type="button" onClick={()=>setRole(val)}
                        className={`h-11 rounded-[12px] border text-[13px] font-[700] transition-all ${role===val? 'gold-gradient border-[var(--c-D4AF37)] text-[var(--c-on-accent)]' : 'bg-[var(--c-0E0E10)] border-[var(--c-1E1E22)] text-[var(--c-9A9A93)] hover:border-[var(--c-3A3520)]'}`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label-caps">이메일</label>
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com" autoComplete="email"
                className="field mt-1.5 w-full h-11 rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 text-[13px] font-[500] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"
              />
            </div>
            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label-caps">비밀번호</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('reset'); setError(''); setResetSent(false); }} className="text-[11px] font-[600] text-[var(--c-9A9A93)] hover:text-[var(--c-D4AF37)]">비밀번호를 잊으셨나요?</button>
                  )}
                </div>
                <input
                  required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상" minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="field mt-1.5 w-full h-11 rounded-[12px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 text-[13px] font-[500] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)]"
                />
              </div>
            )}

            {error && (
              <div className="rounded-[10px] bg-[#1A0E0E] border border-[#3A2020] px-3.5 py-2.5 text-[12px] font-[600] text-[#E8A0A0]">{error}</div>
            )}

            <button
              type="submit" disabled={busy}
              className="w-full h-[48px] rounded-[14px] gold-gradient text-[var(--c-on-accent)] font-[800] text-[13px] flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(var(--c-D4AF37-rgb),0.25)] hover:shadow-[0_0_28px_rgba(var(--c-D4AF37-rgb),0.35)] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {mode === 'reset'
                ? <><Send size={14} /> {busy ? '전송 중...' : '재설정 링크 보내기'}</>
                : <><Crown size={14} /> {busy ? '처리 중...' : mode === 'login' ? '로그인' : '가입하고 시작하기'}</>}
            </button>
          </form>
          )}
        </div>

        <div className="mt-5 text-center text-[11px] font-[500] text-[var(--c-6A6A66)]">
          {mode === 'reset' ? (
            <button type="button" onClick={() => { setMode('login'); setError(''); setResetSent(false); }} className="text-[var(--c-D4AF37)] font-[700] hover:underline">로그인으로 돌아가기</button>
          ) : (
            <>
              {mode === 'login' ? '아직 계정이 없나요? ' : '이미 계정이 있나요? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="text-[var(--c-D4AF37)] font-[700] hover:underline"
              >
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
