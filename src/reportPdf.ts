import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { TrainingLog } from './App';

const TYPE_LABEL: Record<string, string> = { ice: '빙상', dry: '육상', rest: '리커버리' };
const MOOD_LABEL: Record<number, string> = { 1: '최고', 2: '좋음', 3: '보통', 4: '힘듦', 5: '아픔' };

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildReportInnerHtml(log: TrainingLog, athleteName: string): string {
  const timeRecords = (log.timeRecords || []).slice().sort((a, b) => a.distance - b.distance);
  const timeRows = timeRecords.length
    ? timeRecords.map(r => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#444;">${r.distance}m</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700;">${r.time}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="padding:14px;color:#999;text-align:center;">기록 없음</td></tr>`;

  const dryItems = (log.dryItems || []).filter(it => it && typeof it === 'object' && typeof it.type === 'string');
  const dryHtml = dryItems.length
    ? `<div style="margin-top:24px;">
        <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">훈련 항목</div>
        <div style="margin-top:10px;">${dryItems.map(it => `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border:1px solid #D4AF37;border-radius:999px;font-size:13px;color:#8a6d1c;">${escapeHtml(it.type)} ${it.value}${escapeHtml(it.unit)}</span>`).join('')}</div>
      </div>`
    : '';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #D4AF37;padding-bottom:20px;">
      <div>
        <div style="font-size:12px;letter-spacing:2px;color:#D4AF37;font-weight:700;">SHORT TRACK CHAMPION EDITION</div>
        <div style="font-size:26px;font-weight:800;margin-top:6px;">훈련 보고서</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;color:#666;">선수</div>
        <div style="font-size:16px;font-weight:700;">${escapeHtml(athleteName)}</div>
      </div>
    </div>

    <div style="margin-top:28px;display:flex;gap:16px;">
      <div style="flex:1;background:#faf9f6;border:1px solid #eee;border-radius:12px;padding:16px 18px;">
        <div style="font-size:12px;color:#999;">훈련 일자</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${log.date}</div>
      </div>
      <div style="flex:1;background:#faf9f6;border:1px solid #eee;border-radius:12px;padding:16px 18px;">
        <div style="font-size:12px;color:#999;">훈련 타입</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${TYPE_LABEL[log.type] || log.type}</div>
      </div>
      <div style="flex:1;background:#faf9f6;border:1px solid #eee;border-radius:12px;padding:16px 18px;">
        <div style="font-size:12px;color:#999;">컨디션</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${MOOD_LABEL[log.condition] || '-'}</div>
      </div>
    </div>

    <div style="margin-top:24px;display:flex;gap:16px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">주요 지표</div>
        <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#666;width:110px;">바퀴수</td><td style="padding:8px 0;font-weight:700;">${log.laps ?? '-'}${log.laps ? ' 바퀴' : ''}${log.km ? ` (${log.km}km)` : ''}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">RPE (강도)</td><td style="padding:8px 0;font-weight:700;">${log.rpe ?? '-'} / 10</td></tr>
          <tr><td style="padding:8px 0;color:#666;">훈련 시간</td><td style="padding:8px 0;font-weight:700;">${log.minutes ?? 0}분</td></tr>
          <tr><td style="padding:8px 0;color:#666;">집중도</td><td style="padding:8px 0;font-weight:700;">${log.focus ?? '-'} / 5</td></tr>
          <tr><td style="padding:8px 0;color:#666;">수면 시간</td><td style="padding:8px 0;font-weight:700;">${log.sleepHours != null ? log.sleepHours.toFixed(1) : '-'}h</td></tr>
        </table>
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">기록 타임</div>
        <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:14px;">${timeRows}</table>
      </div>
    </div>

    ${dryHtml}

    <div style="margin-top:24px;">
      <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">한줄 일기</div>
      <div style="margin-top:10px;padding:18px 20px;background:#faf9f6;border-radius:12px;font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap;">${escapeHtml(log.note || '기록된 메모가 없습니다.')}</div>
    </div>

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:11px;color:#999;">
      <span>SHORT TRACK · BLACK &amp; GOLD EDITION</span>
      <span>생성일: ${new Date().toLocaleDateString('ko-KR')}</span>
    </div>
  `;
}

export async function downloadTrainingReport(log: TrainingLog, athleteName: string) {
  // Render into an isolated iframe with its own bare document (no Tailwind/Recharts CSS).
  // html2canvas clones the *whole* host document when given a live-app element, and chokes
  // on modern CSS (oklch colors, backdrop-filter) it doesn't understand — an iframe keeps it
  // away from the app entirely, on both desktop and mobile.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:100px;border:0;';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('report iframe document unavailable');
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;"></body></html>');
    doc.close();

    const container = doc.createElement('div');
    container.style.cssText = 'width:794px;padding:56px;background:#ffffff;color:#111111;font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;box-sizing:border-box;';
    container.innerHTML = buildReportInnerHtml(log, athleteName);
    doc.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`훈련보고서_${log.date}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
