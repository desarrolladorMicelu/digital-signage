import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

export default function Screens() {
  const [screens, setScreens] = useState([]);
  const [venues, setVenues] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', device_id: '', venue_id: '', orientation: 'landscape' });

  useEffect(() => {
    loadScreens();
    loadVenues();
    const interval = setInterval(loadScreens, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadScreens() {
    try {
      const { data } = await api.get('/screens');
      setScreens(data);
    } catch { toast.error('Error cargando pantallas'); }
  }

  async function loadVenues() {
    try {
      const { data } = await api.get('/venues');
      setVenues(data);
    } catch {}
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', device_id: '', venue_id: venues[0]?.id || '', orientation: 'landscape' });
    setShowModal(true);
  }

  function openEdit(screen) {
    setEditing(screen);
    setForm({
      name: screen.name,
      device_id: screen.device_id,
      venue_id: screen.venue_id || '',
      orientation: screen.orientation || 'landscape',
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, venue_id: form.venue_id || null };
      if (editing) {
        await api.put(`/screens/${editing.id}`, payload);
        toast.success('Pantalla actualizada');
      } else {
        await api.post('/screens', payload);
        toast.success('Pantalla creada');
      }
      setShowModal(false);
      loadScreens();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta pantalla?')) return;
    try {
      await api.delete(`/screens/${id}`);
      toast.success('Pantalla eliminada');
      loadScreens();
    } catch { toast.error('Error eliminando pantalla'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Pantallas</h2>
        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nueva Pantalla
        </button>
      </div>

      {screens.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <p className="text-gray-500">No hay pantallas registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pantalla</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sede</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {screens.map((screen) => (
                <tr key={screen.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/screens/${screen.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">
                      {screen.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{screen.Venue?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{screen.device_id}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      screen.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${screen.status === 'online' ? 'bg-green-500' : 'bg-red-400'}`} />
                      {screen.status === 'online' ? 'En línea' : 'Fuera de línea'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link to={`/screens/${screen.id}`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      Ver
                    </Link>
                    <button onClick={() => openEdit(screen)} className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(screen.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editing ? 'Editar Pantalla' : 'Nueva Pantalla'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID *</label>
                <input
                  type="text" required value={form.device_id}
                  onChange={(e) => setForm({ ...form, device_id: e.target.value })}
                  placeholder="screen-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono"
                  disabled={!!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
                <select
                  value={form.venue_id}
                  onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="">Sin sede</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orientación</label>
                <select
                  value={form.orientation}
                  onChange={(e) => setForm({ ...form, orientation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="landscape">Horizontal</option>
                  <option value="portrait">Vertical</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  {editing ? 'Guardar' : 'Crear'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
