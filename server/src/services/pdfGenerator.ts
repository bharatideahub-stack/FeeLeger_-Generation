import PDFDocument from 'pdfkit';
import { LedgerData, formatCurrency } from './ledgerEngine';

// A4 dimensions
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 18;
const MARGIN_RIGHT = 18;
const MARGIN_TOP = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colors
const COLOR_BLACK = '#000000';
const COLOR_BORDER = '#000000';
const COLOR_HEADER_BG = '#f0f0f0';
const COLOR_SECTION_BG = '#e8e8e8';
const COLOR_WHITE = '#ffffff';

// Column widths for year table (total must equal CONTENT_WIDTH = 559.28)
const COL = {
  FEE_DETAILS: 88,
  FEE_FIXED: 38,
  INST_FEE_PAID: 33,
  INST_RECEIPT: 64,    // per installment
  SIGN: 28,
};
// Total: 88 + 38 + (33+64)*4 + 28 = 88+38+388+28 = 542 ... adjust
// Let me recalculate for 559.28:
// 559.28 - 88 - 38 - 28 = 405.28 / 4 = 101.32 per installment
// fee_paid = 34, receipt = 67.32 => let's use 34 and 67
const INST_FEE_PAID = 34;
const INST_RECEIPT = 67;
const INST_GROUP = INST_FEE_PAID + INST_RECEIPT; // 101
// Total: 88 + 38 + 101*4 + 28 = 88+38+404+28 = 558... close
// Use sign=29 => 88+38+404+29 = 559 ✓

const COLS = {
  FEE_DETAILS: 88,
  FEE_FIXED: 38,
  INST_FEE_PAID: INST_FEE_PAID,
  INST_RECEIPT: INST_RECEIPT,
  SIGN: 29,
};

// Row heights
const ROW_H = {
  HEADER_MAIN: 22,
  HEADER_SUB: 13,
  DATA_ROW: 16,
  SECTION_HEADER: 12,
  DEPOSIT_ROW: 15,
  SUMMARY_ROW: 14,
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
  const fontSize = opts.fontSize || 6;
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

  const padding = 2;
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

function drawPageHeader(ctx: DrawContext, student: LedgerData['student'], pageNo: number): void {
  const { doc } = ctx;
  const y = MARGIN_TOP;

  // Outer border for header area
  const headerHeight = 58;
  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, headerHeight, COLOR_WHITE, COLOR_BORDER);

  // Left logo/institution area
  doc.save();
  doc.rect(MARGIN_LEFT, y, 110, headerHeight).stroke(COLOR_BORDER);

  doc.font('Helvetica-Bold').fontSize(5.5).fillColor(COLOR_BLACK);
  doc.text('AURORA HIGHER EDUCATION', MARGIN_LEFT + 2, y + 3, { width: 106, align: 'center' });
  doc.text('AND RESEARCH ACADEMY', MARGIN_LEFT + 2, y + 10, { width: 106, align: 'center' });
  doc.font('Helvetica').fontSize(4).fillColor(COLOR_BLACK);
  doc.text('(Sponsored by Pragathi Educational Society, Regd. Est. 1991)', MARGIN_LEFT + 2, y + 17, { width: 106, align: 'center' });
  doc.text('Autonomous Institution - NAAC Accredited', MARGIN_LEFT + 2, y + 22, { width: 106, align: 'center' });
  doc.text('(ETML, UGC) EAPCET Code - 1044', MARGIN_LEFT + 2, y + 27, { width: 106, align: 'center' });
  doc.restore();

  // Title - Center
  doc.save();
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_BLACK);
  doc.text('FEE LEDGER', MARGIN_LEFT + 110, y + 18, {
    width: CONTENT_WIDTH - 220,
    align: 'center'
  });
  doc.restore();

  // Right logo area
  doc.save();
  doc.rect(MARGIN_LEFT + CONTENT_WIDTH - 110, y, 110, headerHeight).stroke(COLOR_BORDER);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_BLACK);
  doc.text('AURORA', MARGIN_LEFT + CONTENT_WIDTH - 108, y + 20, { width: 106, align: 'center' });
  doc.restore();

  ctx.y = y + headerHeight;
}

function drawStudentInfo(ctx: DrawContext, student: LedgerData['student']): void {
  const { doc } = ctx;
  let y = ctx.y;

  const rowH = 14;
  const col1W = 70;   // label
  const col2W = 140;  // value
  const col3W = 70;   // label
  const col4W = CONTENT_WIDTH - col1W - col2W - col3W;  // value

  const rows = [
    ['Student Name', student.student_name || '', 'Registration No.', student.registration_no || ''],
    ["Father's Name", student.father_name || '', 'Campus', student.campus || ''],
    ['School', student.school || '', 'Programme', student.program || ''],
    ['Date of Joining', formatDisplayDate(student.date_of_joining), 'Date of Leaving', formatDisplayDate(student.date_of_leaving)],
  ];

  // Outer border
  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, rowH * rows.length, COLOR_WHITE, COLOR_BORDER);

  for (let i = 0; i < rows.length; i++) {
    const [l1, v1, l2, v2] = rows[i];
    const rowY = y + i * rowH;

    // Draw horizontal line
    if (i > 0) {
      doc.moveTo(MARGIN_LEFT, rowY).lineTo(MARGIN_LEFT + CONTENT_WIDTH, rowY).stroke(COLOR_BORDER);
    }

    let x = MARGIN_LEFT;
    // Label 1
    drawCell(doc, l1, x, rowY, col1W, rowH, { fontSize: 6, font: 'Helvetica-Bold', align: 'left', bg: COLOR_HEADER_BG, valign: 'center' });
    x += col1W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    // Value 1
    drawCell(doc, v1, x, rowY, col2W, rowH, { fontSize: 6, align: 'left', border: false, valign: 'center' });
    x += col2W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    // Label 2
    drawCell(doc, l2, x, rowY, col3W, rowH, { fontSize: 6, font: 'Helvetica-Bold', align: 'left', bg: COLOR_HEADER_BG, valign: 'center' });
    x += col3W;
    doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke(COLOR_BORDER);
    // Value 2
    drawCell(doc, v2, x, rowY, col4W, rowH, { fontSize: 6, align: 'left', border: false, valign: 'center' });
  }

  ctx.y = y + rowH * rows.length;
}

function drawDepositSection(ctx: DrawContext, deposits: LedgerData['deposits']): void {
  const { doc } = ctx;
  let y = ctx.y + 3;

  const halfW = CONTENT_WIDTH / 2;
  const depColW = 48;
  const amtColW = 46;
  const rcptColW = halfW - depColW - amtColW - 26;
  const signColW = 26;

  const headerH = 12;
  const rowH = 14;

  // Draw header for both halves
  for (let half = 0; half < 2; half++) {
    const baseX = MARGIN_LEFT + half * halfW;
    let x = baseX;

    drawCell(doc, 'Deposits', x, y, depColW, headerH, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += depColW;
    drawCell(doc, 'Amount', x, y, amtColW, headerH, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += amtColW;
    drawCell(doc, 'Receipt No. & Date', x, y, rcptColW, headerH, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
    x += rcptColW;
    drawCell(doc, 'Sign.', x, y, signColW, headerH, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_SECTION_BG, align: 'center' });
  }

  // Draw deposit rows (up to 2 deposits, one per half)
  const numRows = Math.max(2, deposits.length);
  const displayDeposits = [...deposits];
  while (displayDeposits.length < numRows) displayDeposits.push({ amount: 0, receipt_no: '', deposit_date: '' });

  for (let r = 0; r < Math.ceil(numRows / 2) + 1; r++) {
    const ry = y + headerH + r * rowH;
    if (ry > PAGE_HEIGHT - 60) break;

    for (let half = 0; half < 2; half++) {
      const idx = r * 2 + half; // actually show one row per half side by side
      // Actually deposit section shows ONE shared row with two halves for two separate deposit entries
      const dep = displayDeposits[half] || { amount: 0, receipt_no: '', deposit_date: '' };
      const baseX = MARGIN_LEFT + half * halfW;
      let x = baseX;
      if (r === 0) { // just one data row
        drawCell(doc, 'Deposit', x, ry, depColW, rowH, { fontSize: 5.5, align: 'center', border: true });
        x += depColW;
        drawCell(doc, dep.amount ? formatCurrency(dep.amount) : '', x, ry, amtColW, rowH, { fontSize: 5.5, align: 'center', border: true });
        x += amtColW;
        const rcpt = dep.receipt_no || dep.deposit_date ? `${dep.receipt_no || ''}${dep.deposit_date ? ' / ' + formatDisplayDate(dep.deposit_date) : ''}` : '';
        drawCell(doc, rcpt, x, ry, rcptColW, rowH, { fontSize: 5, align: 'center', border: true });
        x += rcptColW;
        drawCell(doc, '', x, ry, signColW, rowH, { fontSize: 5.5, align: 'center', border: true });
      }
    }
    if (r === 0) { ctx.y = ry + rowH; break; }
  }
  ctx.y += 3;
}

function drawYearSection(ctx: DrawContext, yearSection: LedgerData['year_sections'][0]): number {
  const { doc } = ctx;

  const installments = ['I', 'II', 'III', 'IV'];
  const headerH1 = 11; // year header
  const headerH2 = 11; // column header row 1 (Instalment I, II...)
  const headerH3 = 10; // column header row 2 (Fee Paid, Receipt No...)
  const dataRowH = 14;

  const totalH = headerH1 + headerH2 + headerH3 + yearSection.fee_rows.length * dataRowH;

  let y = ctx.y;

  // Row 1: Year header
  drawCell(doc, yearSection.study_year, MARGIN_LEFT, y, CONTENT_WIDTH, headerH1, {
    fontSize: 7, font: 'Helvetica-Bold', align: 'left', bg: COLOR_SECTION_BG
  });
  y += headerH1;

  // Row 2: Column group headers
  let x = MARGIN_LEFT;
  drawCell(doc, 'Fee Details', x, y, COLS.FEE_DETAILS, headerH2, { fontSize: 6, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
  x += COLS.FEE_DETAILS;
  drawCell(doc, 'Fee Fixed', x, y, COLS.FEE_FIXED, headerH2, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
  x += COLS.FEE_FIXED;

  for (const inst of installments) {
    drawCell(doc, `Instalment ${inst}`, x, y, COLS.INST_FEE_PAID + COLS.INST_RECEIPT, headerH2, {
      fontSize: 6, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center'
    });
    x += COLS.INST_FEE_PAID + COLS.INST_RECEIPT;
  }
  drawCell(doc, 'Sign.', x, y, COLS.SIGN, headerH2 + headerH3, { fontSize: 5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
  y += headerH2;

  // Row 3: Sub-column headers
  x = MARGIN_LEFT;
  drawCell(doc, 'Fee Details', x, y, COLS.FEE_DETAILS, headerH3, { fontSize: 5.5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
  x += COLS.FEE_DETAILS;
  drawCell(doc, '', x, y, COLS.FEE_FIXED, headerH3, { fontSize: 5.5, bg: COLOR_HEADER_BG, align: 'center' });
  x += COLS.FEE_FIXED;

  for (const _inst of installments) {
    drawCell(doc, 'Fee Paid', x, y, COLS.INST_FEE_PAID, headerH3, { fontSize: 5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
    x += COLS.INST_FEE_PAID;
    drawCell(doc, 'Receipt No. & Date', x, y, COLS.INST_RECEIPT, headerH3, { fontSize: 4.5, font: 'Helvetica-Bold', bg: COLOR_HEADER_BG, align: 'center' });
    x += COLS.INST_RECEIPT;
  }
  // Sign column was merged above, draw border only
  doc.moveTo(MARGIN_LEFT + CONTENT_WIDTH, y).lineTo(MARGIN_LEFT + CONTENT_WIDTH, y + headerH3).stroke(COLOR_BORDER);
  y += headerH3;

  // Sub-header for Asst.Acct. label
  // Draw vertical divider at sign column position
  const signX = MARGIN_LEFT + COLS.FEE_DETAILS + COLS.FEE_FIXED + (COLS.INST_FEE_PAID + COLS.INST_RECEIPT) * 4;
  doc.moveTo(signX, y - headerH3).lineTo(signX, y).stroke(COLOR_BORDER);

  // Data rows
  for (const feeRow of yearSection.fee_rows) {
    x = MARGIN_LEFT;
    const ry = y;

    drawCell(doc, feeRow.fee_type, x, ry, COLS.FEE_DETAILS, dataRowH, { fontSize: 6, align: 'left', valign: 'center' });
    x += COLS.FEE_DETAILS;

    // Fee Fixed = sum of all installment fee amounts
    const totalFixed = Object.values(feeRow.installments).reduce((s, inst) => s + inst.fee_fixed, 0);
    drawCell(doc, totalFixed ? formatCurrency(totalFixed) : '', x, ry, COLS.FEE_FIXED, dataRowH, { fontSize: 5.5, align: 'right', valign: 'center' });
    x += COLS.FEE_FIXED;

    for (const inst of installments) {
      const instData = feeRow.installments[inst] || { fee_fixed: 0, payments: [], total_paid: 0, receipt_display: '' };
      drawCell(doc, instData.total_paid ? formatCurrency(instData.total_paid) : '', x, ry, COLS.INST_FEE_PAID, dataRowH, { fontSize: 5.5, align: 'right', valign: 'center' });
      x += COLS.INST_FEE_PAID;
      drawCell(doc, instData.receipt_display || '', x, ry, COLS.INST_RECEIPT, dataRowH, { fontSize: 4.5, align: 'center', valign: 'center' });
      x += COLS.INST_RECEIPT;
    }

    drawCell(doc, '', x, ry, COLS.SIGN, dataRowH, { fontSize: 5, align: 'center', valign: 'center' });

    y += dataRowH;
  }

  ctx.y = y + 2;
  return totalH;
}

function drawSummarySection(ctx: DrawContext, summary: LedgerData['summary'], deposits: LedgerData['deposits']): void {
  const { doc } = ctx;
  let y = ctx.y + 4;

  const totalDeposit = deposits.reduce((s, d) => s + d.amount, 0);

  // "Annexed" section
  const outerH = 60;
  const leftW = 16;   // "Annexed" rotated label
  const midW = (CONTENT_WIDTH - leftW) / 2;
  const rightW = CONTENT_WIDTH - leftW - midW;

  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, outerH, COLOR_WHITE, COLOR_BORDER);

  // Annexed label (rotated)
  doc.save();
  doc.translate(MARGIN_LEFT + leftW / 2, y + outerH / 2);
  doc.rotate(-90);
  doc.font('Helvetica-Bold').fontSize(5.5).fillColor(COLOR_BLACK);
  doc.text('Annexed', -20, -3, { width: 40, align: 'center' });
  doc.restore();

  doc.moveTo(MARGIN_LEFT + leftW, y).lineTo(MARGIN_LEFT + leftW, y + outerH).stroke(COLOR_BORDER);

  // Left mid section
  const rowH = 12;
  const labelColW = 80;
  const valueColW = midW - labelColW;
  const leftRows = [
    ['Deposit', formatCurrency(totalDeposit)],
    ['Refund / Adjustment', formatCurrency(summary.total_refund_adjustment)],
    ['Due', formatCurrency(summary.due)],
  ];
  for (let i = 0; i < leftRows.length; i++) {
    const [label, value] = leftRows[i];
    const ry = y + i * rowH;
    if (i > 0) doc.moveTo(MARGIN_LEFT + leftW, ry).lineTo(MARGIN_LEFT + leftW + midW, ry).stroke(COLOR_BORDER);
    drawCell(doc, label, MARGIN_LEFT + leftW, ry, labelColW, rowH, { fontSize: 6, font: 'Helvetica-Bold', align: 'left', valign: 'center', border: false });
    doc.moveTo(MARGIN_LEFT + leftW + labelColW, ry).lineTo(MARGIN_LEFT + leftW + labelColW, ry + rowH).stroke(COLOR_BORDER);
    drawCell(doc, value, MARGIN_LEFT + leftW + labelColW, ry, valueColW, rowH, { fontSize: 6, align: 'right', valign: 'center', border: false });
  }

  doc.moveTo(MARGIN_LEFT + leftW + midW, y).lineTo(MARGIN_LEFT + leftW + midW, y + outerH).stroke(COLOR_BORDER);

  // Right section
  const rightLabelW = 80;
  const rightValueW = 55;
  const rightRemarksW = rightW - rightLabelW - rightValueW;
  const rightRows = [
    ['Total Fee', formatCurrency(summary.total_fee), ''],
    ['Amount Paid', formatCurrency(summary.total_paid), ''],
    ['Due', formatCurrency(summary.due), ''],
  ];

  for (let i = 0; i < rightRows.length; i++) {
    const [label, value] = rightRows[i];
    const ry = y + i * rowH;
    const baseX = MARGIN_LEFT + leftW + midW;
    if (i > 0) doc.moveTo(baseX, ry).lineTo(baseX + rightW, ry).stroke(COLOR_BORDER);
    drawCell(doc, label, baseX, ry, rightLabelW, rowH, { fontSize: 6, font: 'Helvetica-Bold', align: 'left', valign: 'center', border: false });
    doc.moveTo(baseX + rightLabelW, ry).lineTo(baseX + rightLabelW, ry + rowH).stroke(COLOR_BORDER);
    drawCell(doc, value, baseX + rightLabelW, ry, rightValueW, rowH, { fontSize: 6, align: 'right', valign: 'center', border: false });
    doc.moveTo(baseX + rightLabelW + rightValueW, ry).lineTo(baseX + rightLabelW + rightValueW, ry + rowH).stroke(COLOR_BORDER);
    if (i === 0) {
      drawCell(doc, 'Remarks', baseX + rightLabelW + rightValueW, ry, rightRemarksW, rowH, {
        fontSize: 5.5, font: 'Helvetica-Bold', align: 'center', valign: 'center', border: false
      });
    }
  }

  ctx.y = y + outerH;
}

function drawSignatureSection(ctx: DrawContext): void {
  const { doc } = ctx;
  const y = ctx.y + 12;
  const sigW = CONTENT_WIDTH / 3;

  const sigs = ['Assistant', 'Accountant', 'Finance Officer'];
  for (let i = 0; i < 3; i++) {
    const x = MARGIN_LEFT + i * sigW;
    doc.moveTo(x + 10, y).lineTo(x + sigW - 10, y).stroke(COLOR_BORDER);
    doc.font('Helvetica').fontSize(6).fillColor(COLOR_BLACK);
    doc.text(sigs[i], x, y + 3, { width: sigW, align: 'center' });
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

export function generateFeeLedgerPDF(ledgerData: LedgerData): Promise<Buffer> {
  const chunks: Buffer[] = [];

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN_TOP, bottom: 20, left: MARGIN_LEFT, right: MARGIN_RIGHT },
    compress: false,
    autoFirstPage: true,
    bufferPages: true,
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const ctx: DrawContext = { doc, y: MARGIN_TOP, pageNo: 1 };

  // ── PAGE 1 ──
  drawPageHeader(ctx, ledgerData.student, 1);
  ctx.y += 2;
  drawStudentInfo(ctx, ledgerData.student);
  ctx.y += 2;
  drawDepositSection(ctx, ledgerData.deposits);
  ctx.y += 2;

  // First two year sections on page 1 (Freshman + Sophomore)
  const page1Years = ledgerData.year_sections.filter(ys =>
    ys.study_year === 'Freshman Year' || ys.study_year === 'Sophomore Year'
  );
  const page2Years = ledgerData.year_sections.filter(ys =>
    ys.study_year !== 'Freshman Year' && ys.study_year !== 'Sophomore Year'
  );

  for (const ys of page1Years) {
    drawYearSection(ctx, ys);
    ctx.y += 2;
  }

  // ── PAGE 2 ──
  doc.addPage({ size: 'A4', margins: { top: MARGIN_TOP, bottom: 20, left: MARGIN_LEFT, right: MARGIN_RIGHT } });
  ctx.y = MARGIN_TOP;
  ctx.pageNo = 2;

  // Smaller header on page 2
  drawMiniHeader(ctx, ledgerData.student);
  ctx.y += 2;

  for (const ys of page2Years) {
    drawYearSection(ctx, ys);
    ctx.y += 2;
  }

  // If no page 2 years, still show summary
  if (page2Years.length === 0 && page1Years.length > 0) {
    // summary goes on page 1
    // (already handled below by checking ctx.pageNo)
  }

  drawSummarySection(ctx, ledgerData.summary, ledgerData.deposits);
  drawSignatureSection(ctx);

  doc.flushPages();
  doc.end();

  return done;
}

function drawMiniHeader(ctx: DrawContext, student: LedgerData['student']): void {
  const { doc } = ctx;
  const y = ctx.y;
  const h = 18;
  drawRect(doc, MARGIN_LEFT, y, CONTENT_WIDTH, h, COLOR_HEADER_BG, COLOR_BORDER);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_BLACK);
  doc.text('FEE LEDGER (Continued)', MARGIN_LEFT + 4, y + 4, { width: CONTENT_WIDTH - 8, align: 'left' });
  doc.font('Helvetica').fontSize(6);
  doc.text(`Reg. No: ${student.registration_no}  |  Name: ${student.student_name}`, MARGIN_LEFT + 4, y + 11, {
    width: CONTENT_WIDTH - 8, align: 'left'
  });
  ctx.y = y + h;
}

export function generateBulkPDF(ledgers: LedgerData[]): Promise<Buffer> {
  const chunks: Buffer[] = [];

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN_TOP, bottom: 20, left: MARGIN_LEFT, right: MARGIN_RIGHT },
    compress: false,
    autoFirstPage: false,
    bufferPages: true,
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let i = 0; i < ledgers.length; i++) {
    const ledgerData = ledgers[i];

    // Page 1 of this ledger
    doc.addPage({ size: 'A4', margins: { top: MARGIN_TOP, bottom: 20, left: MARGIN_LEFT, right: MARGIN_RIGHT } });
    const ctx: DrawContext = { doc, y: MARGIN_TOP, pageNo: 1 };

    drawPageHeader(ctx, ledgerData.student, 1);
    ctx.y += 2;
    drawStudentInfo(ctx, ledgerData.student);
    ctx.y += 2;
    drawDepositSection(ctx, ledgerData.deposits);
    ctx.y += 2;

    const page1Years = ledgerData.year_sections.filter(ys =>
      ys.study_year === 'Freshman Year' || ys.study_year === 'Sophomore Year'
    );
    const page2Years = ledgerData.year_sections.filter(ys =>
      ys.study_year !== 'Freshman Year' && ys.study_year !== 'Sophomore Year'
    );

    for (const ys of page1Years) {
      drawYearSection(ctx, ys);
      ctx.y += 2;
    }

    // Page 2 of this ledger
    doc.addPage({ size: 'A4', margins: { top: MARGIN_TOP, bottom: 20, left: MARGIN_LEFT, right: MARGIN_RIGHT } });
    ctx.y = MARGIN_TOP;
    ctx.pageNo = 2;

    drawMiniHeader(ctx, ledgerData.student);
    ctx.y += 2;

    for (const ys of page2Years) {
      drawYearSection(ctx, ys);
      ctx.y += 2;
    }

    drawSummarySection(ctx, ledgerData.summary, ledgerData.deposits);
    drawSignatureSection(ctx);
  }

  doc.flushPages();
  doc.end();

  return done;
}
