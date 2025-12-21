import express from 'express';
import pool from '../db.config.js';

const router = express.Router();

console.log('Login route loaded');

router.post('/', async (req, res) => {
    const { username, password } = req.body;
    console.log('📨 Received from client:', { username, password }); 

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

        res.json({
            id,
            first_name: firstName,
            last_name: lastName,
            role,
        });
    } catch (error) {
        console.error('Login database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
