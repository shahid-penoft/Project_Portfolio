import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // TLS
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify SMTP connection on startup
transporter.verify((err) => {
    if (err) {
        console.warn('⚠️   SMTP connection warning:', err.message);
    } else {
        console.log('✅  SMTP mailer ready');
    }
});

export default transporter;
