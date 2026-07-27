import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/db';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) { res.status(400).json({ error: 'Username and password required' }); return; }

  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', username);
  if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name) VALUES (?, ?, ?, ?)`,
    user.id, user.username, 'LOGIN', 'users');

  res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } });
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  await db.run(`INSERT INTO audit_logs (user_id, username, action, table_name) VALUES (?, ?, ?, ?)`,
    req.user?.id, req.user?.username, 'LOGOUT', 'users');
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = await db.get('SELECT id, username, full_name, role FROM users WHERE id = ?', req.user!.id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, username: user.username, fullName: user.full_name, role: user.role });
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || (newPassword as string).length < 6) {
    res.status(400).json({ error: 'Invalid password data' }); return;
  }
  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user!.id);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash as string)) {
    res.status(400).json({ error: 'Current password incorrect' }); return;
  }
  const newHash = bcrypt.hashSync(newPassword, 12);
  await db.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, newHash, req.user!.id);
  res.json({ message: 'Password changed successfully' });
});

export default router;
