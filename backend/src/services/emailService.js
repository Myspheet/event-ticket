const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");

let resendClient = null;

// Resolve the invitation image once at module load. Lives in frontend/public
// so the same file is served on the guest detail page and attached to emails.
const INVITE_IMAGE_PATH = path.resolve(
  __dirname,
  "../../../frontend/public/faith-wedding.jpeg",
);
const INVITE_IMAGE_EXISTS = fs.existsSync(INVITE_IMAGE_PATH);
if (!INVITE_IMAGE_EXISTS) {
  console.warn("[Email] Invitation image not found at", INVITE_IMAGE_PATH);
}

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Send guest card email with QR code and backup code
 * @param {Object} guest - Guest record
 * @param {string} qrDataUrl - Base64 QR code image
 */
async function sendGuestCardEmail(guest, qrDataUrl, options = {}) {
  const qrContentId = "guest-qr-image";
  const recipientEmail =
    typeof options.recipientEmail === "string" && options.recipientEmail.trim()
      ? options.recipientEmail.trim().toLowerCase()
      : guest.email;
  const fromAddress =
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    "Event Check-In <okwedding2026@techdemystifiedhq.com>";

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[Email] Resend is not configured. Skipping email to",
      recipientEmail,
    );
    return { skipped: true };
  }

  if (!recipientEmail) {
    console.warn("[Email] No recipient email available. Skipping.");
    return { skipped: true };
  }

  const hostsLine = process.env.EVENT_HOSTS || "Onome & Kachi";
  const inviteImageBase64 = INVITE_IMAGE_EXISTS
    ? fs.readFileSync(INVITE_IMAGE_PATH).toString("base64")
    : null;

  const text = `Dear ${guest.name},

You are warmly invited to celebrate our wedding with us.
Please find attached our Church Wedding Invitation Card with ceremony details.
Your personalized QR code access pass is attached to this email and will be required for entry into the reception venue. Kindly download or open the attachment and present it at the entrance.
If your email app does not display the QR code in the message body, please use the attached QR code image instead.

We look forward to celebrating this special day with you!

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
          Your personalized QR code access pass is attached to this email and will be required for entry into the reception venue.
          Kindly download or open the attachment and present it at the entrance.
        </p>
        <p style="margin: 0 0 24px;">
          If your email app does not display the QR code in the message body, please use the attached QR code image instead.
        </p>

        <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <img src="cid:${qrContentId}" alt="Your access barcode" style="width: 220px; height: 220px; display: block; margin: 0 auto 16px;" />
          <p style="color: #333; font-size: 13px; margin: 0 0 8px; font-family: Arial, sans-serif;">If the QR code does not appear above, find it in the attached file named access-pass.png.</p>
          <div style="background: white; border: 2px dashed #6366f1; border-radius: 6px; padding: 12px; display: inline-block; margin-top: 8px;">
            <p style="color: #6366f1; font-weight: bold; font-size: 18px; letter-spacing: 3px; margin: 0; font-family: 'Courier New', monospace;">
              ${guest.backup_code}
            </p>
            <p style="color: #888; font-size: 11px; margin: 4px 0 0; font-family: Arial, sans-serif;">Backup code (if scan fails)</p>
          </div>
        </div>

        <p style="margin: 0 0 4px;">We look forward to celebrating this special day with you!</p>
        <p style="margin: 24px 0 0;">Warm regards,<br><strong>${hostsLine}</strong></p>

        <div style="border-top: 1px solid #eee; margin-top: 24px; padding-top: 16px;">
          <p style="color: #888; font-size: 12px; margin: 0; font-family: Arial, sans-serif;">
            Please do not share this barcode or backup code with anyone outside your invited guests.
          </p>
        </div>
      </div>
    </div>
  `;

  const { data, error } = await getResendClient().emails.send({
    from: fromAddress,
    to: recipientEmail,
    subject: "You're Invited — Wedding Reception Access Pass",
    text,
    html,
    attachments: [
      {
        filename: "access-pass.png",
        content: qrDataUrl.replace(/^data:image\/png;base64,/, ""),
        contentType: "image/png",
        contentId: qrContentId,
      },
      ...(inviteImageBase64
        ? [
            {
              filename: "Church-Wedding-Invitation.jpeg",
              content: inviteImageBase64,
              contentType: "image/jpeg",
            },
          ]
        : []),
    ],
  });

  if (error) {
    throw new Error(error.message || "Failed to send email with Resend");
  }

  console.log(`[Email] Sent invitation to ${recipientEmail}`);
  return { sent: true, recipientEmail, id: data?.id || null };
}

module.exports = { sendGuestCardEmail };
