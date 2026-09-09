import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { MessageSquarePlus, X, Send } from 'lucide-react';
import { useAuth } from './AuthContext';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

// Small header button that opens a feature/bug report form and emails it via
// EmailJS (client-only app, so a third-party mail relay stands in for a
// backend) — see .env.example for the three IDs this needs.
export default function FeedbackButton({ onToast, className, label = '제안하기' }: { onToast: (msg: string) => void; className?: string; label?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'feature' | 'bug'>('feature');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => { if (!sending) { setOpen(false); setText(''); } };

  const submit = async () => {
    if (!text.trim() || sending) return;
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      onToast('메일 발송 설정이 아직 안 되어 있어요');
      return;
    }
    setSending(true);
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        type: type === 'feature' ? '기능 제안' : '버그 제보',
        message: text.trim(),
        from_name: user?.displayName || '이름 없음',
        from_email: user?.email || '알 수 없음',
      }, { publicKey: PUBLIC_KEY });
      onToast('제안이 전달됐어요 · 감사합니다 🙏');
      setText('');
      setOpen(false);
    } catch (err) {
      console.error('[FeedbackButton]', err);
      onToast('전송에 실패했어요 · 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)} title="기능/버그 제안"
        className={className || 'h-9 px-3 rounded-full flex items-center gap-1.5 text-[var(--chrome-text-dim)] hover:text-[var(--c-D4AF37)] hover:bg-[var(--chrome-hover-bg)] transition-colors shrink-0'}
      >
        <MessageSquarePlus size={16} />
        <span className="text-[11px] font-[700] whitespace-nowrap">{label}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6">
          <div className="absolute inset-0 bg-black/70" onClick={close} />
          <div className="relative w-full lg:max-w-[480px] max-h-[92dvh] overflow-auto rounded-t-[28px] lg:rounded-[28px] bg-[var(--c-0C0C0E)] border border-[var(--c-2C2A20)] shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
            <div className="sticky top-0 z-10 bg-[var(--c-0C0C0E)] border-b border-[var(--c-1E1C14)] px-6 h-[68px] flex items-center justify-between">
              <div>
                <div className="font-[800] text-[15px] tracking-[-0.02em] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-[var(--c-on-accent)] text-[12px]"><MessageSquarePlus size={13} /></span>
                  기능/버그 제안
                </div>
                <div className="text-[11px] font-[500] text-[var(--c-9A9A93)] mt-1">더 좋은 아이스드림을 함께 만들어요</div>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-full bg-[var(--c-18181B)] border border-[var(--c-232326)] flex items-center justify-center text-[var(--c-9A9A93)] hover:text-[var(--c-F5F1E8)]"><X size={15} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {([['feature', '기능 제안'], ['bug', '버그 제보']] as const).map(([val, label]) => (
                  <button
                    key={val} onClick={() => setType(val)}
                    className={`h-11 rounded-[12px] border text-[13px] font-[700] transition-all ${type === val ? 'gold-gradient border-[var(--c-D4AF37)] text-[var(--c-on-accent)]' : 'bg-[var(--c-0E0E10)] border-[var(--c-1E1E22)] text-[var(--c-9A9A93)] hover:border-[var(--c-3A3520)]'}`}
                  >{label}</button>
                ))}
              </div>
              <textarea
                autoFocus value={text} onChange={(e) => setText(e.target.value)}
                placeholder={type === 'feature' ? '이런 기능이 있으면 좋겠어요...' : '어떤 상황에서 어떤 문제가 있었는지 알려주세요...'}
                className="field w-full min-h-[140px] rounded-[14px] bg-[var(--c-0E0E10)] border border-[var(--c-1E1E22)] px-4 py-3 text-[13px] font-[500] leading-[1.6] outline-none focus:border-[var(--c-3A3520)] placeholder:text-[var(--c-4A4A4E)] resize-none"
              />
              <button
                onClick={submit} disabled={!text.trim() || sending}
                className="w-full h-[48px] rounded-[14px] gold-gradient text-[var(--c-on-accent)] font-[800] text-[13px] flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(var(--c-D4AF37-rgb),0.25)] active:scale-[0.98] transition-all disabled:opacity-40"
              ><Send size={14} /> {sending ? '보내는 중...' : '보내기'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
