import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { processExcelImport, generateExcelTemplate, generateErrorReport } from '../services/excelService';
import { getDb } from '../database/db';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET /api/imports - list imports
router.get('/', async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const imports = await db.all(
    `SELECT i.*, u.full_name as imported_by_name FROM imports i LEFT JOIN users u ON i.imported_by = u.id ORDER BY i.created_at DESC LIMIT 100`
  );
  res.json(imports);
});

// GET /api/imports/:id - import details + errors
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const importRecord = await db.get('SELECT * FROM imports WHERE id = ?', req.params.id);
  if (!importRecord) { res.status(404).json({ error: 'Import not found' }); return; }
  const errors = await db.all('SELECT * FROM import_errors WHERE import_id = ? LIMIT 500', req.params.id);
  res.json({ ...importRecord, errors });
});

// POST /api/imports/upload - upload and process Excel file
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  try {
    const result = await processExcelImport(req.file.path, req.user!.id);
    const db = getDb();
    await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      req.user!.id, req.user!.username, 'IMPORT_EXCEL', 'imports', String(result.importId),
      JSON.stringify({ file: req.file.originalname, ...result }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
});

// GET /api/imports/template/download?blank=true
router.get('/template/download', (req: AuthRequest, res: Response) => {
  const blank = req.query.blank === 'true';
  const buffer = generateExcelTemplate(blank);
  const fileName = blank ? 'fee_ledger_blank_template.xlsx' : 'fee_ledger_sample_template.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

// GET /api/imports/:id/error-report
router.get('/:id/error-report', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const importRecord = await db.get('SELECT id FROM imports WHERE id = ?', req.params.id);
  if (!importRecord) { res.status(404).json({ error: 'Import not found' }); return; }

  const buffer = await generateErrorReport(parseInt(req.params.id));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="import_errors_${req.params.id}.xlsx"`);
  res.send(buffer);
});

export default router;
