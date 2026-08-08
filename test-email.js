import 'dotenv/config';
import { sendEnquiryReplyEmail } from './utils/email.js';

(async () => {
  try {
    console.log('Sending test email...');
    await sendEnquiryReplyEmail({
      to: 'test@example.com',
      full_name: 'Test Citizen',
      subject: 'Test Subject',
      replyMessage: 'This is a test reply message.'
    });
    console.log('Test email sent successfully!');
  } catch (err) {
    console.error('Error sending test email:', err);
  }
})();
