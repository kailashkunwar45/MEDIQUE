import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRoutes from './routes/auth.routes';
import appointmentRoutes from './routes/appointment.routes';
import queueRoutes from './routes/queue.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';
import hospitalRoutes from './routes/hospital.routes';
import reviewRoutes from './routes/review.routes';
import chatRoutes from './routes/chat.routes';
import userRoutes from './routes/user.routes';
import hospitalAdminRoutes from './routes/hospitalAdmin.routes';
import superAdminRoutes from './routes/superAdmin.routes';

const app = express();

// Global rate limiter: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for easier frontend integration in this setup
  })
);
app.use(morgan('dev'));
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hospital-admin', hospitalAdminRoutes);
app.use('/api/super-admin', superAdminRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'MediQueue API is running' });
});

// Serve static files from the Next.js export
const webOutPath = path.join(__dirname, '../../web/out');
app.use(express.static(webOutPath));

// Fallback for SPA routing
app.get('(.*)', (req, res) => {
  res.sendFile(path.join(webOutPath, 'index.html'));
});

export default app;
