import * as XLSX from 'xlsx';
import { getDb } from '../database/db';

export interface ImportResult {
  importId: number;
  totalStudents: number;
  totalFeeRecords: number;
  totalTransactions: number;
  validRecords: number;
  errorRecords: number;
  duplicateRecords: number;
  unmatchedRecords: number;
  errors: ImportError[];
}

export interface ImportError {
  sheet: string;
  row: number;
  registration_no?: string;
  field?: string;
  errorType: string;
  message: string;
  rawData?: string;
}

const VALID_STUDY_YEARS = new Set(['Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II']);
const VALID_INSTALLMENTS = new Set(['I', 'II', 'III', 'IV']);

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cleanNum(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function excelDateToString(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return String(val);
    const dd = String(d.d).padStart(2, '0');
    const mm = String(d.m).padStart(2, '0');
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  const parts = s.split(/[-\/]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p3.length === 4) {
      return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
    return s;
  }
  return s;
}

export async function processExcelImport(filePath: string, importedBy: number): Promise<ImportResult> {
  const db = getDb();
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });

  const errors: ImportError[] = [];
  let totalStudents = 0, totalFeeRecords = 0, totalTransactions = 0;
  let validRecords = 0, errorRecords = 0, duplicateRecords = 0, unmatchedRecords = 0;

  // Create import record
  const importRes = await db.run(
    `INSERT INTO imports (file_name, import_type, status, imported_by) VALUES (?, 'full', 'processing', ?)`,
    filePath.split(/[/\\]/).pop() || 'unknown', importedBy
  );
  const importId = importRes.lastInsertRowid;

  // ── SHEET 1: Students ──
  const studentSheet = workbook.Sheets['Students'] || workbook.Sheets['students'];
  if (studentSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(studentSheet, { defval: '' });
    totalStudents = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const regNo = cleanStr(row['Registration No'] || row['registration_no'] || row['Reg No'] || row['RegNo']);
      const name = cleanStr(row['Student Name'] || row['student_name'] || row['Name']);

      if (!regNo) {
        errors.push({ sheet: 'Students', row: i + 2, errorType: 'MISSING_FIELD', message: 'Registration No is required' });
        errorRecords++; continue;
      }
      if (!name) {
        errors.push({ sheet: 'Students', row: i + 2, registration_no: regNo, errorType: 'MISSING_FIELD', message: 'Student Name is required' });
        errorRecords++; continue;
      }

      const fatherName = cleanStr(row["Father's Name"] || row['father_name'] || row['Father Name']);
      const school = cleanStr(row['School'] || row['school']);
      const department = cleanStr(row['Department'] || row['department']);
      const program = cleanStr(row['Program'] || row['programme'] || row['Programme'] || row['program']);
      const campus = cleanStr(row['Campus'] || row['campus']);
      const doj = excelDateToString(row['Date of Joining'] || row['date_of_joining']);
      const dol = excelDateToString(row['Date of Leaving'] || row['date_of_leaving']);

      const existing = await db.get('SELECT id FROM students WHERE registration_no = ?', regNo);
      if (existing) {
        await db.run(
          `UPDATE students SET student_name=?, father_name=?, school=?, department=?, program=?, campus=?, date_of_joining=?, date_of_leaving=?, updated_at=datetime('now') WHERE registration_no=?`,
          name, fatherName, school, department, program, campus, doj, dol, regNo
        );
        duplicateRecords++;
      } else {
        try {
          await db.run(
            `INSERT INTO students (registration_no, student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            regNo, name, fatherName, school, department, program, campus, doj, dol
          );
        } catch (_e) { /* ignore duplicate key */ }
      }
      validRecords++;
    }
  }

  // ── SHEET 2: Fee_Structure ──
  const feeSheet = workbook.Sheets['Fee_Structure'] || workbook.Sheets['Fee Structure'] || workbook.Sheets['fee_structure'];
  if (feeSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(feeSheet, { defval: '' });
    totalFeeRecords = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const regNo = cleanStr(row['Registration No'] || row['registration_no']);
      const academicYear = cleanStr(row['Academic Year'] || row['academic_year']);
      const studyYear = cleanStr(row['Study Year'] || row['study_year']);
      const feeType = cleanStr(row['Fee Type'] || row['fee_type']);
      const installment = cleanStr(row['Installment'] || row['installment']);
      const feeAmount = cleanNum(row['Fee Amount'] || row['fee_amount']);

      if (!regNo || !academicYear || !studyYear || !feeType || !installment || feeAmount === null) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'MISSING_FIELD', message: 'All fields required' });
        errorRecords++; continue;
      }
      if (!VALID_STUDY_YEARS.has(studyYear)) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: `Invalid study year: ${studyYear}` });
        errorRecords++; continue;
      }
      if (!VALID_INSTALLMENTS.has(installment)) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: `Invalid installment: ${installment}` });
        errorRecords++; continue;
      }
      if (feeAmount < 0) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: 'Fee amount cannot be negative' });
        errorRecords++; continue;
      }

      const student = await db.get('SELECT id FROM students WHERE registration_no = ?', regNo);
      if (!student) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'UNMATCHED', message: `Student not found: ${regNo}` });
        unmatchedRecords++; errorRecords++; continue;
      }

      try {
        await db.run(
          `INSERT INTO fee_structure_items (registration_no, academic_year, study_year, fee_type, installment, fee_amount, import_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(registration_no, academic_year, study_year, fee_type, installment) DO UPDATE SET fee_amount = excluded.fee_amount`,
          regNo, academicYear, studyYear, feeType, installment, feeAmount, importId
        );
        validRecords++;
      } catch (err: any) {
        errors.push({ sheet: 'Fee_Structure', row: i + 2, registration_no: regNo, errorType: 'DB_ERROR', message: err.message });
        errorRecords++;
      }
    }
  }

  // ── SHEET 3: Transactions ──
  const txnSheet = workbook.Sheets['Transactions'] || workbook.Sheets['transactions'];
  if (txnSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(txnSheet, { defval: '' });
    totalTransactions = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const regNo = cleanStr(row['Registration No'] || row['registration_no']);
      const paymentDate = excelDateToString(row['Payment Date'] || row['payment_date']);
      const academicYear = cleanStr(row['Academic Year'] || row['academic_year']);
      const studyYear = cleanStr(row['Study Year'] || row['study_year']);
      const feeType = cleanStr(row['Fee Type'] || row['fee_type']);
      const installment = cleanStr(row['Installment'] || row['installment']);
      const amountPaid = cleanNum(row['Amount Paid'] || row['amount_paid']);
      const receiptNo = cleanStr(row['Receipt No'] || row['receipt_no']);
      const easyBuzzId = cleanStr(row['EasyBuzz ID'] || row['easybuzz_id']);
      const paymentMode = cleanStr(row['Payment Mode'] || row['payment_mode']);

      if (!regNo || !paymentDate || !academicYear || !studyYear || !feeType || !installment || amountPaid === null) {
        errors.push({ sheet: 'Transactions', row: i + 2, registration_no: regNo, errorType: 'MISSING_FIELD', message: 'Required fields missing' });
        errorRecords++; continue;
      }
      if (amountPaid <= 0) {
        errors.push({ sheet: 'Transactions', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: 'Amount must be positive' });
        errorRecords++; continue;
      }
      if (!VALID_STUDY_YEARS.has(studyYear)) {
        errors.push({ sheet: 'Transactions', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: `Invalid study year: ${studyYear}` });
        errorRecords++; continue;
      }
      if (!VALID_INSTALLMENTS.has(installment)) {
        errors.push({ sheet: 'Transactions', row: i + 2, registration_no: regNo, errorType: 'INVALID_VALUE', message: `Invalid installment: ${installment}` });
        errorRecords++; continue;
      }

      const student = await db.get('SELECT id FROM students WHERE registration_no = ?', regNo);
      if (!student) {
        errors.push({ sheet: 'Transactions', row: i + 2, registration_no: regNo, errorType: 'UNMATCHED', message: `Student not found: ${regNo}` });
        unmatchedRecords++; errorRecords++; continue;
      }

      await db.run(
        `INSERT INTO transactions (registration_no, payment_date, academic_year, study_year, fee_type, installment, amount_paid, receipt_no, easybuzz_id, payment_mode, import_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        regNo, paymentDate, academicYear, studyYear, feeType, installment, amountPaid, receiptNo, easyBuzzId, paymentMode, importId
      );
      validRecords++;
    }
  }

  // Save import errors
  for (const err of errors) {
    await db.run(
      `INSERT INTO import_errors (import_id, sheet_name, row_number, registration_no, error_type, error_message) VALUES (?, ?, ?, ?, ?, ?)`,
      importId, err.sheet, err.row, err.registration_no || null, err.errorType, err.message
    );
  }

  // Update import record
  await db.run(
    `UPDATE imports SET total_students=?, total_fee_records=?, total_transactions=?, valid_records=?, error_records=?, duplicate_records=?, unmatched_records=?, status='completed', completed_at=datetime('now') WHERE id=?`,
    totalStudents, totalFeeRecords, totalTransactions, validRecords, errorRecords, duplicateRecords, unmatchedRecords, importId
  );

  return { importId, totalStudents, totalFeeRecords, totalTransactions, validRecords, errorRecords, duplicateRecords, unmatchedRecords, errors };
}

export function generateExcelTemplate(blank: boolean): Buffer {
  const wb = XLSX.utils.book_new();

  const studentsHeaders = [
    'Registration No', 'Student Name', "Father's Name", 'School', 'Department', 'Program', 'Campus', 'Date of Joining', 'Date of Leaving'
  ];
  const studentsData = blank ? [studentsHeaders] : [
    studentsHeaders,
    ['24A91A0501', 'Rahul Kumar', 'Suresh Kumar', 'Engineering', 'CSE', 'B.Tech CSE', 'Uppal', '01-07-2024', ''],
    ['24A91A0502', 'Priya Sharma', 'Amit Sharma', 'Engineering', 'ECE', 'B.Tech ECE', 'Uppal', '01-07-2024', ''],
  ];
  const wsStudents = XLSX.utils.aoa_to_sheet(studentsData);
  wsStudents['!cols'] = studentsHeaders.map((_h, i) => ({ wch: i === 0 ? 15 : i === 1 || i === 2 ? 20 : 15 }));
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

  const feeHeaders = ['Registration No', 'Academic Year', 'Study Year', 'Fee Type', 'Installment', 'Fee Amount'];
  const feeData = blank ? [feeHeaders] : [
    feeHeaders,
    ['24A91A0501', '2024-25', 'Freshman Year', 'Application Fee', 'I', 2000],
    ['24A91A0501', '2024-25', 'Freshman Year', 'Registration Fee', 'I', 1000],
    ['24A91A0501', '2024-25', 'Freshman Year', 'Tuition Fee', 'I', 50000],
    ['24A91A0501', '2024-25', 'Freshman Year', 'Tuition Fee', 'II', 50000],
    ['24A91A0501', '2024-25', 'Freshman Year', 'Special Fee', 'I', 5000],
  ];
  const wsFee = XLSX.utils.aoa_to_sheet(feeData);
  wsFee['!cols'] = feeHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsFee, 'Fee_Structure');

  const txnHeaders = ['Registration No', 'Payment Date', 'Academic Year', 'Study Year', 'Fee Type', 'Installment', 'Amount Paid', 'Receipt No', 'EasyBuzz ID', 'Payment Mode'];
  const txnData = blank ? [txnHeaders] : [
    txnHeaders,
    ['24A91A0501', '10-07-2024', '2024-25', 'Freshman Year', 'Application Fee', 'I', 2000, 'REC00101', 'EB001', 'Online'],
    ['24A91A0501', '10-07-2024', '2024-25', 'Freshman Year', 'Tuition Fee', 'I', 50000, 'REC00103', 'EB003', 'Online'],
  ];
  const wsTxn = XLSX.utils.aoa_to_sheet(txnData);
  wsTxn['!cols'] = txnHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsTxn, 'Transactions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function generateErrorReport(importId: number): Promise<Buffer> {
  const db = getDb();
  const errors = await db.all('SELECT * FROM import_errors WHERE import_id = ?', importId);

  const wb = XLSX.utils.book_new();
  const headers = ['Sheet', 'Row', 'Registration No', 'Error Type', 'Error Message'];
  const data = [headers, ...errors.map((e: any) => [e.sheet_name, e.row_number, e.registration_no, e.error_type, e.error_message])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Import Errors');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
