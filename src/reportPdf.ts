import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TYPE_META, logTypes, type TrainingLog } from './App';

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

  const itemsChips = (items: typeof log.dryItems) => (items || []).filter(it => it && typeof it === 'object' && typeof it.type === 'string')
    .map(it => `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border:1px solid #D4AF37;border-radius:999px;font-size:13px;color:#8a6d1c;">${escapeHtml(it.type)} ${it.value}${escapeHtml(it.unit)}</span>`).join('');
  const iceItemsHtml = itemsChips(log.iceItems);
  const dryItemsHtml = itemsChips(log.dryItems);

  const types = logTypes(log);
  const typeLabel = types.length ? types.map(t => TYPE_META[t].label).join(' + ') : '기록 없음';

  const noteSections = [
    (log.noteIce || iceItemsHtml) ? `
      <div style="margin-top:16px;">
        <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">⛸️ 빙상 훈련</div>
        <div style="margin-top:10px;padding:18px 20px;background:#faf9f6;border-radius:12px;font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap;">${log.noteIce ? escapeHtml(log.noteIce) : ''}${iceItemsHtml ? `<div style="margin-top:${log.noteIce?'12px':'0'};">${iceItemsHtml}</div>` : ''}</div>
      </div>` : '',
    (log.noteDry || dryItemsHtml) ? `
      <div style="margin-top:16px;">
        <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">🏋️ 육상 훈련</div>
        <div style="margin-top:10px;padding:18px 20px;background:#faf9f6;border-radius:12px;font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap;">${log.noteDry ? escapeHtml(log.noteDry) : ''}${dryItemsHtml ? `<div style="margin-top:${log.noteDry?'12px':'0'};">${dryItemsHtml}</div>` : ''}</div>
      </div>` : '',
  ].join('');

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
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${typeLabel}</div>
      </div>
      <div style="flex:1;background:#faf9f6;border:1px solid #eee;border-radius:12px;padding:16px 18px;">
        <div style="font-size:12px;color:#999;">바퀴수</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${log.laps ?? '-'}${log.laps ? ' 바퀴' : ''}${log.km ? ` (${log.km}km)` : ''}</div>
      </div>
    </div>

    <div style="margin-top:24px;">
      <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">기록 타임</div>
      <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:14px;">${timeRows}</table>
    </div>

    <div style="margin-top:16px;">
      <div style="font-size:13px;font-weight:700;color:#333;border-left:4px solid #D4AF37;padding-left:8px;">한줄 일기</div>
      ${noteSections || `<div style="margin-top:10px;padding:18px 20px;background:#faf9f6;border-radius:12px;font-size:14px;line-height:1.7;color:#333;">기록된 메모가 없습니다.</div>`}
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
