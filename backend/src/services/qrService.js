const QRCode = require('qrcode');

/**
 * Generates a QR code as a base64 data URL
 * @param {string} url - The URL to encode in the QR code
 * @returns {Promise<string>} base64 data URL (image/png)
 */
async function generateQRCodeDataUrl(url) {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    width: 300,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  return dataUrl;
}

/**
 * Generates a QR code as a Buffer
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function generateQRCodeBuffer(url) {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    width: 300,
  });
}

module.exports = { generateQRCodeDataUrl, generateQRCodeBuffer };
