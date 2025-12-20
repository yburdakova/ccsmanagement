import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';

import loginRoutes from './routes/login.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import lookupsRoutes from './routes/lookups.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const dbname = process.env.DB_NAME;

app.use(cors());
app.use(express.json());

app.use('/api/login', loginRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/lookups', lookupsRoutes);


http.createServer(app).listen(PORT, () => {
    console.log(`API HTTP server running on port ${PORT}`);
    console.log(`Connected DB: ${dbname}`);
});
