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
  is_special_header?: boolean;
  is_special_sub?: boolean;
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

const SPECIAL_FEE_LABEL = 'Special Fee';

// Any fee type other than these gets bucketed under "Special Fee" as a sub-row
const KNOWN_FEE_TYPES_FRESHMAN = ['Application Fee', 'Registration Fee', 'Tuition Fee'];
const KNOWN_FEE_TYPES_OTHER = ['Tuition Fee'];

function getKnownFeeTypes(studyYear: string): string[] {
  return studyYear === 'Freshman Year' ? KNOWN_FEE_TYPES_FRESHMAN : KNOWN_FEE_TYPES_OTHER;
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

  // Builds installment totals for a row by summing across one or more raw fee types
  // (a single known type, or all the sub-types folded into the "Special Fee" bucket).
  function buildInstallments(studyYear: string, feeTypes: string[]): FeeRowData['installments'] {
    const installmentsData: FeeRowData['installments'] = {};
    for (const inst of ['I', 'II', 'III', 'IV']) {
      let feeFix = 0;
      let payments: any[] = [];
      for (const ft of feeTypes) {
        feeFix += feeMap[studyYear]?.[ft]?.[inst] ?? 0;
        payments = payments.concat(txnMap[studyYear]?.[ft]?.[inst] ?? []);
      }
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
    return installmentsData;
  }

  const yearSections: YearSection[] = [];
  for (const studyYear of STUDY_YEAR_ORDER) {
    if (!studyYearsInData.has(studyYear)) continue;
    const knownFeeTypes = getKnownFeeTypes(studyYear);
    const feeTypesSet = new Set<string>();
    if (feeMap[studyYear]) Object.keys(feeMap[studyYear]).forEach(ft => feeTypesSet.add(ft));
    if (txnMap[studyYear]) Object.keys(txnMap[studyYear]).forEach(ft => feeTypesSet.add(ft));

    // Anything not in the known top-level list (Application/Registration/Tuition) is a
    // "Special Fee" sub-type — it's rolled up under one Special Fee header row, with the
    // original fee type name kept as a sub-row underneath, instead of its own top-level row.
    const knownTypesPresent = [...feeTypesSet]
      .filter(ft => knownFeeTypes.includes(ft))
      .sort((a, b) => knownFeeTypes.indexOf(a) - knownFeeTypes.indexOf(b));
    const specialTypesPresent = [...feeTypesSet]
      .filter(ft => !knownFeeTypes.includes(ft))
      .sort((a, b) => a.localeCompare(b));

    const feeRows: FeeRowData[] = [];
    for (const feeType of knownTypesPresent) {
      feeRows.push({ fee_type: feeType, installments: buildInstallments(studyYear, [feeType]) });
    }
    if (specialTypesPresent.length > 0) {
      feeRows.push({
        fee_type: SPECIAL_FEE_LABEL,
        installments: buildInstallments(studyYear, specialTypesPresent),
        is_special_header: true
      });
      for (const feeType of specialTypesPresent) {
        feeRows.push({ fee_type: feeType, installments: buildInstallments(studyYear, [feeType]), is_special_sub: true });
      }
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

