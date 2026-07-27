import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/stats', async (_req, res: Response) => {
  const db = getDb();
  const [c1, c2, c3, c4, c5, c6] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM students'),
    db.get('SELECT COALESCE(SUM(fee_amount),0) as s FROM fee_structure_items'),
    db.get('SELECT COALESCE(SUM(amount_paid),0) as s FROM transactions WHERE is_cancelled=0'),
    db.get('SELECT COALESCE(SUM(amount),0) as s FROM adjustments'),
    db.get('SELECT COUNT(*) as c FROM transactions WHERE is_cancelled=0'),
    db.get('SELECT COUNT(*) as c FROM ledger_generation_history'),
  ]);
  const totalFee = c2?.s ?? 0;
  const totalCollected = c3?.s ?? 0;
  const totalAdj = c4?.s ?? 0;
  res.json({
    totalStudents: c1?.c ?? 0,
    totalFee,
    totalCollected,
    totalDue: Math.max(0, totalFee - totalCollected - totalAdj),
    totalTransactions: c5?.c ?? 0,
    ledgersGenerated: c6?.c ?? 0,
  });
});

router.get('/recent-imports', async (_req, res: Response) => {
  const db = getDb();
  const imports = await db.all(
    `SELECT i.*, u.full_name as imported_by_name FROM imports i LEFT JOIN users u ON i.imported_by = u.id ORDER BY i.created_at DESC LIMIT 10`
  );
  res.json(imports);
});

router.get('/recent-ledgers', async (_req, res: Response) => {
  const db = getDb();
  const ledgers = await db.all(
    `SELECT l.*, s.student_name, u.full_name as generated_by_name FROM ledger_generation_history l LEFT JOIN students s ON l.registration_no = s.registration_no LEFT JOIN users u ON l.generated_by = u.id ORDER BY l.created_at DESC LIMIT 10`
  );
  res.json(ledgers);
});

router.get('/fee-by-year', async (_req, res: Response) => {
  const db = getDb();
  const data = await db.all(
    `SELECT academic_year, COALESCE(SUM(fee_amount),0) as total_fee FROM fee_structure_items GROUP BY academic_year ORDER BY academic_year`
  );
  res.json(data);
});

export default router;
