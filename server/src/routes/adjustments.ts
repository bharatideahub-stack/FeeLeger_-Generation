import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const regNo = req.query.registration_no as string;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (regNo) { where += ' AND a.registration_no = ?'; params.push(regNo); }

  const adjustments = await db.all(
    `SELECT a.*, s.student_name FROM adjustments a JOIN students s ON a.registration_no = s.registration_no ${where} ORDER BY a.created_at DESC`,
    ...params
  );
  res.json(adjustments);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { registration_no, academic_year, study_year, fee_type, installment, adjustment_type, amount, reason } = req.body;

  if (!registration_no || !adjustment_type || !amount) { res.status(400).json({ error: 'Required fields missing' }); return; }
  if (!['refund', 'adjustment', 'waiver'].includes(adjustment_type)) { res.status(400).json({ error: 'Invalid adjustment type' }); return; }

  const student = await db.get('SELECT id FROM students WHERE registration_no = ?', registration_no);
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  const result = await db.run(
    `INSERT INTO adjustments (registration_no, academic_year, study_year, fee_type, installment, adjustment_type, amount, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    registration_no, academic_year, study_year, fee_type, installment, adjustment_type, amount, reason, req.user!.id
  );
  await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'CREATE_ADJUSTMENT', 'adjustments', String(result.lastInsertRowid), JSON.stringify(req.body));

  res.status(201).json({ id: result.lastInsertRowid });
});

// Deposits
router.get('/deposits', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const regNo = req.query.registration_no as string;
  const deposits = regNo
    ? await db.all('SELECT * FROM deposits WHERE registration_no = ? ORDER BY created_at DESC', regNo)
    : await db.all('SELECT * FROM deposits ORDER BY created_at DESC');
  res.json(deposits);
});

router.post('/deposits', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { registration_no, amount, receipt_no, deposit_date, remarks } = req.body;
  if (!registration_no || !amount) { res.status(400).json({ error: 'Required fields missing' }); return; }

  const result = await db.run(
    `INSERT INTO deposits (registration_no, amount, receipt_no, deposit_date, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    registration_no, amount, receipt_no, deposit_date, remarks, req.user!.id
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
