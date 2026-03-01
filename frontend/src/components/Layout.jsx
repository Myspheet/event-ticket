import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, CheckSquare, LayoutDashboard, QrCode } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const basePath = isAdmin ? '/admin' : '/manager';

  const navLinks = isAdmin
    ? [
        { to: `${basePath}`, label: 'Dashboard', icon: LayoutDashboard },
        { to: `${basePath}/guests`, label: 'Guest List', icon: Users },
        { to: `${basePath}/checkin`, label: 'Check In/Out', icon: CheckSquare },
      ]
    : [
        { to: `${basePath}`, label: 'Dashboard', icon: LayoutDashboard },
        { to: `${basePath}/guests`, label: 'Guest List', icon: Users },
        { to: `${basePath}/checkin`, label: 'Check In/Out', icon: QrCode },
      ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-primary-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg tracking-tight">
              Event Check-In
            </span>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || (to !== basePath && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-white/60 text-xs uppercase tracking-wider mr-1">{user?.role}</span>
              <span className="font-medium">{user?.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="md:hidden bg-primary-800 text-white px-4 py-2 flex gap-1 overflow-x-auto">
        {navLinks.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== basePath && location.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
