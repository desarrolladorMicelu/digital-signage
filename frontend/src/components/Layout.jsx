import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const SIDEBAR_KEY = 'ds_sidebar_collapsed';

function IconHome({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 004 11h1v6a1 1 0 001 1h3v-4a1 1 0 011-1h2a1 1 0 011 1v4h3a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
    </svg>
  );
}

function IconVenues({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-2a1 1 0 01-1-1v-1H5v1a1 1 0 01-1 1H2a1 1 0 110-2V4zm3 1h2v4H7V5zm8 8v2h2v-2h-2zM5 5v2h2V5H5zm5 0v2h2V5h-2zm5 0h-2v2h2V5zm-5 4h2v4h-2V9zm5 4h2V9h-2v4zM7 9v4h2V9H7z" clipRule="evenodd" />
    </svg>
  );
}

function IconScreens({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
    </svg>
  );
}

function IconMedia({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  );
}

function IconLogout({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  );
}

function IconChevronLeft({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function IconChevronRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', Icon: IconHome },
  { to: '/venues', label: 'Sedes', Icon: IconVenues },
  { to: '/screens', label: 'Pantallas', Icon: IconScreens },
  { to: '/media', label: 'Media', Icon: IconMedia },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return globalThis.localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        globalThis.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`flex shrink-0 flex-col border-r border-gray-800 bg-gray-900 text-white transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[52px]' : 'w-[13.5rem]'
        }`}
      >
        <div className={`flex shrink-0 items-center gap-2 border-b border-gray-800 ${collapsed ? 'flex-col px-1 py-2' : 'px-3 py-3'}`}>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xs font-bold leading-tight tracking-tight text-white" title="Digital Signage Micelu">
                Digital Signage Micelu
              </h1>
              <p className="mt-0.5 text-[10px] text-gray-500">Panel de control</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-800 hover:text-white ${
              collapsed ? '' : 'ml-auto'
            }`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
          >
            {collapsed ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className={`flex-1 space-y-0.5 overflow-y-auto ${collapsed ? 'px-1 py-2' : 'px-2 py-2'}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'
                } ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.Icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-[18px] w-[18px] opacity-90'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`shrink-0 border-t border-gray-800 ${collapsed ? 'px-1 py-2' : 'px-2 py-2'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold uppercase text-gray-300"
                title={user?.username ?? ''}
              >
                {(user?.username ?? '?').slice(0, 1)}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-800 hover:text-red-400"
                title="Salir"
                aria-label="Salir"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-200">{user?.username}</p>
                <p className="truncate text-[10px] text-gray-500">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-gray-400 transition hover:bg-gray-700 hover:text-red-400"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-gray-50 px-4 py-6 sm:px-5 sm:py-7 lg:px-6 lg:py-8">{children}</main>
    </div>
  );
}
