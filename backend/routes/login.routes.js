import express from 'express';
import pool from '../db.config.js';
import { getJwtExpiresIn } from '../auth/auth-config.js';
import { signAccessToken } from '../auth/jwt.js';

const router = express.Router();

console.log('Login route loaded');

router.post('/', async (req, res) => {
  const { username, password } = req.body;
  console.log('[auth] Login attempt:', { username });

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const query = `SELECT * FROM users WHERE login = ? AND password = ? LIMIT 1`;
    const [rows] = await pool.query(query, [username, password]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const id = user.id ?? user.ID ?? user.Id;
    const firstName = user.first_name ?? user.FirstName ?? user.firstname ?? user.firstName;
    const lastName = user.last_name ?? user.LastName ?? user.lastname ?? user.lastName;
    const role =
      user.system_role ??
      user.SystemRoleID ??
      user.user_role_id ??
      user.UserRoleID ??
      user.role;

    const accessToken = signAccessToken({
      id,
      role,
      login: user.login ?? username ?? '',
    });

    return res.json({
      id,
      first_name: firstName,
      last_name: lastName,
      role,
      accessToken,
      tokenType: accessToken ? 'Bearer' : null,
      expiresIn: accessToken ? getJwtExpiresIn() : null,
    });
  } catch (error) {
    console.error('Login database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
