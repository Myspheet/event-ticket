import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CheckCircle2, CircleDot, UserCheck, UserX, ArrowLeft,
  User, Phone, Mail, MapPin, Clock, Users
} from 'lucide-react';

// Unauthenticated fetch using plain axios (no auth interceptor redirect)
const publicApi = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "/api" // dev proxy
      : import.meta.env.VITE_API_URL,
});

function Detail({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-gray-800 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function GuestDetailPage() {
  const { uniqueCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isStaff = user && (user.role === 'admin' || user.role === 'manager');

  const fetchGuest = async () => {
    try {
      if (isStaff) {
        // Authenticated staff get the full record with children detail
        const res = await api.get(`/guests/code/${uniqueCode}`);
        setGuest(res.data);
      } else {
        // Public visitors — no auth required
        const res = await publicApi.get(`/public/guest/${uniqueCode}`);
        setGuest(res.data);
      }
    } catch {
      setError('Guest not found. The link may be invalid or has been removed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGuest(); }, [uniqueCode, isStaff]);

  const handleCheckin = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/guests/${guest.id}/checkin`);
      setGuest(g => ({ ...g, ...res.data }));
      toast.success(`${guest.name} checked in!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/guests/${guest.id}/checkout`);
      setGuest(g => ({ ...g, ...res.data }));
      toast.success(`${guest.name} checked out`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 to-indigo-600 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 to-indigo-600 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CircleDot size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Not Found</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-indigo-600 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {isStaff && (
          <button
            onClick={() => navigate(user.role === 'admin' ? '/admin/checkin' : '/manager/checkin')}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-900 to-indigo-600 px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                {guest.type === 'parent' ? 'Parent Guest' : 'Child Guest'}
              </p>
              <h1 className="text-white font-bold text-xl mt-0.5">{guest.name}</h1>
            </div>
            <div>
              {guest.checked_in ? (
                <div className="flex items-center gap-1.5 bg-white/20 text-white rounded-full px-3 py-1.5 text-xs font-medium">
                  <CheckCircle2 size={14} />Checked In
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/10 text-white/70 rounded-full px-3 py-1.5 text-xs font-medium">
                  <CircleDot size={14} />Pending
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <Detail icon={User} label="Full Name" value={guest.name} />
            <Detail icon={Phone} label="Phone" value={guest.phone} />
            <Detail icon={Mail} label="Email" value={guest.email} />
            <Detail icon={MapPin} label="Seat Number" value={guest.seat_number} />
            {guest.checked_in_at && (
              <Detail icon={Clock} label="Checked In At" value={new Date(guest.checked_in_at).toLocaleString()} />
            )}
            {guest.checked_out_at && (
              <Detail icon={Clock} label="Last Checked Out" value={new Date(guest.checked_out_at).toLocaleString()} />
            )}
          </div>

          {/* Children codes (parent view) */}
          {guest.type === 'parent' && guest.children?.length > 0 && (
            <div className="mx-6 mb-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Linked Children</p>
              </div>
              <div className="space-y-3">
                {guest.children.map(child => (
                  <div key={child.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{child.name}</p>
                      <p className="text-xs font-mono text-blue-600 mt-0.5 tracking-wider">{child.backup_code}</p>
                      {child.seat_number && <p className="text-xs text-gray-400 mt-0.5">Seat: {child.seat_number}</p>}
                    </div>
                    {child.checked_in ? (
                      <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={11} />In</span>
                    ) : (
                      <span className="badge badge-gray">Pending</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-500 mt-3">
                Share the backup codes above with your children for check-in.
              </p>
            </div>
          )}

          {/* Parent info if child */}
          {guest.type === 'child' && guest.parent && (
            <div className="mx-6 mb-4 bg-purple-50 rounded-xl p-3 border border-purple-100 text-sm">
              <p className="text-purple-700 font-medium">Parent: {guest.parent.name}</p>
            </div>
          )}

          {/* Backup code */}
          <div className="mx-6 mb-6">
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-center">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Backup Code</p>
              <p className="text-gray-800 font-bold text-lg tracking-[0.2em] font-mono">{guest.backup_code}</p>
            </div>
          </div>

          {/* Check-in / out for staff */}
          {isStaff && (
            <div className="px-6 pb-6">
              {guest.checked_in ? (
                <button
                  onClick={handleCheckout}
                  disabled={actionLoading}
                  className="btn-warning w-full justify-center py-3 text-base"
                >
                  {actionLoading
                    ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><UserX size={18} />Check Out Guest</>}
                </button>
              ) : (
                <button
                  onClick={handleCheckin}
                  disabled={actionLoading}
                  className="btn-success w-full justify-center py-3 text-base"
                >
                  {actionLoading
                    ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><UserCheck size={18} />Check In Guest</>}
                </button>
              )}
            </div>
          )}

          {!isStaff && (
            <div className="px-6 pb-6">
              <p className="text-xs text-gray-400 text-center">
                Present this page or backup code to staff at the event entrance.
              </p>
            </div>
          )}
        </div>

        <p className="text-white/40 text-xs text-center mt-4">Event Guest Check-In System</p>
      </div>
    </div>
  );
}
