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

// ─────────────────────────────────────────────────────────────
//  Contact / Enquiry — User Confirmation Email
// ─────────────────────────────────────────────────────────────
export const sendEnquiryReceivedEmail = async (enquiry) => {
  const { full_name, email, category, subject, message, panchayat } = enquiry;
  const categoryLabel = category ? category.replace(/\b\w/g, l => l.toUpperCase()) : 'General';
  await transporter.sendMail({
    from: `"${APP_NAME}" <${MAIL_FROM}>`,
    to: email,
    subject: `[${APP_NAME}] We received your enquiry`,
    html: `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <div style="background:#035194;padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:22px;">${APP_NAME}</h1></div>
          <div style="padding:32px;">
            <h2 style="color:#035194;margin-top:0;">Enquiry Received ✅</h2>
            <p>Hi <strong>${full_name}</strong>,</p>
            <p>Thank you for reaching out! We have received your enquiry and our team will get back to you shortly.</p>
            <div style="background:#f0f9ff;border-left:4px solid #035194;padding:16px;border-radius:4px;margin:20px 0;">
              <p style="margin:4px 0;"><strong>Category:</strong> ${categoryLabel}</p>
              ${subject ? `<p style="margin:4px 0;"><strong>Subject:</strong> ${subject}</p>` : ''}
              ${panchayat && panchayat !== 'N/A' ? `<p style="margin:4px 0;"><strong>Panchayat:</strong> ${panchayat}</p>` : ''}
              <p style="margin:12px 0 4px;"><strong>Your Message:</strong></p>
              <p style="margin:4px 0;color:#555;">${message}</p>
            </div>
            <p style="color:#666;font-size:13px;">We aim to respond within 1–2 working days.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body></html>`,
  });
};

// ─────────────────────────────────────────────────────────────
//  Contact / Enquiry — Admin Alert Email
// ─────────────────────────────────────────────────────────────
export const sendAdminEnquiryAlert = async (enquiry) => {
  const { id, full_name, email, mobile, panchayat, category, subject, message } = enquiry;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || MAIL_FROM;
  const categoryLabel = category ? category.replace(/\b\w/g, l => l.toUpperCase()) : 'General';
  await transporter.sendMail({
    from: `"${APP_NAME} Alerts" <${MAIL_FROM}>`,
    to: adminEmail,
    subject: `🔔 New Enquiry #${id} — [${categoryLabel}] from ${full_name}`,
    html: `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <div style="background:#011f3e;padding:24px 32px;">
            <h1 style="color:#fff;margin:0;font-size:18px;">${APP_NAME} — New Enquiry Alert</h1>
          </div>
          <div style="padding:32px;">
            <div style="background:#fff8e1;border:1px solid #F9D05A;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;font-weight:bold;color:#7c4f00;">🔔 Enquiry ID #${id} received</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr style="background:#f8f9fa;"><td style="padding:10px 14px;font-weight:bold;width:35%;border:1px solid #eee;">Name</td><td style="padding:10px 14px;border:1px solid #eee;">${full_name}</td></tr>
              <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #eee;">Email</td><td style="padding:10px 14px;border:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr style="background:#f8f9fa;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #eee;">Mobile</td><td style="padding:10px 14px;border:1px solid #eee;">${mobile}</td></tr>
              <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #eee;">Panchayat</td><td style="padding:10px 14px;border:1px solid #eee;">${panchayat}</td></tr>
              <tr style="background:#f8f9fa;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #eee;">Category</td><td style="padding:10px 14px;border:1px solid #eee;"><span style="background:#035194;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;">${categoryLabel}</span></td></tr>
              ${subject ? `<tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #eee;">Subject</td><td style="padding:10px 14px;border:1px solid #eee;">${subject}</td></tr>` : ''}
            </table>
            <div style="margin-top:20px;background:#f0f9ff;border-left:4px solid #035194;padding:16px;border-radius:4px;">
              <p style="margin:0 0 8px;font-weight:bold;font-size:13px;">Message:</p>
              <p style="margin:0;color:#444;line-height:1.6;">${message}</p>
            </div>
            <div style="margin-top:24px;text-align:center;">
              <a href="${FRONTEND_URL}/admin/dashboard/enquiries"
                 style="background:#035194;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">
                View in Admin Panel →
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
            <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. Admin notification only.</p>
          </div>
        </div>
      </body></html>`,
  });
};
