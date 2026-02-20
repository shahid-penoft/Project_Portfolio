import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (_, res) =>
    res.json({ success: true, message: 'Server is running', timestamp: new Date() })
);

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) =>
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
);

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[GlobalError]', err);
    res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
});

export default app;
