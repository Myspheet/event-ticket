import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Users,
  UserCheck,
  UserPlus,
  Pencil,
  Trash2,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  UserX,
  LogOut,
  RotateCcw,
  CheckCircle2,
  CircleDot,
  LayoutDashboard,
} from "lucide-react";
import GuestCard from '../components/GuestCard';
import GuestFormModal from '../components/GuestFormModal';
import ConfirmModal from '../components/ConfirmModal';
import CheckInPanel from './CheckInPanel';
import { StatusBadge, guestStatus, STATUS } from "../utils/guestStatus";

// ─── Stats cards ────────────────────────────────────────────
function StatsBar({ guests }) {
  const all = guests.flatMap(p => [p, ...(p.children || [])]);
  const total = all.length;
  const inside = all.filter((g) => guestStatus(g) === STATUS.INSIDE).length;
  const parents = guests.length;
  const children = all.filter(g => g.type === 'child').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        {
          label: "Total Guests",
          value: total,
          icon: Users,
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: "Currently Inside",
          value: inside,
          icon: UserCheck,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Parents",
          value: parents,
          icon: Users,
          color: "bg-purple-50 text-purple-600",
        },
        {
          label: "Children",
          value: children,
          icon: Users,
          color: "bg-amber-50 text-amber-600",
        },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="card flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
          >
            <Icon size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Guest row ────────────────────────────────────────────────
function GuestRow({
  guest,
  depth = 0,
  onViewCard,
  onEdit,
  onDelete,
  onCheckin,
  onStepOut,
  onFinalExit,
  onReopen,
  onAddChild,
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = guest.children?.length > 0;
  const isParent = guest.type === "parent";
  const status = guestStatus(guest);

  const statusActions = (() => {
    if (status === STATUS.INSIDE) {
      return (
        <>
          <button
            onClick={() => onStepOut(guest)}
            className="btn-warning text-xs py-1 px-2"
            title="Step out (allow re-entry)"
          >
            <LogOut size={12} />
            Step
          </button>
          <button
            onClick={() => onFinalExit(guest)}
            className="btn-danger text-xs py-1 px-2"
            title="Final exit (no re-entry without admin)"
          >
            <UserX size={12} />
            Exit
          </button>
        </>
      );
    }
    if (status === STATUS.DEPARTED) {
      return (
        <button
          onClick={() => onReopen(guest)}
          className="btn-primary text-xs py-1 px-2"
          title="Reopen pass for re-entry"
        >
          <RotateCcw size={12} />
          Reopen
        </button>
      );
    }
    return (
      <button
        onClick={() => onCheckin(guest)}
        className="btn-success text-xs py-1 px-2"
      >
        <UserCheck size={12} />
        {status === STATUS.STEPPED_OUT ? "Re-enter" : "In"}
      </button>
    );
  })();

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${depth > 0 ? "bg-blue-50/30" : ""}`}
      >
        <td className="py-3 px-4">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: depth * 24 }}
          >
            {isParent && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {hasChildren ? (
                  expanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )
                ) : (
                  <span className="w-3.5 inline-block" />
                )}
              </button>
            )}
            {!isParent && <span className="w-5 inline-block" />}
            <div>
              <p className="font-medium text-gray-800 text-sm">{guest.name}</p>
              {guest.email && (
                <p className="text-xs text-gray-400">{guest.email}</p>
              )}
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-gray-500">
          {guest.phone || "—"}
        </td>
        <td className="py-3 px-4 text-sm text-gray-500">
          {guest.seat_number || "—"}
        </td>
        <td className="py-3 px-4">
          <span className={`badge ${isParent ? "badge-purple" : "badge-blue"}`}>
            {isParent ? "Parent" : "Child"}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {(guest.entry_count ?? 0) > 0 && (
              <span className="text-xs text-gray-400">
                ×{guest.entry_count}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => onViewCard(guest)}
              className="btn-secondary text-xs py-1 px-2"
            >
              <CreditCard size={12} />
              Card
            </button>
            {statusActions}
            <button
              onClick={() => onEdit(guest)}
              className="btn-secondary text-xs py-1 px-2"
            >
              <Pencil size={12} />
            </button>
            {isParent && (
              <button
                onClick={() => onAddChild(guest)}
                className="btn-secondary text-xs py-1 px-2 text-primary-600"
              >
                <UserPlus size={12} />
              </button>
            )}
            <button
              onClick={() => onDelete(guest)}
              className="btn-danger text-xs py-1 px-2"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
      {isParent &&
        expanded &&
        hasChildren &&
        guest.children.map((child) => (
          <GuestRow
            key={child.id}
            guest={child}
            depth={depth + 1}
            onViewCard={onViewCard}
            onEdit={onEdit}
            onDelete={onDelete}
            onCheckin={onCheckin}
            onStepOut={onStepOut}
            onFinalExit={onFinalExit}
            onReopen={onReopen}
            onAddChild={onAddChild}
          />
        ))}
    </>
  );
}

// ─── Guest List view ──────────────────────────────────────────
function GuestListView() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cardGuest, setCardGuest] = useState(null);
  const [formModal, setFormModal] = useState(null); // { mode, guest?, parentId? }
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/guests');
      setGuests(res.data);
    } catch {
      toast.error('Failed to load guests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const handleCheckin = async (guest) => {
    try {
      await api.post(`/guests/${guest.id}/checkin`);
      toast.success(`${guest.name} checked in`);
      fetchGuests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to check in');
    }
  };

  const handleStepOut = async (guest) => {
    try {
      await api.post(`/guests/${guest.id}/step-out`);
      toast.success(`${guest.name} stepped out`);
      fetchGuests();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to step out");
    }
  };

  const handleFinalExit = (guest) => {
    setConfirmModal({
      message: `Mark ${guest.name} as finally departed? Re-entry will require admin approval.`,
      onConfirm: async () => {
        try {
          await api.post(`/guests/${guest.id}/final-exit`);
          toast.success(`${guest.name} departed`);
          fetchGuests();
        } catch (err) {
          toast.error(err.response?.data?.error || "Failed to mark departed");
        }
      },
    });
  };

  const handleReopen = async (guest) => {
    try {
      await api.post(`/guests/${guest.id}/reopen`);
      toast.success(`${guest.name} reopened for re-entry`);
      fetchGuests();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reopen");
    }
  };

  const handleDelete = (guest) => {
    setConfirmModal({
      message: `Delete ${guest.name}? ${guest.type === 'parent' ? 'This will also delete all linked children.' : ''}`,
      onConfirm: async () => {
        try {
          await api.delete(`/guests/${guest.id}`);
          toast.success('Guest deleted');
          fetchGuests();
        } catch {
          toast.error('Failed to delete');
        }
      },
    });
  };

  const handleFormSuccess = (newGuest) => {
    setFormModal(null);
    fetchGuests();
    // Show card for newly created guest
    if (formModal?.mode !== 'edit') {
      setCardGuest(newGuest);
    }
  };

  const filteredGuests = search.trim()
    ? guests.filter(p => {
        const q = search.toLowerCase();
        const matchParent = p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.phone || '').includes(q);
        const matchChild = (p.children || []).some(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
        return matchParent || matchChild;
      })
    : guests;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Guest List</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              className="input pl-9 w-60"
              placeholder="Search guests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={fetchGuests} className="btn-secondary">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setFormModal({ mode: "add-parent" })}
            className="btn-primary"
          >
            <UserPlus size={16} />
            Add Parent
          </button>
        </div>
      </div>

      <StatsBar guests={guests} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filteredGuests.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {search ? "No guests match your search" : "No guests yet"}
          </p>
          {!search && (
            <button
              onClick={() => setFormModal({ mode: "add-parent" })}
              className="btn-primary mt-4 mx-auto"
            >
              <UserPlus size={15} /> Add First Guest
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Seat
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <GuestRow
                    key={guest.id}
                    guest={guest}
                    onViewCard={setCardGuest}
                    onEdit={(g) => setFormModal({ mode: "edit", guest: g })}
                    onDelete={handleDelete}
                    onCheckin={handleCheckin}
                    onStepOut={handleStepOut}
                    onFinalExit={handleFinalExit}
                    onReopen={handleReopen}
                    onAddChild={(g) =>
                      setFormModal({ mode: "add-child", parentId: g.id })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {cardGuest && (
        <GuestCard guest={cardGuest} onClose={() => setCardGuest(null)} />
      )}
      {formModal && (
        <GuestFormModal
          mode={formModal.mode}
          guest={formModal.guest}
          parentId={formModal.parentId}
          onClose={() => setFormModal(null)}
          onSuccess={handleFormSuccess}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// ─── Admin Overview Dashboard ─────────────────────────────────
function AdminOverview() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guests').then(res => setGuests(res.data)).finally(() => setLoading(false));
  }, []);

  const all = guests.flatMap(p => [p, ...(p.children || [])]);
  const checkedIn = all.filter((g) => guestStatus(g) === STATUS.INSIDE);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
      <p className="text-gray-500 mb-8">Welcome back! Here's a snapshot of the event.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <StatsBar guests={guests} />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick actions */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link to="/admin/guests" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all group">
                  <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                    <Users size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">Manage Guests</p>
                    <p className="text-xs text-gray-400">Add, edit, or remove guests</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </Link>
                <Link to="/admin/checkin" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group">
                  <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <UserCheck size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">Check In / Out</p>
                    <p className="text-xs text-gray-400">Scan QR or enter backup code</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </Link>
              </div>
            </div>

            {/* Recently checked in */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">
                Recently Checked In
                <span className="ml-2 badge badge-green">{checkedIn.length}</span>
              </h2>
              {checkedIn.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No guests checked in yet.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {[...checkedIn].sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at)).slice(0, 10).map(g => (
                    <li key={g.id} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">{g.name}</p>
                        {g.checked_in_at && (
                          <p className="text-xs text-gray-400">{new Date(g.checked_in_at).toLocaleTimeString()}</p>
                        )}
                      </div>
                      <span className={`ml-auto badge ${g.type === 'parent' ? 'badge-purple' : 'badge-blue'}`}>{g.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Router wrapper ─────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminOverview />} />
      <Route path="/guests" element={<GuestListView />} />
      <Route path="/checkin" element={<CheckInPanel />} />
    </Routes>
  );
}
