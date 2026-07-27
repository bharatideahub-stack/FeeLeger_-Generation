import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { buildLedgerData } from '../services/ledgerEngine';
import { generateFeeLedgerPDF, generateBulkPDF } from '../services/pdfGenerator';
import { getDb } from '../database/db';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// GET /api/ledger/student/:regNo - get ledger data for a student
router.get('/student/:regNo', async (req: AuthRequest, res: Response) => {
  try {
    const ledgerData = await buildLedgerData(req.params.regNo);
    res.json(ledgerData);
  } catch (err: any) {
    if (err.message.includes('not found')) { res.status(404).json({ error: err.message }); }
    else { res.status(500).json({ error: 'Failed to build ledger data' }); }
  }
});

// GET /api/ledger/student/:regNo/pdf - generate PDF for a student
router.get('/student/:regNo/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const ledgerData = await buildLedgerData(req.params.regNo);
    const pdfBuffer = generateFeeLedgerPDF(ledgerData);
    const db = getDb();
    await db.run(`INSERT INTO ledger_generation_history (registration_no, generation_type, generated_by) VALUES (?, 'individual', ?)`,
      req.params.regNo, req.user!.id);
    await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id) VALUES (?, ?, ?, ?, ?)`,
      req.user!.id, req.user!.username, 'GENERATE_PDF', 'ledger_generation_history', req.params.regNo);
    const fileName = `fee_ledger_${req.params.regNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    if (err.message.includes('not found')) { res.status(404).json({ error: err.message }); }
    else { res.status(500).json({ error: 'Failed to generate PDF' }); }
  }
});

// POST /api/ledger/bulk/pdf - generate bulk PDF
router.post('/bulk/pdf', async (req: AuthRequest, res: Response) => {
  const { registration_numbers, combined } = req.body;
  if (!Array.isArray(registration_numbers) || registration_numbers.length === 0) {
    res.status(400).json({ error: 'Registration numbers required' }); return;
  }
  if (registration_numbers.length > 500) {
    res.status(400).json({ error: 'Maximum 500 students per bulk generation' }); return;
  }
  try {
    const ledgers = await Promise.all(registration_numbers.map((regNo: string) => buildLedgerData(regNo)));
    const db = getDb();
    await db.run(`INSERT INTO ledger_generation_history (generation_type, student_count, bulk_criteria, generated_by) VALUES ('bulk', ?, ?, ?)`,
      registration_numbers.length, JSON.stringify(req.body), req.user!.id);

    const pdfBuffer = combined ? generateBulkPDF(ledgers) : generateFeeLedgerPDF(ledgers[0]);
    const fileName = combined ? `bulk_fee_ledgers_${Date.now()}.pdf` : `fee_ledger_${registration_numbers[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ error: `Bulk generation failed: ${err.message}` });
  }
});

// GET /api/ledger/history - ledger generation history
router.get('/history', async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const history = await db.all(
    `SELECT l.*, s.student_name, u.full_name as generated_by_name FROM ledger_generation_history l LEFT JOIN students s ON l.registration_no = s.registration_no LEFT JOIN users u ON l.generated_by = u.id ORDER BY l.created_at DESC LIMIT 200`
  );
  res.json(history);
});

// GET /api/ledger/bulk-candidates - get students for bulk selection
router.get('/bulk-candidates', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const school = req.query.school as string;
  const program = req.query.program as string;
  const department = req.query.department as string;
  const academicYear = req.query.academic_year as string;

  let where = 'WHERE s.is_active = 1';
  const params: any[] = [];
  if (school) { where += ' AND s.school = ?'; params.push(school); }
  if (program) { where += ' AND s.program = ?'; params.push(program); }
  if (department) { where += ' AND s.department = ?'; params.push(department); }
  if (academicYear) {
    where += ' AND EXISTS (SELECT 1 FROM fee_structure_items f WHERE f.registration_no = s.registration_no AND f.academic_year = ?)';
    params.push(academicYear);
  }

  const students = await db.all(
    `SELECT s.registration_no, s.student_name, s.school, s.program, s.campus, s.date_of_joining FROM students s ${where} ORDER BY s.student_name LIMIT 1000`,
    ...params
  );
  res.json(students);
});

export default router;
