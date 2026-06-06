import type { JournalDoc, SourceType } from '../db/types';
import { fmtMoney, fmtDateAr } from './format';

const SOURCE_AR: Record<SourceType, string> = {
  payment: 'سند صرف نقدي',
  receipt: 'سند قبض نقدي',
  cashReset: 'سند تصفير الصندوق',
  deviceIntake: 'سند استلام جهاز',
  deviceDelivery: 'سند تسليم جهاز',
  advanceRefund: 'سند استرجاع عربون',
  creditProgramming: 'سند برمجة آجلة',
  posSale: 'فاتورة بيع',
  balanceSale: 'سند بيع رصيد',
  opening: 'قيد افتتاحي',
};

/** Brand mark — embedded SVG so the print window is fully self-contained (no external assets). */
const LOGO_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="nasimGradPrint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0ea5e9"/>
      <stop offset="0.5" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#nasimGradPrint)"/>
  <path d="M14 26c6-6 12 6 18 0s12-6 18 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity="0.55"/>
  <path d="M14 44c6-6 12 6 18 0s12-6 18 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity="0.55"/>
  <path d="M22 44V22l20 20V20" fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* ───────────────────────────── shared metadata ───────────────────────────── */

export interface PrintMeta {
  /** Company / shop name (اسم المحل أو الشركة) */
  companyName: string;
  /** Optional company logo (data-URI or URL). Falls back to the Nasim brand mark. */
  logo?: string;
  /** Document / report title (اسم التقرير) — e.g. "كشف حساب الصندوق" */
  title: string;
  /** Optional subtitle line under the title */
  subtitle?: string;
  /** Date period: from (الفترة من) — ISO date, optional */
  periodFrom?: string;
  /** Date period: to (الفترة إلى) — ISO date, optional */
  periodTo?: string;
  /** User who triggered the print (اسم المستخدم) */
  username?: string;
}

/* ───────────────────────────── shared shell ───────────────────────────── */

/** Current date/time for the footer (تاريخ ووقت الطباعة). */
function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} - ${time}`;
}

/** Period label "من YYYY/MM/DD إلى YYYY/MM/DD" using slashed dates as the user requested. */
function periodLabel(from?: string, to?: string): string {
  const slash = (iso?: string) => (iso ? iso.replace(/-/g, '/') : '');
  if (from && to) return `من ${slash(from)} إلى ${slash(to)}`;
  if (from) return `من ${slash(from)}`;
  if (to) return `حتى ${slash(to)}`;
  return '';
}

/** Build the professional, self-contained print document head + header + footer wrapper. */
function buildDocument(meta: PrintMeta, bodyHtml: string): string {
  const logoHtml = meta.logo
    ? `<img class="logo-img" src="${escapeHtml(meta.logo)}" alt="logo" />`
    : LOGO_SVG;
  const period = periodLabel(meta.periodFrom, meta.periodTo);
  const createdAt = nowStamp();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(meta.title)}${period ? ' ' + escapeHtml(period) : ''}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 20mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal','Cairo','Segoe UI',sans-serif;
    color: #0f172a; background: #fff; font-size: 13px; line-height: 1.5;
  }

  /* ── running header (repeats on every printed page via thead) ── */
  .report-header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 6px;
  }
  .report-header .brand { display: flex; align-items: center; gap: 12px; }
  .report-header .logo-img { width: 46px; height: 46px; object-fit: contain; border-radius: 10px; }
  .report-header .company { font-size: 20px; font-weight: 800; color: #0f172a; }
  .report-header .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .report-header .doc-info { text-align: left; }
  .report-header .doc-title { font-size: 18px; font-weight: 800; color: #1d4ed8; }
  .report-header .doc-period { font-size: 12.5px; color: #334155; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .report-header .doc-created { font-size: 11px; color: #64748b; margin-top: 3px; }

  /* the title row also appears centered as a banner */
  .title-banner {
    text-align: center; font-size: 16px; font-weight: 800; color: #0f172a;
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
    padding: 8px 14px; margin: 10px 0 14px;
  }
  .title-banner .period { display: block; font-size: 12.5px; font-weight: 600; color: #2563eb; margin-top: 3px; font-variant-numeric: tabular-nums; }

  /* ── data table ── */
  table.report-table { width: 100%; border-collapse: collapse; }
  table.report-table th, table.report-table td {
    border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 12.5px; text-align: right; vertical-align: top;
  }
  table.report-table thead th {
    background: #1d4ed8; color: #fff; font-weight: 700; border-color: #1d4ed8;
  }
  table.report-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.report-table td.num, table.report-table th.num { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.report-table tfoot td {
    background: #e0e7ff; font-weight: 800; border-color: #c7d2fe; font-size: 13px;
  }
  /* keep header row repeating on page breaks */
  table.report-table thead { display: table-header-group; }
  table.report-table tfoot { display: table-row-group; }
  table.report-table tr { page-break-inside: avoid; }

  /* ── voucher (single document) styling ── */
  .voucher-meta { display: flex; flex-wrap: wrap; gap: 10px 28px; font-size: 13px; color: #334155; margin: 4px 0 14px; }
  .voucher-meta b { color: #1e293b; }
  .desc-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 13px; margin: 14px 0; }
  .desc-box b { color: #475569; }
  .signs { display: flex; justify-content: space-between; gap: 16px; margin-top: 48px; }
  .signs .sign { flex: 1; text-align: center; font-size: 12.5px; color: #475569; }
  .signs .sign .line { border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 6px; }

  /* ── footer (fixed on every page) ── */
  .report-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1.5px solid #cbd5e1; padding: 6px 12px;
    font-size: 10.5px; color: #64748b; background: #fff;
  }
  .report-footer .page-num::after {
    counter-increment: page;
    content: "صفحة " counter(page) " من " counter(pages);
  }

  .empty-note { text-align: center; color: #94a3b8; padding: 40px 0; font-size: 14px; }

  @media print {
    .no-print { display: none !important; }
  }
  @media screen {
    body { padding: 20px; background: #f1f5f9; }
    .doc-sheet { max-width: 820px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 10px 30px rgba(2,6,23,.12); }
    .report-footer { position: static; margin-top: 24px; }
  }
</style>
</head>
<body>
  <div class="doc-sheet">
    <header class="report-header">
      <div class="brand">
        ${logoHtml}
        <div>
          <div class="company">${escapeHtml(meta.companyName || 'Nasim ERP')}</div>
          <div class="company-sub">Nasim ERP — نظام إدارة المحاسبة</div>
        </div>
      </div>
      <div class="doc-info">
        <div class="doc-title">${escapeHtml(meta.title)}</div>
        ${period ? `<div class="doc-period">${escapeHtml(period)}</div>` : ''}
        <div class="doc-created">تاريخ إنشاء التقرير: ${escapeHtml(createdAt)}</div>
      </div>
    </header>

    <main>${bodyHtml}</main>

    <footer class="report-footer">
      <span>تاريخ ووقت الطباعة: <bdi>${escapeHtml(createdAt)}</bdi></span>
      <span class="page-num"></span>
      <span>المستخدم: ${escapeHtml(meta.username || '—')}</span>
    </footer>
  </div>

  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 120); };</script>
</body>
</html>`;
}

/** Open a print window and write the self-contained document. */
function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    alert('تعذّر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ───────────────────────────── public: tabular report ───────────────────────────── */

export interface ReportColumn {
  /** Column header label */
  label: string;
  /** Row accessor key */
  key: string;
  /** numeric/left aligned monetary column */
  num?: boolean;
}

export interface ReportRow { [key: string]: string | number | null | undefined; }

export interface ReportTotals { [key: string]: number; }

/**
 * Professional, self-contained tabular report (account statements, journals,
 * customer/inventory reports, etc.). NEVER prints the screen UI — it builds
 * a dedicated print document with header / table / totals / footer.
 */
export function printReport(opts: {
  meta: PrintMeta;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** optional totals row keyed by column key; renders in tfoot */
  totals?: ReportTotals;
  /** label for the totals row's first cell (default: "الإجمالي") */
  totalsLabel?: string;
}) {
  const { meta, columns, rows, totals, totalsLabel = 'الإجمالي' } = opts;

  const headHtml = columns
    .map((c) => `<th class="${c.num ? 'num' : ''}">${escapeHtml(c.label)}</th>`)
    .join('');

  const bodyRows = rows.length
    ? rows
        .map(
          (r) =>
            `<tr>${columns
              .map((c) => {
                const v = r[c.key];
                if (c.num) {
                  const n = Number(v) || 0;
                  return `<td class="num">${n ? fmtMoney(n) : '—'}</td>`;
                }
                return `<td>${escapeHtml(String(v ?? ''))}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('')
    : '';

  let footHtml = '';
  if (totals && rows.length) {
    const firstNumIdx = columns.findIndex((c) => c.num);
    const spanCount = firstNumIdx > 0 ? firstNumIdx : 1;
    const cells: string[] = [];
    cells.push(`<td colspan="${spanCount}">${escapeHtml(totalsLabel)}</td>`);
    columns.slice(spanCount).forEach((c) => {
      if (c.num && totals[c.key] !== undefined) {
        cells.push(`<td class="num">${fmtMoney(totals[c.key])}</td>`);
      } else {
        cells.push('<td></td>');
      }
    });
    footHtml = `<tfoot><tr>${cells.join('')}</tr></tfoot>`;
  }

  const tableHtml = rows.length
    ? `<table class="report-table">
         <thead><tr>${headHtml}</tr></thead>
         <tbody>${bodyRows}</tbody>
         ${footHtml}
       </table>`
    : `<div class="empty-note">لا توجد بيانات ضمن الفترة المحددة</div>`;

  const period = periodLabel(meta.periodFrom, meta.periodTo);
  const banner = `<div class="title-banner">${escapeHtml(meta.title)}${
    period ? `<span class="period">${escapeHtml(period)}</span>` : ''
  }</div>`;

  openPrintWindow(buildDocument(meta, banner + tableHtml));
}

/* ───────────────────────────── public: single voucher ───────────────────────────── */

/**
 * Professional, self-contained voucher document (سند قبض/صرف، قيد، فاتورة …).
 * Uses the same branded header/footer shell as reports.
 */
export function printVoucher(j: JournalDoc, companyName = 'Nasim ERP', username?: string) {
  const sourceLabel = SOURCE_AR[j.source] || 'سند';
  const totalDebit = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = j.lines.reduce((s, l) => s + (l.credit || 0), 0);

  const rows = j.lines
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.accountName)}</td>
      <td class="num">${l.debit ? fmtMoney(l.debit) : '—'}</td>
      <td class="num">${l.credit ? fmtMoney(l.credit) : '—'}</td>
    </tr>`,
    )
    .join('');

  const body = `
    <div class="title-banner">${escapeHtml(sourceLabel)} رقم ${escapeHtml(j.voucherNo)}</div>
    <div class="voucher-meta">
      <span><b>رقم السند:</b> ${escapeHtml(j.voucherNo)}</span>
      <span><b>التاريخ:</b> ${escapeHtml(fmtDateAr(j.date))}</span>
      <span><b>أُنشئ بواسطة:</b> ${escapeHtml(j.createdBy || '—')}</span>
    </div>
    <table class="report-table">
      <thead><tr><th>الحساب</th><th class="num">مدين</th><th class="num">دائن</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>الإجمالي</td><td class="num">${fmtMoney(totalDebit)}</td><td class="num">${fmtMoney(totalCredit)}</td></tr></tfoot>
    </table>
    <div class="desc-box"><b>البيان:</b> ${escapeHtml(j.description || '—')}</div>
    <div class="signs">
      <div class="sign"><div class="line">المُحاسب</div></div>
      <div class="sign"><div class="line">المستلم</div></div>
      <div class="sign"><div class="line">المدير</div></div>
    </div>`;

  const meta: PrintMeta = {
    companyName,
    title: sourceLabel,
    username,
  };

  openPrintWindow(buildDocument(meta, body));
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
