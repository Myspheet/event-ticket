import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function GuestCard({ guest, onClose }) {
  const cardRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  React.useEffect(() => {
    if (guest) {
      setLoadingQr(true);
      api.get(`/guests/${guest.id}/qr`)
        .then(res => setQrDataUrl(res.data.qr_data_url))
        .catch(() => toast.error('Failed to load QR code'))
        .finally(() => setLoadingQr(false));
    }
  }, [guest?.id]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `guest-card-${guest.name.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Card downloaded!');
    } catch (err) {
      toast.error('Failed to download card');
    }
  };

  if (!guest) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Guest Card</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="btn-primary text-xs py-1.5 px-3">
              <Download size={14} />
              Download PNG
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* The downloadable card */}
        <div className="p-6">
          <div
            ref={cardRef}
            style={{ fontFamily: 'Arial, sans-serif' }}
            className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden"
          >
            {/* Card header */}
            <div className="bg-gradient-to-r from-primary-900 to-indigo-600 px-6 py-4 text-center">
              <p className="text-white/80 text-xs font-medium uppercase tracking-widest">Event Guest Pass</p>
              <p className="text-white font-bold text-lg mt-0.5">
                {guest.type === 'parent' ? 'PARENT' : 'CHILD'}
              </p>
            </div>

            {/* QR code */}
            <div className="px-6 pt-6 pb-4 flex flex-col items-center">
              {loadingQr ? (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                </div>
              ) : qrDataUrl ? (
                <div className="p-3 bg-white border-2 border-gray-100 rounded-xl shadow-sm">
                  <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 block" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                  QR unavailable
                </div>
              )}

              <p className="text-gray-500 text-xs mt-3 text-center">Scan QR code to view guest details</p>
            </div>

            {/* Backup code */}
            <div className="mx-6 mb-6 bg-primary-50 border-2 border-dashed border-primary-300 rounded-xl px-4 py-3 text-center">
              <p className="text-primary-600 text-xs font-medium uppercase tracking-wider mb-1">Backup Code</p>
              <p className="text-primary-900 font-bold text-xl tracking-[0.25em]">
                {guest.backup_code}
              </p>
              <p className="text-primary-500 text-xs mt-1">Use if QR code doesn't scan</p>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-3 text-center border-t border-gray-100">
              <p className="text-gray-400 text-xs">Do not share this code with unauthorized individuals</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
