import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const regNo = req.query.registration_no as string;
  const academicYear = req.query.academic_year as string;
  const studyYear = req.query.study_year as string;

  let where = 'WHERE t.is_cancelled = 0';
  const params: any[] = [];
  if (regNo) { where += ' AND t.registration_no = ?'; params.push(regNo); }
  if (academicYear) { where += ' AND t.academic_year = ?'; params.push(academicYear); }
  if (studyYear) { where += ' AND t.study_year = ?'; params.push(studyYear); }

  const countRow = await db.get(`SELECT COUNT(*) as count FROM transactions t ${where}`, ...params);
  const total = (countRow as any)?.count ?? 0;
  const transactions = await db.all(
    `SELECT t.*, s.student_name FROM transactions t JOIN students s ON t.registration_no = s.registration_no ${where} ORDER BY t.payment_date DESC, t.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );
  res.json({ transactions, total, page, limit, totalPages: Math.ceil(total / limit) });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { registration_no, payment_date, academic_year, study_year, fee_type, installment, amount_paid, receipt_no, easybuzz_id, payment_mode } = req.body;

  if (!registration_no || !payment_date || !academic_year || !study_year || !fee_type || !installment || !amount_paid) {
    res.status(400).json({ error: 'Required fields missing' }); return;
  }
  if (isNaN(amount_paid) || amount_paid <= 0) { res.status(400).json({ error: 'Amount must be positive' }); return; }

  const student = await db.get('SELECT id FROM students WHERE registration_no = ?', registration_no);
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  const result = await db.run(
    `INSERT INTO transactions (registration_no, payment_date, academic_year, study_year, fee_type, installment, amount_paid, receipt_no, easybuzz_id, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    registration_no, payment_date, academic_year, study_year, fee_type, installment, amount_paid, receipt_no, easybuzz_id, payment_mode
  );
  db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'CREATE_TRANSACTION', 'transactions', String(result.lastInsertRowid), JSON.stringify(req.body)).catch(() => {});
  res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', req.params.id);
  if (!txn) { res.status(404).json({ error: 'Transaction not found' }); return; }
  if ((txn as any).is_cancelled) { res.status(400).json({ error: 'Transaction already cancelled' }); return; }

  const { reason } = req.body;
  await db.run(
    `UPDATE transactions SET is_cancelled=1, cancellation_reason=?, cancelled_by=?, cancelled_at=datetime('now') WHERE id=?`,
    reason || 'No reason provided', req.user!.id, req.params.id
  );
  db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, old_value) VALUES (?, ?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'CANCEL_TRANSACTION', 'transactions', req.params.id, JSON.stringify(txn)).catch(() => {});
  res.json({ message: 'Transaction cancelled' });
});

export default router;
