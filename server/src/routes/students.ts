import { Router, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/students?page=1&limit=20&search=&school=&program=
router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || '';
  const school = (req.query.school as string) || '';
  const program = (req.query.program as string) || '';
  const department = (req.query.department as string) || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (search) {
    where += ' AND (registration_no LIKE ? OR student_name LIKE ? OR father_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (school) { where += ' AND school = ?'; params.push(school); }
  if (program) { where += ' AND program = ?'; params.push(program); }
  if (department) { where += ' AND department = ?'; params.push(department); }

  const totalRow = await db.get(`SELECT COUNT(*) as count FROM students ${where}`, ...params);
  const total = totalRow?.count ?? 0;
  const students = await db.all(`SELECT * FROM students ${where} ORDER BY student_name LIMIT ? OFFSET ?`, ...params, limit, offset);

  res.json({ students, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// GET /api/students/filters
router.get('/filters', async (_req, res: Response) => {
  const db = getDb();
  const schools = (await db.all('SELECT DISTINCT school FROM students WHERE school IS NOT NULL ORDER BY school')).map(r => r.school);
  const programs = (await db.all('SELECT DISTINCT program FROM students WHERE program IS NOT NULL ORDER BY program')).map(r => r.program);
  const departments = (await db.all('SELECT DISTINCT department FROM students WHERE department IS NOT NULL ORDER BY department')).map(r => r.department);
  const campuses = (await db.all('SELECT DISTINCT campus FROM students WHERE campus IS NOT NULL ORDER BY campus')).map(r => r.campus);
  res.json({ schools, programs, departments, campuses });
});

// GET /api/students/:regNo
router.get('/:regNo', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const student = await db.get('SELECT * FROM students WHERE registration_no = ?', req.params.regNo);
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
  res.json(student);
});

// POST /api/students
router.post('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { registration_no, student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving } = req.body;

  if (!registration_no || !student_name) {
    res.status(400).json({ error: 'Registration number and student name required' }); return;
  }

  try {
    const result = await db.run(
      `INSERT INTO students (registration_no, student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      registration_no, student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving
    );
    await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
      req.user!.id, req.user!.username, 'CREATE_STUDENT', 'students', registration_no, JSON.stringify(req.body));
    res.status(201).json({ id: result.lastInsertRowid, registration_no });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Registration number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create student' });
    }
  }
});

// PUT /api/students/:regNo
router.put('/:regNo', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const old = await db.get('SELECT * FROM students WHERE registration_no = ?', req.params.regNo);
  if (!old) { res.status(404).json({ error: 'Student not found' }); return; }

  const { student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving } = req.body;
  await db.run(
    `UPDATE students SET student_name=?, father_name=?, school=?, department=?, program=?, campus=?, date_of_joining=?, date_of_leaving=?, updated_at=datetime('now') WHERE registration_no=?`,
    student_name, father_name, school, department, program, campus, date_of_joining, date_of_leaving, req.params.regNo
  );
  await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name, record_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    req.user!.id, req.user!.username, 'UPDATE_STUDENT', 'students', req.params.regNo, JSON.stringify(old), JSON.stringify(req.body));

  res.json({ message: 'Student updated' });
});

export default router;
