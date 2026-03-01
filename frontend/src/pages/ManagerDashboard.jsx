import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { Users, UserCheck, CheckCircle2, CircleDot, ChevronRight, QrCode } from 'lucide-react';
import CheckInPanel from './CheckInPanel';

function ManagerOverview() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guests').then(res => setGuests(res.data)).finally(() => setLoading(false));
  }, []);

  const all = guests.flatMap(p => [p, ...(p.children || [])]);
  const total = all.length;
  const checkedIn = all.filter(g => g.checked_in);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Manager Dashboard</h1>
      <p className="text-gray-500 mb-8">Monitor event check-ins and scan guest QR codes.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Guests', value: total, icon: Users, color: 'bg-blue-50 text-blue-600' },
              { label: 'Checked In', value: checkedIn.length, icon: UserCheck, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Not Yet In', value: total - checkedIn.length, icon: CircleDot, color: 'bg-gray-50 text-gray-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon size={22} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link to="/manager/checkin" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group">
                  <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <QrCode size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">Check In / Out Guests</p>
                    <p className="text-xs text-gray-400">Scan QR code or enter backup code</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </Link>
                <Link to="/manager/guests" className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">View Guest List</p>
                    <p className="text-xs text-gray-400">See all guests and their statuses</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </Link>
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">
                Recently Checked In
                <span className="ml-2 badge badge-green">{checkedIn.length}</span>
              </h2>
              {checkedIn.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No guests checked in yet.</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {[...checkedIn].sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at)).slice(0, 8).map(g => (
                    <li key={g.id} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">{g.name}</span>
                      {g.checked_in_at && (
                        <span className="text-xs text-gray-400 ml-auto">{new Date(g.checked_in_at).toLocaleTimeString()}</span>
                      )}
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

// Read-only guest list for manager
function ManagerGuestList() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/guests').then(res => setGuests(res.data)).finally(() => setLoading(false));
  }, []);

  const all = guests.flatMap(p => [p, ...(p.children || [])]);
  const filtered = search.trim()
    ? all.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || (g.email || '').toLowerCase().includes(search.toLowerCase()))
    : all;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Guest List</h1>
        <input
          type="text"
          className="input w-60"
          placeholder="Search guests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Name', 'Phone', 'Email', 'Seat', 'Type', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No guests found.</td></tr>
                ) : filtered.map(g => (
                  <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-sm text-gray-800">{g.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{g.phone || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{g.email || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{g.seat_number || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${g.type === 'parent' ? 'badge-purple' : 'badge-blue'}`}>{g.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      {g.checked_in
                        ? <span className="badge badge-green flex items-center gap-1 w-fit"><CheckCircle2 size={12} />Checked In</span>
                        : <span className="badge badge-gray flex items-center gap-1 w-fit"><CircleDot size={12} />Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<ManagerOverview />} />
      <Route path="/guests" element={<ManagerGuestList />} />
      <Route path="/checkin" element={<CheckInPanel />} />
    </Routes>
  );
}
