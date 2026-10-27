import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Plus } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../../context/AuthContext';

const link = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-ink'
  }`;

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.name ? user.name[0].toUpperCase() : 'U';

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 px-2.5 sm:px-4 pt-2.5 sm:pt-4">
        <div className="glass shadow-glass rounded-full pl-4 pr-2 h-14 flex items-center justify-between gap-3 border border-white/80">
          <Logo to="/dashboard" />
          <nav className="hidden sm:flex items-center gap-1.5" aria-label="Main">
            <NavLink to="/dashboard" className={link}>Claims</NavLink>
            {user?.role === 'admin' && <NavLink to="/admin" className={link}>Rules Engine</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            <NavLink to="/cases/new" className="btn-primary h-10 px-4 shadow-sm" aria-label="New claim">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New claim</span>
            </NavLink>
            <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-line/60 ml-1">
              <span
                className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white font-semibold text-xs grid place-items-center shadow-sm"
                title={user?.email || ''}
              >
                {initial}
              </span>
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="h-10 w-10 grid place-items-center rounded-full hover:bg-white text-steel hover:text-ink transition"
              aria-label="Log out"
              title={`Log out ${user?.email || ''}`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="px-2.5 sm:px-4 pb-16 pt-6 max-w-[1240px] mx-auto">{children}</main>
    </div>
  );
}
