import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function run() {
    try {
        console.log(`Using sender: "MLA Office Kothamangalam" <${process.env.SMTP_USER}>`);
        
        const info = await transporter.sendMail({
            from: `"Test Mail" <${process.env.SMTP_USER}>`,
            to: "mohammed.shahid@penoft.com",
            subject: "Test Email Check",
            text: "This is a test email to verify SMTP delivery.",
        });
        console.log("Success. Message ID:", info.messageId);
        console.log("Response:", info.response);
    } catch (e) {
        console.error("Error sending:", e);
    }
}
run();
