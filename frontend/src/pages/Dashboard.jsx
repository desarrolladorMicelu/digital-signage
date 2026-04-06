import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

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
    } catch {}
  }

  const cards = [
    { label: 'Sedes', value: stats.venues, color: 'bg-blue-500', link: '/venues' },
    { label: 'Pantallas', value: stats.screens, color: 'bg-purple-500', link: '/screens' },
    { label: 'En línea', value: stats.online, color: 'bg-green-500' },
    { label: 'Fuera de línea', value: stats.offline, color: 'bg-red-500' },
    { label: 'Archivos Media', value: stats.media, color: 'bg-amber-500', link: '/media' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => {
          const content = (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className={`${card.color} text-white text-xs font-bold px-2.5 py-1 rounded-full`}>
                  {card.value}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">{card.label}</p>
            </div>
          );
          return card.link ? (
            <Link key={card.label} to={card.link}>{content}</Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Estado de Pantallas</h3>
        {screens.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay pantallas registradas</p>
        ) : (
          <div className="space-y-3">
            {screens.map((screen) => (
              <Link
                key={screen.id}
                to={`/screens/${screen.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${screen.status === 'online' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <div>
                    <p className="font-medium text-gray-800">{screen.name}</p>
                    <p className="text-xs text-gray-500">
                      {screen.Venue?.name || 'Sin sede'} &middot; {screen.device_id}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  screen.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {screen.status === 'online' ? 'En línea' : 'Fuera de línea'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
