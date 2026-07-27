import { getDb } from '../database/db';

export interface StudentInfo {
  registration_no: string;
  student_name: string;
  father_name: string;
  school: string;
  department: string;
  program: string;
  campus: string;
  date_of_joining: string;
  date_of_leaving: string;
}

export interface InstallmentData {
  fee_fixed: number;
  payments: { amount: number; receipt_no: string; payment_date: string }[];
  total_paid: number;
  receipt_display: string;
}

export interface FeeRowData {
  fee_type: string;
  installments: { [key: string]: InstallmentData };
}

export interface YearSection {
  study_year: string;
  fee_rows: FeeRowData[];
}

export interface DepositEntry {
  amount: number;
  receipt_no: string;
  deposit_date: string;
}

export interface LedgerSummary {
  total_fee: number;
  total_paid: number;
  total_deposit: number;
  total_refund_adjustment: number;
  due: number;
  remarks: string;
}

export interface LedgerData {
  student: StudentInfo;
  deposits: DepositEntry[];
  year_sections: YearSection[];
  summary: LedgerSummary;
}

const STUDY_YEAR_ORDER = [
  'Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II'
];

const FEE_TYPE_ORDER_FRESHMAN = ['Application Fee', 'Registration Fee', 'Tuition Fee', 'Special Fee'];
const FEE_TYPE_ORDER_OTHER = ['Tuition Fee', 'Special Fee'];

function getFeeOrder(studyYear: string): string[] {
  return studyYear === 'Freshman Year' ? FEE_TYPE_ORDER_FRESHMAN : FEE_TYPE_ORDER_OTHER;
}

export async function buildLedgerData(registrationNo: string): Promise<LedgerData> {
  const db = getDb();

  const student = await db.get('SELECT * FROM students WHERE registration_no = ?', registrationNo);
  if (!student) throw new Error(`Student not found: ${registrationNo}`);

  const [feeItems, transactions, depositRows, adjustments] = await Promise.all([
    db.all('SELECT * FROM fee_structure_items WHERE registration_no = ? ORDER BY study_year, fee_type, installment', registrationNo),
    db.all('SELECT * FROM transactions WHERE registration_no = ? AND is_cancelled = 0 ORDER BY payment_date ASC', registrationNo),
    db.all('SELECT * FROM deposits WHERE registration_no = ? ORDER BY created_at', registrationNo),
    db.all('SELECT * FROM adjustments WHERE registration_no = ?', registrationNo),
  ]);

  // Build lookup maps
  const feeMap: Record<string, Record<string, Record<string, number>>> = {};
  for (const item of feeItems) {
    const sy = item.study_year as string;
    const ft = item.fee_type as string;
    const inst = item.installment as string;
    if (!feeMap[sy]) feeMap[sy] = {};
    if (!feeMap[sy][ft]) feeMap[sy][ft] = {};
    feeMap[sy][ft][inst] = item.fee_amount as number;
  }

  const txnMap: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const txn of transactions) {
    const sy = txn.study_year as string;
    const ft = txn.fee_type as string;
    const inst = txn.installment as string;
    if (!txnMap[sy]) txnMap[sy] = {};
    if (!txnMap[sy][ft]) txnMap[sy][ft] = {};
    if (!txnMap[sy][ft][inst]) txnMap[sy][ft][inst] = [];
    txnMap[sy][ft][inst].push(txn);
  }

  const studyYearsInData = new Set<string>();
  for (const item of feeItems) studyYearsInData.add(item.study_year as string);
  for (const txn of transactions) studyYearsInData.add(txn.study_year as string);

  const yearSections: YearSection[] = [];
  for (const studyYear of STUDY_YEAR_ORDER) {
    if (!studyYearsInData.has(studyYear)) continue;
    const feeOrder = getFeeOrder(studyYear);
    const feeTypesSet = new Set<string>();
    if (feeMap[studyYear]) Object.keys(feeMap[studyYear]).forEach(ft => feeTypesSet.add(ft));
    if (txnMap[studyYear]) Object.keys(txnMap[studyYear]).forEach(ft => feeTypesSet.add(ft));

    const allFeeTypes = [...feeTypesSet].sort((a, b) => {
      const ai = feeOrder.indexOf(a), bi = feeOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });

    const feeRows: FeeRowData[] = [];
    for (const feeType of allFeeTypes) {
      const installmentsData: FeeRowData['installments'] = {};
      for (const inst of ['I', 'II', 'III', 'IV']) {
        const feeFix = feeMap[studyYear]?.[feeType]?.[inst] ?? 0;
        const payments = txnMap[studyYear]?.[feeType]?.[inst] ?? [];
        const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_paid as number), 0);
        let receiptDisplay = '';
        if (payments.length > 0) {
          const receiptNos = [...new Set(payments.map((p: any) => p.receipt_no).filter(Boolean))];
          const dates = payments.map((p: any) => p.payment_date as string).sort();
          const lastDate = dates[dates.length - 1];
          receiptDisplay = receiptNos.length > 0
            ? `${receiptNos[0]}${receiptNos.length > 1 ? '+' : ''} / ${formatDate(lastDate)}`
            : formatDate(lastDate);
        }
        installmentsData[inst] = { fee_fixed: feeFix, payments, total_paid: totalPaid, receipt_display: receiptDisplay };
      }
      feeRows.push({ fee_type: feeType, installments: installmentsData });
    }
    yearSections.push({ study_year: studyYear, fee_rows: feeRows });
  }

  const totalFee = feeItems.reduce((s, i) => s + (i.fee_amount as number), 0);
  const totalPaid = transactions.reduce((s: number, t: any) => s + (t.amount_paid as number), 0);
  const totalDeposit = depositRows.reduce((s: number, d: any) => s + (d.amount as number), 0);
  const totalRefundAdj = adjustments.reduce((s: number, a: any) => s + (a.amount as number), 0);
  const due = Math.max(0, totalFee - totalPaid - totalDeposit - totalRefundAdj);

  const deposits: DepositEntry[] = depositRows.map((d: any) => ({
    amount: d.amount as number,
    receipt_no: (d.receipt_no as string) || '',
    deposit_date: (d.deposit_date as string) || ''
  }));

  return {
    student: student as unknown as StudentInfo,
    deposits,
    year_sections: yearSections,
    summary: { total_fee: totalFee, total_paid: totalPaid, total_deposit: totalDeposit, total_refund_adjustment: totalRefundAdj, due, remarks: '' }
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  } catch { return dateStr; }
}

export function formatCurrency(amount: number): string {
  if (!amount) return '';
  return amount.toLocaleString('en-IN');
}

