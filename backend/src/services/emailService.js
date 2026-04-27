const nodemailer = require('nodemailer');
const path = require("path");
const fs = require("fs");

let transporter = null;

// Resolve the invitation image once at module load. Lives in frontend/public
// so the same file is served on the guest detail page and attached to emails.
const INVITE_IMAGE_PATH = path.resolve(
  __dirname,
  '../../../frontend/public/faith-wedding.jpeg',
);
const INVITE_IMAGE_EXISTS = fs.existsSync(INVITE_IMAGE_PATH);
if (!INVITE_IMAGE_EXISTS) {
  console.warn('[Email] Invitation image not found at', INVITE_IMAGE_PATH);
}

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
  const hostsLine = process.env.EVENT_HOSTS || "The Family";

  const text = `Dear ${guest.name},

You are warmly invited to celebrate our wedding with us.
Please find attached our Church Wedding Invitation Card with ceremony details.
Your personalized barcode access pass is included in this email and will be required for entry into the reception venue. Kindly present it at the entrance.
You may scan the barcode beforehand to confirm access and view reception details.

We look forward to celebrating this special day with you.

Warm regards,
${hostsLine}

— Backup code: ${guest.backup_code}`;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; color: #1a1a2e;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); line-height: 1.7;">
        <p style="margin: 0 0 16px;">Dear <strong>${guest.name}</strong>,</p>
        <p style="margin: 0 0 16px;">You are warmly invited to celebrate our wedding with us.</p>
        <p style="margin: 0 0 16px;">Please find attached our Church Wedding Invitation Card with ceremony details.</p>
        <p style="margin: 0 0 16px;">
          Your personalized barcode access pass is included in this email and will be required for entry into the reception venue.
          Kindly present it at the entrance.
        </p>
        <p style="margin: 0 0 24px;">
          You may scan the barcode beforehand to confirm access and view reception details.
        </p>

        <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <img src="cid:qrcode" alt="Your access barcode" style="width: 220px; height: 220px; display: block; margin: 0 auto 16px;" />
          <p style="color: #333; font-size: 13px; margin: 0 0 8px; font-family: Arial, sans-serif;">Scan to confirm access &amp; view reception details</p>
          <div style="background: white; border: 2px dashed #6366f1; border-radius: 6px; padding: 12px; display: inline-block; margin-top: 8px;">
            <p style="color: #6366f1; font-weight: bold; font-size: 18px; letter-spacing: 3px; margin: 0; font-family: 'Courier New', monospace;">
              ${guest.backup_code}
            </p>
            <p style="color: #888; font-size: 11px; margin: 4px 0 0; font-family: Arial, sans-serif;">Backup code (if scan fails)</p>
          </div>
        </div>

        <p style="margin: 0 0 4px;">We look forward to celebrating this special day with you.</p>
        <p style="margin: 24px 0 0;">Warm regards,<br><strong>${hostsLine}</strong></p>

        <div style="border-top: 1px solid #eee; margin-top: 24px; padding-top: 16px;">
          <p style="color: #888; font-size: 12px; margin: 0; font-family: Arial, sans-serif;">
            Please do not share this barcode or backup code with anyone outside your invited guests.
          </p>
        </div>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from:
      process.env.SMTP_FROM ||
      `"Wedding Invitation" <${process.env.SMTP_USER}>`,
    to: guest.email,
    subject: "You're Invited — Wedding Reception Access Pass",
    text,
    html,
    attachments: [
      {
        filename: "access-pass.png",
        content: Buffer.from(base64Data, "base64"),
        cid: "qrcode",
        contentType: "image/png",
      },
      ...(INVITE_IMAGE_EXISTS
        ? [
            {
              filename: "Church-Wedding-Invitation.jpeg",
              path: INVITE_IMAGE_PATH,
              contentType: "image/jpeg",
            },
          ]
        : []),
    ],
  });

  console.log(`[Email] Sent invitation to ${guest.email}`);
  return { sent: true };
}

module.exports = { sendGuestCardEmail };
