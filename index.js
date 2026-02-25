import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import localBodyRoutes from './routes/localBodyRoutes.js';
import sectorRoutes from './routes/sectorRoutes.js';
import eventTypeRoutes from './routes/eventTypeRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import mediaCentreRoutes from './routes/mediaCentreRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import enteNaduRoutes from './routes/enteNaduRoutes.js';
import coreVisionRoutes from './routes/coreVisionRoutes.js';
import timelineRoutes from './routes/timelineRoutes.js';
import recognitionRoutes from './routes/recognitionRoutes.js';
import visualStoryRoutes from './routes/visualStoryRoutes.js';
import achievementsRoutes from './routes/achievementsRoutes.js';
import enteNaduTestimonialsRoutes from './routes/enteNaduTestimonialsRoutes.js';
import manifestoRoutes from './routes/manifestoRoutes.js';
import manifestoDevGoalsRoutes from './routes/manifestoDevGoalsRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// ─── Static: serve uploaded media files ──────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (_, res) =>
    res.json({ success: true, message: 'Server is running', timestamp: new Date() })
);

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/local-bodies', localBodyRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/media-centre', mediaCentreRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/ente-nadu', enteNaduRoutes);
app.use('/api/core-vision', coreVisionRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/recognitions', recognitionRoutes);
app.use('/api/visual-stories', visualStoryRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/ente-nadu-testimonials', enteNaduTestimonialsRoutes);
app.use('/api/manifesto/long-term-commitments', manifestoRoutes);
app.use('/api/manifesto/development-goals', manifestoDevGoalsRoutes);
app.use('/api/contact', contactRoutes);

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
