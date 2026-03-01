import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ message, onConfirm, onClose, danger = true }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 mb-1">Confirm Action</h3>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 justify-center ${danger ? 'btn-danger' : 'btn-warning'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
