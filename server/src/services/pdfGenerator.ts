import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { LedgerData, formatCurrency } from './ledgerEngine';

// A4 landscape — matches the wide, spacious layout used on-screen and for browser print
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_LEFT = 24;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 24;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const LOGO_PATH = path.join(__dirname, '../../public/aurora-logo.jpg');
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

// Vertical gap left between stacked sections (letterhead, student info, deposits, each year table, summary)
const GAP = 6;

// Colors
const COLOR_BLACK = '#000000';
const COLOR_BORDER = '#000000';
const COLOR_HEADER_BG = '#f0f0f0';
const COLOR_SECTION_BG = '#e8e8e8';
const COLOR_WHITE = '#ffffff';

// Column widths for the year fee grid — 11 real columns, sums to exactly CONTENT_WIDTH
const COLS = {
  FEE_DETAILS: CONTENT_WIDTH * 0.15,
  FEE_FIXED: CONTENT_WIDTH * 0.07,
  INST_FEE_PAID: CONTENT_WIDTH * 0.07,
  INST_RECEIPT: CONTENT_WIDTH * 0.11,
  SIGN: CONTENT_WIDTH * 0.06,
};

interface DrawContext {
  doc: PDFKit.PDFDocument;
  y: number;
  pageNo: number;
}

function drawRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill?: string, stroke?: string): void {
  doc.save();
  if (fill) doc.fillColor(fill);
  if (stroke) doc.strokeColor(stroke);
  if (fill && stroke) {
    doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
  } else if (fill) {
    doc.rect(x, y, w, h).fill(fill);
  } else {
    doc.rect(x, y, w, h).stroke(stroke || COLOR_BORDER);
  }
  doc.restore();
}

function drawText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fontSize?: number;
    font?: string;
    align?: string;
    color?: string;
    valign?: 'top' | 'center' | 'bottom';
  } = {}
): void {
  const fontSize = opts.fontSize || 8;
  const font = opts.font || 'Helvetica';
  const align = (opts.align || 'center') as 'left' | 'center' | 'right';
  const color = opts.color || COLOR_BLACK;
  const valign = opts.valign || 'center';

  doc.save();
  doc.font(font).fontSize(fontSize).fillColor(color);

  const textH = fontSize * 1.2;
  let textY = y + 2;
  if (valign === 'center') textY = y + (h - textH) / 2;
  else if (valign === 'bottom') textY = y + h - textH - 2;

  const padding = 3;
  doc.text(text, x + padding, textY, {
    width: w - padding * 2,
    align,
    lineBreak: false,
    ellipsis: true
  });
  doc.restore();
}

function drawCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fontSize?: number;
    font?: string;
    align?: string;
    bg?: string;
    color?: string;
    border?: boolean;
    valign?: 'top' | 'center' | 'bottom';
  } = {}
): void {
  const border = opts.border !== false;
  if (opts.bg) {
    drawRect(doc, x, y, w, h, opts.bg, border ? COLOR_BORDER : undefined);
  } else if (border) {
    drawRect(doc, x, y, w, h, undefined, COLOR_BORDER);
  }
  if (text) {
    drawText(doc, text, x, y, w, h, {
      fontSize: opts.fontSize,
      font: opts.font,
      align: opts.align,
      color: opts.color,
      valign: opts.valign
    });
  }
}

function drawPageHeader(ctx: DrawContext): void {
  const { doc } = ctx;
  const y = MARGIN_TOP;
  const headerHeight = 74;
  const leftW = CONTENT_WIDTH * 0.30;
  const logoW = CONTENT_WIDTH * 0.16;

  // No box borders here — plain letterhead, matching the on-screen ledger
  doc.save();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_BLACK);
  doc.text('AURORA HIGHER EDUCATION', MARGIN_LEFT, y + 2, { width: leftW, align: 'left', lineBreak: true });
  doc.text('AND RESEARCH ACADEMY', MARGIN_LEFT, y + 17, { width: leftW, align: 'left' });
  doc.font('Helvetica').fontSize(6.5).fillColor('#333333');
  doc.text('(Deemed-to-be-University Estd.u/s.03 of UGC Act 1956)', MARGIN_LEFT, y + 33, { width: leftW, align: 'left' });
  doc.text('UPPAL, HYDERABAD - 500 098', MARGIN_LEFT, y + 42, { width: leftW, align: 'left' });
  doc.restore();

  // Title — centered across the full content width
  doc.save();
  doc.font('Helvetica-Bold').fontSize(22).fillColor(COLOR_BLACK);
  doc.text('FEE LEDGER', MARGIN_LEFT, y + 26, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 2 });
  doc.restore();

  // Logo — top-right corner, no box
  const logoX = MARGIN_LEFT + CONTENT_WIDTH - logoW;
  if (LOGO_EXISTS) {
    try {
      doc.image(LOGO_PATH, logoX, y, { fit: [logoW, headerHeight - 6], align: 'right' });
    } catch {
      /* fall through silently if the image can't be decoded */
    }
  } else {
    doc.save();
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a8a');
    doc.text('AURORA', logoX, y + 22, { width: logoW, align: 'right' });
    doc.font('Helvetica').fontSize(6.5).fillColor('#666666');
    doc.text('Higher Education', logoX, y + 38, { width: logoW, align: 'right' });
    doc.restore();
  }

  ctx.y = y + headerHeight;
}

function drawStudentInfo(ctx: DrawContext, student: LedgerData['student']): void {
  const { doc } = ctx;
  let y = ctx.y;

  const rowH = 22;
  const col1W = 95;
  const col2W = CONTENT_WIDTH * 0.5 - col1W;
  const col3W = 95;
  const col4W = CONTENT_WIDTH - col1W - col2W - col3W;

  const rows = [
    ['Student Name', student.student_name || '', 'Registration No.', student.registration_no || ''],
    ["Father's Name", student.father_name || '', 'Campus', student.campus || ''],
    ['School', student.school || '', 'Programme', student.program || ''],
    ['Date of Joining', formatDisplayDate(student.date_of_joining), 'Date of Leaving', formatDisplayDate(student.date_of_leaving)],
  ];

  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, rowH * rows.length, COLOR_WHITE, COLOR_BORDER);

  for (let i = 0; i < rows.length; i++) {
    const [l1, v1, l2, v2] = rows[i];
    const rowY = y + i * rowH;

    if (i > 0) {
      doc.moveTo(MARGIN_LEFT, rowY).lineTo(MARGIN_LEFT + CONTENT_WIDTH, rowY).stroke(COLOR_BORDER);
    }

    let x = MARGIN_LEFT;
    drawCell(doc, l1, x, rowY, col1W, rowH, { fontSize: 8.5, font: 'Helvetica-Bold', align: 'left', bg: COLOR_HEADER_BG, valign: 'center' });
    x += col1W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    drawCell(doc, v1, x, rowY, col2W, rowH, { fontSize: 8.5, align: 'left', border: false, valign: 'center' });
    x += col2W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    drawCell(doc, l2, x, rowY, col3W, rowH, { fontSize: 8.5, font: 'Helvetica-Bold', align: 'left', bg: COLOR_HEADER_BG, valign: 'center' });
    x += col3W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    drawCell(doc, v2, x, rowY, col4W, rowH, { fontSize: 8.5, align: 'left', border: false, valign: 'center' });
  }

  ctx.y = y + rowH * rows.length;
}

function drawDepositSection(ctx: DrawContext, deposits: LedgerData['deposits']): void {
  const { doc } = ctx;
  let y = ctx.y;

  const halfW = CONTENT_WIDTH / 2;
  const depColW = halfW * 0.24;
  const amtColW = halfW * 0.22;
  const signColW = halfW * 0.12;
  const rcptColW = halfW - depColW - amtColW - signColW;

  const headerH = 18;
  const rowH = 24;

  for (let half = 0; half < 2; half++) {
    const baseX = MARGIN_LEFT + half * halfW;
    let x = baseX;

    drawCell(doc, 'Deposits', x, y, depColW, headerH, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += depColW;
    drawCell(doc, 'Amount', x, y, amtColW, headerH, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += amtColW;
    drawCell(doc, 'Receipt No. & Date', x, y, rcptColW, headerH, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += rcptColW;
    drawCell(doc, 'Sign.', x, y, signColW, headerH, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });

    const dep = deposits[half] || null;
    const ry = y + headerH;
    x = baseX;
    drawCell(doc, 'Deposit', x, ry, depColW, rowH, { fontSize: 8, align: 'center' });
    x += depColW;
    drawCell(doc, dep ? formatCurrency(dep.amount) : '', x, ry, amtColW, rowH, { fontSize: 8, align: 'center' });
    x += amtColW;
    const rcpt = dep && (dep.receipt_no || dep.deposit_date) ? `${dep.receipt_no || ''}${dep.deposit_date ? ' / ' + formatDisplayDate(dep.deposit_date) : ''}` : '';
    drawCell(doc, rcpt, x, ry, rcptColW, rowH, { fontSize: 7.5, align: 'center' });
    x += rcptColW;
    drawCell(doc, '', x, ry, signColW, rowH, { fontSize: 8, align: 'center' });
  }

  ctx.y = y + headerH + rowH;
}

function drawYearSection(ctx: DrawContext, yearSection: LedgerData['year_sections'][0]): void {
  const { doc } = ctx;

  const installments = ['I', 'II', 'III', 'IV'];
  const headerH1 = 20; // year name / Instalment I-IV / Sign. row
  const headerH2 = 18; // Fee Details / Fee Fixed / Fee Paid / Receipt No. & Date / Asst./Acct. row
  const dataRowH = 26;

  let y = ctx.y;

  // Header row 1 — the year name takes the place Fee Details/Fee Fixed would otherwise sit in,
  // exactly like "Instalment I" sits above "Fee Paid"/"Receipt No. & Date". No separate title bar.
  let x = MARGIN_LEFT;
  const yearW = COLS.FEE_DETAILS + COLS.FEE_FIXED;
  drawCell(doc, yearSection.study_year, x, y, yearW, headerH1, {
    fontSize: 9.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'left'
  });
  x += yearW;

  for (const inst of installments) {
    const groupW = COLS.INST_FEE_PAID + COLS.INST_RECEIPT;
    drawCell(doc, `Instalment ${inst}`, x, y, groupW, headerH1, {
      fontSize: 8.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center'
    });
    x += groupW;
  }

  drawCell(doc, 'Sign.', x, y, COLS.SIGN, headerH1, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
  y += headerH1;

  // Header row 2 — sub-labels for every group above
  x = MARGIN_LEFT;
  drawCell(doc, 'Fee Details', x, y, COLS.FEE_DETAILS, headerH2, { fontSize: 8, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
  x += COLS.FEE_DETAILS;
  drawCell(doc, 'Fee Fixed', x, y, COLS.FEE_FIXED, headerH2, { fontSize: 7.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
  x += COLS.FEE_FIXED;

  for (const _inst of installments) {
    drawCell(doc, 'Fee Paid', x, y, COLS.INST_FEE_PAID, headerH2, { fontSize: 7, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
    x += COLS.INST_FEE_PAID;
    drawCell(doc, 'Receipt No. & Date', x, y, COLS.INST_RECEIPT, headerH2, { fontSize: 6.5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
    x += COLS.INST_RECEIPT;
  }

  drawCell(doc, 'Asst./Acct.', x, y, COLS.SIGN, headerH2, { fontSize: 6.5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });

  y += headerH2;

  // Data rows — "Special Fee" is a bold header row totalling all its sub-types, each of
  // which is then drawn as an indented, italicized sub-row underneath (see ledgerEngine.ts).
  for (const feeRow of yearSection.fee_rows) {
    x = MARGIN_LEFT;
    const ry = y;
    const isHeader = !!feeRow.is_special_header;
    const isSub = !!feeRow.is_special_sub;
    const rowBg = isHeader ? COLOR_HEADER_BG : undefined;
    const rowFont = isHeader ? 'Helvetica-Bold' : (isSub ? 'Helvetica-Oblique' : 'Helvetica');
    const label = isSub ? `   • ${feeRow.fee_type}` : feeRow.fee_type;

    drawCell(doc, label, x, ry, COLS.FEE_DETAILS, dataRowH, {
      fontSize: isSub ? 7.5 : 8.5, font: rowFont, align: 'left', valign: 'center', bg: rowBg,
      color: isSub ? '#333333' : COLOR_BLACK
    });
    x += COLS.FEE_DETAILS;

    const totalFixed = Object.values(feeRow.installments).reduce((s, inst) => s + inst.fee_fixed, 0);
    drawCell(doc, totalFixed ? formatCurrency(totalFixed) : '', x, ry, COLS.FEE_FIXED, dataRowH, {
      fontSize: isSub ? 7.5 : 8, font: rowFont, align: 'right', valign: 'center', bg: rowBg
    });
    x += COLS.FEE_FIXED;

    for (const inst of installments) {
      const instData = feeRow.installments[inst] || { fee_fixed: 0, payments: [], total_paid: 0, receipt_display: '' };
      drawCell(doc, instData.total_paid ? formatCurrency(instData.total_paid) : '', x, ry, COLS.INST_FEE_PAID, dataRowH, {
        fontSize: isSub ? 7.5 : 8, font: rowFont, align: 'right', valign: 'center', bg: rowBg
      });
      x += COLS.INST_FEE_PAID;
      drawCell(doc, instData.receipt_display || '', x, ry, COLS.INST_RECEIPT, dataRowH, { fontSize: 7, align: 'center', valign: 'center', bg: rowBg });
      x += COLS.INST_RECEIPT;
    }

    drawCell(doc, '', x, ry, COLS.SIGN, dataRowH, { fontSize: 8, align: 'center', valign: 'center', bg: rowBg });

    y += dataRowH;
  }

  ctx.y = y;
}

function drawSummarySection(ctx: DrawContext, summary: LedgerData['summary'], deposits: LedgerData['deposits']): void {
  const { doc } = ctx;
  let y = ctx.y;

  const totalDeposit = deposits.reduce((s, d) => s + d.amount, 0);

  const outerH = 96;
  const leftW = 20;
  const midW = (CONTENT_WIDTH - leftW) / 2;
  const rightW = CONTENT_WIDTH - leftW - midW;

  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, outerH, COLOR_WHITE, COLOR_BORDER);

  doc.save();
  doc.translate(MARGIN_LEFT + leftW / 2, y + outerH / 2);
  doc.rotate(-90);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_BLACK);
  doc.text('Annexed', -24, -4, { width: 48, align: 'center' });
  doc.restore();

  doc.moveTo(MARGIN_LEFT + leftW, y).lineTo(MARGIN_LEFT + leftW, y + outerH).stroke(COLOR_BORDER);

  const rowH = outerH / 3;
  const labelColW = 130;
  const valueColW = midW - labelColW;
  const leftRows: [string, string][] = [
    ['Deposit', formatCurrency(totalDeposit)],
    ['Refund / Adjustment', formatCurrency(summary.total_refund_adjustment)],
    ['Due', formatCurrency(summary.due)],
  ];
  for (let i = 0; i < leftRows.length; i++) {
    const [label, value] = leftRows[i];
    const ry = y + i * rowH;
    if (i > 0) doc.moveTo(MARGIN_LEFT + leftW, ry).lineTo(MARGIN_LEFT + leftW + midW, ry).stroke(COLOR_BORDER);
    drawCell(doc, label, MARGIN_LEFT + leftW, ry, labelColW, rowH, { fontSize: 8.5, font: 'Helvetica-Bold', align: 'left', valign: 'center', border: false });
    doc.moveTo(MARGIN_LEFT + leftW + labelColW, ry).lineTo(MARGIN_LEFT + leftW + labelColW, ry + rowH).stroke(COLOR_BORDER);
    drawCell(doc, value, MARGIN_LEFT + leftW + labelColW, ry, valueColW, rowH, {
      fontSize: 8.5, align: 'right', valign: 'center', border: false,
      color: label === 'Due' ? (summary.due > 0 ? '#dc2626' : '#16a34a') : COLOR_BLACK
    });
  }

  doc.moveTo(MARGIN_LEFT + leftW + midW, y).lineTo(MARGIN_LEFT + leftW + midW, y + outerH).stroke(COLOR_BORDER);

  const rightLabelW = 130;
  const rightValueW = 90;
  const rightRemarksW = rightW - rightLabelW - rightValueW;
  const rightRows: [string, string][] = [
    ['Total Fee', formatCurrency(summary.total_fee)],
    ['Amount Paid', formatCurrency(summary.total_paid)],
    ['Due', formatCurrency(summary.due)],
  ];

  for (let i = 0; i < rightRows.length; i++) {
    const [label, value] = rightRows[i];
    const ry = y + i * rowH;
    const baseX = MARGIN_LEFT + leftW + midW;
    if (i > 0) doc.moveTo(baseX, ry).lineTo(baseX + rightW, ry).stroke(COLOR_BORDER);
    drawCell(doc, label, baseX, ry, rightLabelW, rowH, { fontSize: 8.5, font: 'Helvetica-Bold', align: 'left', valign: 'center', border: false });
    doc.moveTo(baseX + rightLabelW, ry).lineTo(baseX + rightLabelW, ry + rowH).stroke(COLOR_BORDER);
    drawCell(doc, value, baseX + rightLabelW, ry, rightValueW, rowH, {
      fontSize: 8.5, align: 'right', valign: 'center', border: false,
      color: label === 'Due' ? (summary.due > 0 ? '#dc2626' : '#16a34a') : COLOR_BLACK
    });
    doc.moveTo(baseX + rightLabelW + rightValueW, ry).lineTo(baseX + rightLabelW + rightValueW, ry + rowH).stroke(COLOR_BORDER);
    if (i === 0) {
      drawCell(doc, 'Remarks', baseX + rightLabelW + rightValueW, ry, rightRemarksW, rowH, {
        fontSize: 8, font: 'Helvetica-Bold', align: 'center', valign: 'top', border: false
      });
    }
  }

  ctx.y = y + outerH;
}

function drawSignatureSection(ctx: DrawContext): void {
  const { doc } = ctx;
  const y = ctx.y + 20;
  const sigW = CONTENT_WIDTH / 3;

  const sigs = ['Assistant', 'Accountant', 'Finance Officer'];
  for (let i = 0; i < 3; i++) {
    const x = MARGIN_LEFT + i * sigW;
    doc.moveTo(x + 20, y).lineTo(x + sigW - 20, y).stroke(COLOR_BORDER);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_BLACK);
    doc.text(sigs[i], x, y + 5, { width: sigW, align: 'center' });
  }
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

const PAGE_OPTS = {
  size: [PAGE_WIDTH, PAGE_HEIGHT] as [number, number],
  margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT }
};

function drawSingleLedger(doc: PDFKit.PDFDocument, ledgerData: LedgerData): void {
  const ctx: DrawContext = { doc, y: MARGIN_TOP, pageNo: 1 };

  // ── PAGE 1 ──
  doc.lineWidth(0.35); // addPage() resets graphics state to PDFKit's 1pt default — keep table lines thin
  drawPageHeader(ctx);
  ctx.y += GAP;
  drawStudentInfo(ctx, ledgerData.student);
  ctx.y += GAP;
  drawDepositSection(ctx, ledgerData.deposits);
  ctx.y += GAP;

  const page1Years = ledgerData.year_sections.filter(ys =>
    ys.study_year === 'Freshman Year' || ys.study_year === 'Sophomore Year'
  );
  const page2Years = ledgerData.year_sections.filter(ys =>
    ys.study_year !== 'Freshman Year' && ys.study_year !== 'Sophomore Year'
  );

  for (const ys of page1Years) {
    drawYearSection(ctx, ys);
    ctx.y += GAP;
  }

  // ── PAGE 2 ──
  doc.addPage(PAGE_OPTS);
  doc.lineWidth(0.35);
  ctx.y = MARGIN_TOP;
  ctx.pageNo = 2;

   for (const ys of page2Years) {
    drawYearSection(ctx, ys);
    ctx.y += GAP;
  }

  drawSummarySection(ctx, ledgerData.summary, ledgerData.deposits);
  drawSignatureSection(ctx);
}

export function generateFeeLedgerPDF(ledgerData: LedgerData): Promise<Buffer> {
  const chunks: Buffer[] = [];

  const doc = new PDFDocument({
    ...PAGE_OPTS,
    compress: false,
    autoFirstPage: true,
    bufferPages: true,
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawSingleLedger(doc, ledgerData);

  doc.flushPages();
  doc.end();

  return done;
}

export function generateBulkPDF(ledgers: LedgerData[]): Promise<Buffer> {
  const chunks: Buffer[] = [];

  const doc = new PDFDocument({
    ...PAGE_OPTS,
    compress: false,
    autoFirstPage: false,
    bufferPages: true,
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (const ledgerData of ledgers) {
    doc.addPage(PAGE_OPTS);
    drawSingleLedger(doc, ledgerData);
  }

  doc.flushPages();
  doc.end();

  return done;
}
