import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const statCards = [
  { label: 'Sedes', statKey: 'venues', color: 'blue', link: '/venues' },
  { label: 'Pantallas', statKey: 'screens', color: 'violet', link: '/screens' },
  { label: 'En línea', statKey: 'online', color: 'emerald', link: null },
  { label: 'Fuera de línea', statKey: 'offline', color: 'rose', link: null },
  { label: 'Archivos media', statKey: 'media', color: 'amber', link: '/media' },
];

const colorStyles = {
  blue: 'bg-blue-500 text-white shadow-blue-500/25',
  violet: 'bg-violet-500 text-white shadow-violet-500/25',
  emerald: 'bg-emerald-500 text-white shadow-emerald-500/25',
  rose: 'bg-rose-500 text-white shadow-rose-500/25',
  amber: 'bg-amber-500 text-white shadow-amber-500/25',
};

export default function Dashboard() {
  const [stats, setStats] = useState({ venues: 0, screens: 0, online: 0, offline: 0, media: 0 });
  const [screens, setScreens] = useState([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [venuesRes, screensRes, mediaRes] = await Promise.all([
        api.get('/venues'),
        api.get('/screens'),
        api.get('/media'),
      ]);
      const scr = screensRes.data;
      setScreens(scr);
      setStats({
        venues: venuesRes.data.length,
        screens: scr.length,
        online: scr.filter((s) => s.status === 'online').length,
        offline: scr.filter((s) => s.status !== 'online').length,
        media: mediaRes.data.length,
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">Resumen y estado de tus pantallas</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {statCards.map((card) => {
          const value = stats[card.statKey];
          const chipClass = colorStyles[card.color];
          const body = (
            <div className="flex h-full min-h-[5.5rem] flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-3 shadow-sm transition group-hover:border-indigo-200 group-hover:shadow-md sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-md sm:h-10 sm:w-10 ${chipClass}`}
              >
                {value}
              </div>
              <p
                className="mt-2 truncate text-[11px] font-semibold leading-tight text-gray-600 sm:mt-0 sm:min-w-0 sm:flex-1 sm:text-xs sm:whitespace-normal"
                title={card.label}
              >
                {card.label}
              </p>
            </div>
          );

          if (card.link) {
            return (
              <Link key={card.label} to={card.link} className="group block outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-2xl">
                {body}
              </Link>
            );
          }

          return (
            <div key={card.label} className="group block rounded-2xl">
              {body}
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">Estado de pantallas</h3>
          <p className="mt-0.5 text-xs text-gray-500">Pulsa una fila para abrir el detalle</p>
        </div>
        {screens.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">No hay pantallas registradas</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {screens.map((screen) => {
              const online = screen.status === 'online';
              return (
                <li key={screen.id}>
                  <Link
                    to={`/screens/${screen.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-indigo-50/40 sm:gap-4 sm:px-5"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white ${
                        online ? 'bg-emerald-500 ring-emerald-500/30' : 'bg-rose-500 ring-rose-500/30'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{screen.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {screen.Venue?.name || 'Sin sede'} <span className="text-gray-300">&middot;</span> {screen.device_id}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold tabular-nums ring-1 ${
                        online
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/15'
                          : 'bg-rose-50 text-rose-800 ring-rose-600/15'
                      }`}
                    >
                      {online ? 'En línea' : 'Fuera de línea'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
