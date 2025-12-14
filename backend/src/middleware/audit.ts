import { Response, NextFunction } from 'express';
import pool from '../config/database';
import { AuthRequest } from './auth';

export const auditLog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const originalSend = res.json;
  
  res.json = function (body: any) {
    // Log the action after response is sent
    if (req.user && req.method !== 'GET') {
      const action = `${req.method} ${req.path}`;
      const entityType = req.path.split('/')[1] || 'unknown';
      
      pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          action,
          entityType,
          req.ip || req.socket.remoteAddress,
          req.get('user-agent') || ''
        ]
      ).catch(err => console.error('Audit log error:', err));
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

