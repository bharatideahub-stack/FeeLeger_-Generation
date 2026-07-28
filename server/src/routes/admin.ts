import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// POST /api/admin/wipe-data - danger zone: erase all business data, keep user accounts
router.post('/wipe-data', requireRole('superadmin'), async (req: AuthRequest, res: Response) => {
  const { confirm } = req.body;
  if (confirm !== 'WIPE') {
    res.status(400).json({ error: 'Confirmation phrase does not match' });
    return;
  }

  const db = getDb();
  const counts = await db.get(
    `SELECT
      (SELECT COUNT(*) FROM students) as students,
      (SELECT COUNT(*) FROM imports) as imports,
      (SELECT COUNT(*) FROM ledger_generation_history) as ledgers`
  );

  await db.transaction(async (tx) => {
    // students cascades to fee_structure_items, transactions, deposits, adjustments via ON DELETE CASCADE
    await tx.run('DELETE FROM students');
    await tx.run('DELETE FROM import_errors');
    await tx.run('DELETE FROM imports');
    await tx.run('DELETE FROM ledger_generation_history');
  });

  await db.run(
    `INSERT INTO audit_logs (user_id, username, action, table_name, new_value) VALUES (?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'WIPE_ALL_DATA', 'students', JSON.stringify(counts)
  );

  res.json({ message: 'All business data wiped', cleared: counts });
});

export default router;
