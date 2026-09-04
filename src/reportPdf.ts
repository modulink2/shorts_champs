import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TYPE_META, logTypes, type TrainingLog } from './App';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface ReportExtras {
  bestByDistance: Record<number, { time: string; date: string }>;
  careerLabel?: string;
  coachName?: string;
}

function buildReportInnerHtml(log: TrainingLog, athleteName: string, extras: ReportExtras): string {
  const bestRows = Object.entries(extras.bestByDistance)
    .map(([distance, r]) => ({ distance: Number(distance), ...r }))
    .sort((a, b) => a.distance - b.distance);
  const timeRows = bestRows.length
    ? bestRows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#faf7ee'};">
        <td style="padding:12px 16px;border-bottom:1px solid #eee2c0;color:#333;font-weight:600;">${r.distance}m</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee2c0;font-weight:800;color:#8a6d1c;font-size:15px;">${escapeHtml(r.time)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee2c0;color:#999;">${escapeHtml(r.date)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px;color:#999;text-align:center;">기록 없음</td></tr>`;

  const itemsChips = (items: typeof log.dryItems) => (items || []).filter(it => it && typeof it === 'object' && typeof it.type === 'string')
    .map(it => `<span style="display:inline-flex;align-items:center;line-height:1;margin:0 8px 8px 0;padding:8px 16px;border:1px solid #D4AF37;border-radius:999px;font-size:13px;font-weight:600;color:#8a6d1c;background:#fffdf6;">${escapeHtml(it.type)} ${it.value}${escapeHtml(it.unit)}</span>`).join('');
  const iceItemsHtml = itemsChips(log.iceItems);
  const dryItemsHtml = itemsChips(log.dryItems);

  const types = logTypes(log);
  const typeLabel = types.length ? types.map(t => TYPE_META[t].label).join(' + ') : '기록 없음';

  const itemSections = [
    iceItemsHtml ? `
      <div style="margin-top:20px;">
        <div style="font-size:13px;font-weight:800;color:#1a1a1a;border-left:4px solid #D4AF37;padding-left:10px;">⛸️ 빙상 훈련 항목</div>
        <div style="margin-top:12px;padding:20px 22px;background:#faf9f6;border-radius:14px;">${iceItemsHtml}</div>
      </div>` : '',
    dryItemsHtml ? `
      <div style="margin-top:20px;">
        <div style="font-size:13px;font-weight:800;color:#1a1a1a;border-left:4px solid #D4AF37;padding-left:10px;">🏋️ 육상 훈련 항목</div>
        <div style="margin-top:12px;padding:20px 22px;background:#faf9f6;border-radius:14px;">${dryItemsHtml}</div>
      </div>` : '',
  ].join('');

  const heroStats = [
    { label: '훈련 일자', value: log.date },
    { label: '훈련 타입', value: typeLabel },
    { label: '쇼트트랙 경력', value: extras.careerLabel || '-' },
    { label: '담당 코치', value: extras.coachName || '-' },
  ].map(s => `
    <div style="flex:1;background:linear-gradient(180deg,#fffdf6 0%,#faf5e6 100%);border:1px solid #e9dfb8;border-radius:14px;padding:18px 16px;">
      <div style="font-size:11px;letter-spacing:0.5px;color:#a9925a;font-weight:700;">${s.label}</div>
      <div style="font-size:17px;font-weight:800;margin-top:6px;color:#1a1a1a;">${escapeHtml(s.value)}</div>
    </div>`).join('');

  return `
    <div style="background:linear-gradient(135deg,#0b0e14 0%,#1a1d29 100%);border-radius:18px;padding:32px 36px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;letter-spacing:3px;color:#D4AF37;font-weight:800;">SHORT TRACK · CHAMPION EDITION</div>
        <div style="font-size:30px;font-weight:800;margin-top:8px;color:#ffffff;letter-spacing:-0.5px;">훈련 보고서</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:#9a9a93;">선수</div>
        <div style="font-size:19px;font-weight:800;margin-top:4px;color:#ffd700;">${escapeHtml(athleteName)}</div>
      </div>
    </div>

    <div style="margin-top:24px;display:flex;gap:14px;">${heroStats}</div>

    <div style="margin-top:28px;">
      <div style="font-size:13px;font-weight:800;color:#1a1a1a;border-left:4px solid #D4AF37;padding-left:10px;">🏆 거리별 베스트 기록</div>
      <table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:14px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px #eee2c0;">
        <thead>
          <tr style="background:#0b0e14;">
            <th style="padding:10px 16px;text-align:left;color:#D4AF37;font-size:12px;letter-spacing:0.5px;">거리</th>
            <th style="padding:10px 16px;text-align:left;color:#D4AF37;font-size:12px;letter-spacing:0.5px;">기록</th>
            <th style="padding:10px 16px;text-align:left;color:#D4AF37;font-size:12px;letter-spacing:0.5px;">날짜</th>
          </tr>
        </thead>
        <tbody>${timeRows}</tbody>
      </table>
    </div>

    ${itemSections}

    <div style="margin-top:44px;padding-top:18px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;letter-spacing:1px;color:#a9925a;font-weight:700;">SHORT TRACK · CHAMPION EDITION</span>
      <span style="font-size:11px;color:#999;">생성일: ${new Date().toLocaleDateString('ko-KR')}</span>
    </div>
  `;
}

export async function downloadTrainingReport(log: TrainingLog, athleteName: string, extras: ReportExtras) {
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
    container.style.cssText = 'width:794px;padding:40px;background:#ffffff;color:#111111;font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;box-sizing:border-box;';
    container.innerHTML = buildReportInnerHtml(log, athleteName, extras);
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
