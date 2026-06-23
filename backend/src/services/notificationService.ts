import pool from '../config/database';

interface NotifyOptions {
  userId: number;
  title: string;
  message: string;
  type?: string;
  relatedId?: number;
  relatedType?: string;
}

async function hasRecentNotification(
  userId: number,
  title: string,
  relatedType: string | undefined,
  relatedId: number | undefined,
  hours = 24
): Promise<boolean> {
  if (!relatedType || relatedId == null) return false;
  const result = await pool.query(
    `SELECT id FROM notifications
     WHERE user_id = $1 AND title = $2 AND related_type = $3 AND related_id = $4
       AND created_at > NOW() - ($5 || ' hours')::INTERVAL
     LIMIT 1`,
    [userId, title, relatedType, relatedId, hours]
  );
  return result.rows.length > 0;
}

export async function sendNotification(options: NotifyOptions) {
  const duplicate = await hasRecentNotification(
    options.userId,
    options.title,
    options.relatedType,
    options.relatedId
  );
  if (duplicate) return;

  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      options.userId,
      options.title,
      options.message,
      options.type || 'equipment',
      options.relatedId ?? null,
      options.relatedType ?? null,
    ]
  );
}

export async function notifyRoleUsers(
  roles: string[],
  title: string,
  message: string,
  type?: string,
  relatedId?: number,
  relatedType?: string
) {
  const result = await pool.query(
    `SELECT id FROM users WHERE role = ANY($1) AND is_active = true`,
    [roles]
  );
  for (const user of result.rows) {
    await sendNotification({
      userId: user.id,
      title,
      message,
      type,
      relatedId,
      relatedType,
    });
  }
}
