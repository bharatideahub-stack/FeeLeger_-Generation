import { Response, NextFunction } from 'express';
import { getDb } from '../database/db';
import { AuthRequest } from './auth';

export function auditLog(action: string, tableName: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const db = getDb();
    db.run(
      `INSERT INTO audit_logs (user_id, username, action, table_name, record_id, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      req.user?.id ?? null,
      req.user?.username ?? 'system',
      action,
      tableName,
      req.params.id ?? null,
      JSON.stringify(req.body).substring(0, 2000),
      req.ip
    ).catch(() => { /* Non-blocking audit log failure */ });
    next();
  };
}
