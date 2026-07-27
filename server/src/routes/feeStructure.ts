import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const VALID_STUDY_YEARS = ['Freshman Year', 'Sophomore Year', 'Junior Year', 'Senior Year I', 'Senior Year II'];
const VALID_INSTALLMENTS = ['I', 'II', 'III', 'IV'];

router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const regNo = req.query.registration_no as string;
  const academicYear = req.query.academic_year as string;
  const studyYear = req.query.study_year as string;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (regNo) { where += ' AND f.registration_no = ?'; params.push(regNo); }
  if (academicYear) { where += ' AND f.academic_year = ?'; params.push(academicYear); }
  if (studyYear) { where += ' AND f.study_year = ?'; params.push(studyYear); }

  const items = await db.all(
    `SELECT f.*, s.student_name FROM fee_structure_items f JOIN students s ON f.registration_no = s.registration_no ${where} ORDER BY f.registration_no, f.study_year, f.fee_type, f.installment`,
    ...params
  );
  res.json(items);
});

router.get('/academic-years', async (_req, res: Response) => {
  const db = getDb();
  const years = (await db.all('SELECT DISTINCT academic_year FROM fee_structure_items ORDER BY academic_year')).map(r => r.academic_year);
  res.json(years);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { registration_no, academic_year, study_year, fee_type, installment, fee_amount } = req.body;

  if (!registration_no || !academic_year || !study_year || !fee_type || !installment || fee_amount === undefined) {
    res.status(400).json({ error: 'All fields required' }); return;
  }
  if (!VALID_STUDY_YEARS.includes(study_year)) { res.status(400).json({ error: 'Invalid study year' }); return; }
  if (!VALID_INSTALLMENTS.includes(installment)) { res.status(400).json({ error: 'Invalid installment' }); return; }

  const student = await db.get('SELECT id FROM students WHERE registration_no = ?', registration_no);
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  try {
    const result = await db.run(
      `INSERT INTO fee_structure_items (registration_no, academic_year, study_year, fee_type, installment, fee_amount) VALUES (?, ?, ?, ?, ?, ?)`,
      registration_no, academic_year, study_year, fee_type, installment, fee_amount
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) { res.status(409).json({ error: 'Fee structure item already exists' }); }
    else { res.status(500).json({ error: 'Failed to create fee structure item' }); }
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { fee_amount } = req.body;
  if (fee_amount === undefined || isNaN(fee_amount)) { res.status(400).json({ error: 'Valid fee amount required' }); return; }

  const existing = await db.get('SELECT * FROM fee_structure_items WHERE id = ?', req.params.id);
  if (!existing) { res.status(404).json({ error: 'Fee structure item not found' }); return; }

  await db.run('UPDATE fee_structure_items SET fee_amount = ? WHERE id = ?', fee_amount, req.params.id);
  await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'UPDATE_FEE_STRUCTURE', 'fee_structure_items', req.params.id,
    JSON.stringify(existing), JSON.stringify(req.body));

  res.json({ message: 'Fee structure updated' });
});

export default router;
