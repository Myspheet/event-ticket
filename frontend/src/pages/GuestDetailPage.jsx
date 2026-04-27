import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  CircleDot,
  UserCheck,
  UserX,
  LogOut,
  RotateCcw,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Users,
  Ban,
} from "lucide-react";
import {
  StatusBadge,
  guestStatus,
  STATUS,
  statusLabel,
} from "../utils/guestStatus";

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
  const isAdmin = user?.role === "admin";

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

  const runAction = async (path, successMsg) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/guests/${guest.id}/${path}`);
      setGuest((g) => ({ ...g, ...res.data }));
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckin = () => runAction("checkin", `${guest.name} checked in!`);
  const handleStepOut = () =>
    runAction("step-out", `${guest.name} stepped out`);
  const handleFinalExit = () => {
    if (
      !window.confirm(
        `Mark ${guest.name} as finally departed? Re-entry will require admin approval.`,
      )
    )
      return;
    runAction("final-exit", `${guest.name} departed`);
  };
  const handleReopen = () =>
    runAction("reopen", `${guest.name} reopened for re-entry`);

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
            onClick={() =>
              navigate(
                user.role === "admin" ? "/admin/checkin" : "/manager/checkin",
              )
            }
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
                {guest.type === "parent" ? "Parent Guest" : "Child Guest"}
              </p>
              <h1 className="text-white font-bold text-xl mt-0.5">
                {guest.name}
              </h1>
            </div>
            <div>
              {(() => {
                const s = guestStatus(guest);
                const map = {
                  [STATUS.INSIDE]: {
                    Icon: CheckCircle2,
                    cls: "bg-white/20 text-white",
                  },
                  [STATUS.STEPPED_OUT]: {
                    Icon: LogOut,
                    cls: "bg-amber-200/30 text-white",
                  },
                  [STATUS.DEPARTED]: {
                    Icon: Ban,
                    cls: "bg-red-200/30 text-white",
                  },
                  [STATUS.PENDING]: {
                    Icon: CircleDot,
                    cls: "bg-white/10 text-white/70",
                  },
                };
                const { Icon, cls } = map[s] || map[STATUS.PENDING];
                return (
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${cls}`}
                  >
                    <Icon size={14} />
                    {statusLabel(s)}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <Detail icon={User} label="Full Name" value={guest.name} />
            <Detail icon={Phone} label="Phone" value={guest.phone} />
            <Detail icon={Mail} label="Email" value={guest.email} />
            <Detail
              icon={MapPin}
              label="Seat Number"
              value={guest.seat_number}
            />
            {guest.checked_in_at && (
              <Detail
                icon={Clock}
                label="Checked In At"
                value={new Date(guest.checked_in_at).toLocaleString()}
              />
            )}
            {guest.checked_out_at && (
              <Detail
                icon={Clock}
                label="Last Checked Out"
                value={new Date(guest.checked_out_at).toLocaleString()}
              />
            )}
          </div>

          {/* Children codes (parent view) */}
          {guest.type === "parent" && guest.children?.length > 0 && (
            <div className="mx-6 mb-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">
                  Linked Children
                </p>
              </div>
              <div className="space-y-3">
                {guest.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 bg-white rounded-lg p-3 border border-blue-100"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">
                        {child.name}
                      </p>
                      {child.backup_code && (
                        <p className="text-xs font-mono text-blue-600 mt-0.5 tracking-wider">
                          {child.backup_code}
                        </p>
                      )}
                      {child.seat_number && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Seat: {child.seat_number}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={guestStatus(child)} />
                  </div>
                ))}
              </div>
              {isStaff && (
                <p className="text-xs text-blue-500 mt-3">
                  Share the backup codes above with your children for check-in.
                </p>
              )}
            </div>
          )}

          {/* Parent info if child */}
          {guest.type === "child" && guest.parent && (
            <div className="mx-6 mb-4 bg-purple-50 rounded-xl p-3 border border-purple-100 text-sm">
              <p className="text-purple-700 font-medium">
                Parent: {guest.parent.name}
              </p>
            </div>
          )}

          {/* Backup code */}
          <div className="mx-6 mb-6">
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-center">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                Backup Code
              </p>
              <p className="text-gray-800 font-bold text-lg tracking-[0.2em] font-mono">
                {guest.backup_code}
              </p>
            </div>
          </div>

          {/* Check-in / out for staff */}
          {isStaff && (
            <div className="px-6 pb-6 space-y-2">
              {(() => {
                const s = guestStatus(guest);
                const spinner = (
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                );
                if (s === STATUS.INSIDE) {
                  return (
                    <>
                      <button
                        onClick={handleStepOut}
                        disabled={actionLoading}
                        className="btn-warning w-full justify-center py-3 text-base"
                      >
                        {actionLoading ? (
                          spinner
                        ) : (
                          <>
                            <LogOut size={18} />
                            Step Out (allow re-entry)
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleFinalExit}
                        disabled={actionLoading}
                        className="btn-danger w-full justify-center py-3 text-base"
                      >
                        {actionLoading ? (
                          spinner
                        ) : (
                          <>
                            <UserX size={18} />
                            Final Exit
                          </>
                        )}
                      </button>
                    </>
                  );
                }
                if (s === STATUS.DEPARTED) {
                  return isAdmin ? (
                    <button
                      onClick={handleReopen}
                      disabled={actionLoading}
                      className="btn-primary w-full justify-center py-3 text-base"
                    >
                      {actionLoading ? (
                        spinner
                      ) : (
                        <>
                          <RotateCcw size={18} />
                          Reopen for Re-entry
                        </>
                      )}
                    </button>
                  ) : (
                    <p className="text-sm text-red-600 text-center">
                      Guest has finally departed. Ask an admin to reopen the
                      pass.
                    </p>
                  );
                }
                return (
                  <button
                    onClick={handleCheckin}
                    disabled={actionLoading}
                    className="btn-success w-full justify-center py-3 text-base"
                  >
                    {actionLoading ? (
                      spinner
                    ) : (
                      <>
                        <UserCheck size={18} />
                        {s === STATUS.STEPPED_OUT
                          ? "Re-enter Guest"
                          : "Check In Guest"}
                      </>
                    )}
                  </button>
                );
              })()}
              {typeof guest.entry_count === "number" && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  Entries so far: {guest.entry_count}
                </p>
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

        <p className="text-white/40 text-xs text-center mt-4">
          Event Guest Check-In System
        </p>
      </div>
    </div>
  );
}
