const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send guest card email with QR code and backup code
 * @param {Object} guest - Guest record
 * @param {string} qrDataUrl - Base64 QR code image
 */
async function sendGuestCardEmail(guest, qrDataUrl) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') {
    console.warn('[Email] SMTP not configured. Skipping email to', guest.email);
    return { skipped: true };
  }

  if (!guest.email) {
    console.warn('[Email] Guest has no email address. Skipping.');
    return { skipped: true };
  }

  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h1 style="color: #1a1a2e; margin-bottom: 8px; font-size: 24px;">Your Guest Pass</h1>
        <p style="color: #555; margin-bottom: 24px;">Hi ${guest.name}, your event guest card is ready.</p>

        <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px; display: block; margin: 0 auto 16px;" />
          <p style="color: #333; font-size: 13px; margin: 0 0 8px;">Scan to view your guest details</p>
          <div style="background: white; border: 2px dashed #6366f1; border-radius: 6px; padding: 12px; display: inline-block; margin-top: 8px;">
            <p style="color: #6366f1; font-weight: bold; font-size: 18px; letter-spacing: 3px; margin: 0;">
              ${guest.backup_code}
            </p>
            <p style="color: #888; font-size: 11px; margin: 4px 0 0;">Backup Code</p>
          </div>
        </div>

        <div style="border-top: 1px solid #eee; padding-top: 16px;">
          <p style="color: #888; font-size: 12px; margin: 0;">
            Present this QR code or backup code at the event entrance.<br>
            Do not share this code with others who are not your guests.
          </p>
        </div>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `"Event Check-In" <${process.env.SMTP_USER}>`,
    to: guest.email,
    subject: 'Your Event Guest Pass',
    html,
    attachments: [
      {
        filename: 'qrcode.png',
        content: Buffer.from(base64Data, 'base64'),
        cid: 'qrcode',
        contentType: 'image/png',
      },
    ],
  });

  console.log(`[Email] Sent guest card to ${guest.email}`);
  return { sent: true };
}

module.exports = { sendGuestCardEmail };
