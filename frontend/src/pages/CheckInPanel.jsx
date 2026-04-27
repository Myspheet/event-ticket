import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  LogOut,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, guestStatus, STATUS } from "../utils/guestStatus";

export default function CheckInPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkedInList, setCheckedInList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const inputRef = useRef(null);

  const fetchCheckedIn = async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/guests/checked-in');
      setCheckedInList(res.data);
    } catch {
      // silently fail
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchCheckedIn(); }, []);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lookupGuest = async (lookupCode) => {
    const c = lookupCode.trim();
    if (!c) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/guests/backup/${c}`);
      setResult({ guest: res.data, error: null });
    } catch (err) {
      const msg = err.response?.data?.error || 'Guest not found';
      setResult({ guest: null, error: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    lookupGuest(code);
  };

  const runAction = async (path, successMsg) => {
    try {
      const res = await api.post(`/guests/${result.guest.id}/${path}`);
      setResult((r) => ({ ...r, guest: res.data }));
      toast.success(successMsg);
      fetchCheckedIn();
    } catch (err) {
      toast.error(err.response?.data?.error || "Action failed");
    }
  };

  const handleCheckin = () =>
    runAction("checkin", `${result.guest.name} checked in!`);
  const handleStepOut = () =>
    runAction("step-out", `${result.guest.name} stepped out`);
  const handleFinalExit = () => {
    if (
      !window.confirm(
        `Mark ${result.guest.name} as finally departed? Re-entry will require admin approval.`,
      )
    )
      return;
    runAction("final-exit", `${result.guest.name} departed`);
  };
  const handleReopen = () =>
    runAction("reopen", `${result.guest.name} reopened for re-entry`);

  const clearResult = () => {
    setResult(null);
    setCode('');
    inputRef.current?.focus();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Check In / Check Out
      </h1>
      <p className="text-gray-500 mb-8">
        Scan a QR code or enter a backup code below to check in or check out a
        guest.
      </p>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Left: scan input + result */}
        <div className="md:col-span-3 space-y-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <QrCode size={20} className="text-primary-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">
                  Scan or Enter Code
                </h2>
                <p className="text-xs text-gray-400">
                  QR codes will auto-fill this field when scanned
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  ref={inputRef}
                  type="text"
                  className="input pl-9 font-mono tracking-wider"
                  placeholder="Enter QR code or backup code..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="btn-primary px-5"
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Lookup"
                )}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-2">
              Tip: If using a QR scanner connected as keyboard input, scan and
              it will auto-submit.
            </p>
          </div>

          {/* Result card */}
          {result && (
            <div
              className={`card border-2 ${result.error ? "border-red-200 bg-red-50" : "border-emerald-200"}`}
            >
              {result.error ? (
                <div className="flex items-center gap-3 text-red-700">
                  <XCircle size={24} className="flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Not Found</p>
                    <p className="text-sm text-red-500">{result.error}</p>
                  </div>
                  <button
                    onClick={clearResult}
                    className="ml-auto btn-secondary text-xs"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {result.guest.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={guestStatus(result.guest)} />
                        <span
                          className={`badge ${result.guest.type === "parent" ? "badge-purple" : "badge-blue"}`}
                        >
                          {result.guest.type}
                        </span>
                        {typeof result.guest.entry_count === "number" && (
                          <span className="badge badge-gray">
                            Entries: {result.guest.entry_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={clearResult}
                      className="btn-secondary text-xs"
                    >
                      Clear
                    </button>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5">
                    {result.guest.email && (
                      <>
                        <dt className="text-gray-500 font-medium">Email</dt>
                        <dd className="text-gray-700">{result.guest.email}</dd>
                      </>
                    )}
                    {result.guest.phone && (
                      <>
                        <dt className="text-gray-500 font-medium">Phone</dt>
                        <dd className="text-gray-700">{result.guest.phone}</dd>
                      </>
                    )}
                    {result.guest.seat_number && (
                      <>
                        <dt className="text-gray-500 font-medium">Seat</dt>
                        <dd className="text-gray-700">
                          {result.guest.seat_number}
                        </dd>
                      </>
                    )}
                    {result.guest.checked_in_at && (
                      <>
                        <dt className="text-gray-500 font-medium">
                          Checked In At
                        </dt>
                        <dd className="text-gray-700">
                          {new Date(
                            result.guest.checked_in_at,
                          ).toLocaleString()}
                        </dd>
                      </>
                    )}
                    {result.guest.checked_out_at && (
                      <>
                        <dt className="text-gray-500 font-medium">
                          Checked Out At
                        </dt>
                        <dd className="text-gray-700">
                          {new Date(
                            result.guest.checked_out_at,
                          ).toLocaleString()}
                        </dd>
                      </>
                    )}
                  </dl>

                  {/* Children's codes if parent */}
                  {result.guest.type === "parent" &&
                    result.guest.children?.length > 0 && (
                      <div className="bg-blue-50 rounded-xl p-4 mb-5">
                        <p className="text-sm font-semibold text-blue-800 mb-2">
                          Linked Children
                        </p>
                        <div className="space-y-2">
                          {result.guest.children.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-3 text-sm"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">
                                  {child.name}
                                </p>
                                {child.backup_code && (
                                  <p className="text-xs font-mono text-blue-600">
                                    {child.backup_code}
                                  </p>
                                )}
                              </div>
                              <StatusBadge status={guestStatus(child)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const s = guestStatus(result.guest);
                      if (s === STATUS.INSIDE) {
                        return (
                          <>
                            <button
                              onClick={handleStepOut}
                              className="btn-warning flex-1 justify-center"
                            >
                              <LogOut size={16} />
                              Step Out
                            </button>
                            <button
                              onClick={handleFinalExit}
                              className="btn-danger flex-1 justify-center"
                            >
                              <UserX size={16} />
                              Final Exit
                            </button>
                          </>
                        );
                      }
                      if (s === STATUS.DEPARTED) {
                        return isAdmin ? (
                          <button
                            onClick={handleReopen}
                            className="btn-primary flex-1 justify-center"
                          >
                            <RotateCcw size={16} />
                            Reopen for Re-entry
                          </button>
                        ) : (
                          <p className="text-sm text-red-600 flex-1">
                            Guest has finally departed. Ask an admin to reopen
                            the pass.
                          </p>
                        );
                      }
                      // pending or stepped_out
                      return (
                        <button
                          onClick={handleCheckin}
                          className="btn-success flex-1 justify-center"
                        >
                          <UserCheck size={16} />
                          {s === STATUS.STEPPED_OUT ? "Re-enter" : "Check In"}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: checked-in list */}
        <div className="md:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Checked In
                <span className="ml-2 badge badge-green">
                  {checkedInList.length}
                </span>
              </h2>
              <button
                onClick={fetchCheckedIn}
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {loadingList ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              </div>
            ) : checkedInList.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                No guests checked in yet.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[500px] overflow-y-auto">
                {checkedInList.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg text-sm"
                  >
                    <div
                      className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"
                      title={`Status: ${guestStatus(g)}`}
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">
                        {g.name}
                      </p>
                      {g.checked_in_at && (
                        <p className="text-xs text-gray-400">
                          {new Date(g.checked_in_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <span
                      className={`badge flex-shrink-0 ${g.type === "parent" ? "badge-purple" : "badge-blue"}`}
                    >
                      {g.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
