import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { createDesktopWsServer } from './ws/desktop-ws.js';

import loginRoutes from './routes/login.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import lookupsRoutes from './routes/lookups.routes.js';
import timeTrackingRoutes from './routes/time-tracking.routes.js';
import itemsRoutes from './routes/items.routes.js';
import usersRoutes from './routes/users.routes.js';
import customersRoutes from './routes/customers.routes.js';
import desktopRoutes from './routes/desktop.routes.js';
import { ROLE } from './auth/auth-config.js';
import { requireAuth, requireRole } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const dbname = process.env.DB_NAME;

app.use(cors());
app.use(express.json());

app.use('/api/login', loginRoutes);
app.use('/api/projects', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), projectsRoutes);
app.use('/api/lookups', requireAuth, lookupsRoutes);
app.use('/api/time-tracking', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), timeTrackingRoutes);
app.use('/api/items', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), itemsRoutes);
app.use('/api/users', requireAuth, requireRole([ROLE.ADMIN]), usersRoutes);
app.use('/api/customers', requireAuth, requireRole([ROLE.ADMIN, ROLE.EMPLOYEE]), customersRoutes);
app.use('/api/desktop', desktopRoutes);


const server = http.createServer(app);
const desktopWs = createDesktopWsServer(server);

server.listen(PORT, () => {
    console.log(`API HTTP server running on port ${PORT}`);
    console.log(`Connected DB: ${dbname}`);
    console.log(`WebSocket started on endpoint: ws://<host>:${PORT}/ws/desktop`);
    console.log('Desktop WS clients: ' + desktopWs.getClientCount());
}); 
