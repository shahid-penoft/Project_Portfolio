import 'dotenv/config';
import transporter from '../configs/mailer.js';

const APP_NAME = process.env.APP_NAME || 'Diavets';
const MAIL_FROM = process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@diavets.com>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
//  Forgot Password Email
// ─────────────────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ to, name, token }) => {
    const resetLink = `${FRONTEND_URL}/admin/reset-password?token=${token}`;

    await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject: `[${APP_NAME}] Password Reset Request`,
        html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <div style="background:#1a3c5e;padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1a3c5e;margin-top:0;">Password Reset</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your admin account password. Click the button below to set a new password:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}"
                 style="background:#1a3c5e;color:#fff;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
                Reset Password
              </a>
            </div>
            <p style="color:#666;font-size:13px;">This link will expire in <strong>30 minutes</strong>.</p>
            <p style="color:#666;font-size:13px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
};

// ─────────────────────────────────────────────────────────────
//  Welcome / Account Created Email
// ─────────────────────────────────────────────────────────────
export const sendWelcomeEmail = async ({ to, name, tempPassword }) => {
    await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject: `[${APP_NAME}] Your Admin Account Has Been Created`,
        html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <div style="background:#1a3c5e;padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1a3c5e;margin-top:0;">Welcome, ${name}!</h2>
            <p>Your admin account has been created. Here are your temporary credentials:</p>
            <div style="background:#f8f9fa;border-left:4px solid #1a3c5e;padding:16px;border-radius:4px;margin:20px 0;">
              <p style="margin:4px 0;"><strong>Email:</strong> ${to}</p>
              <p style="margin:4px 0;"><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
            </div>
            <p style="color:#d9534f;"><strong>⚠ Please change your password immediately after first login.</strong></p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
};
