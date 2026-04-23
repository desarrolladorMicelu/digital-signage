import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

function IconEye({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}

function IconPencil({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function IconTrash({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

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
    } catch {
      toast.error('Error cargando pantallas');
    }
  }

  async function loadVenues() {
    try {
      const { data } = await api.get('/venues');
      setVenues(data);
    } catch {
      /* ignore */
    }
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
    } catch {
      toast.error('Error eliminando pantalla');
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Pantallas</h2>
          <p className="mt-1 text-sm text-gray-500">Gestiona dispositivos y su sede asignada</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Nueva pantalla
        </button>
      </div>

      {screens.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-gray-500">No hay pantallas registradas</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-gray-900">Listado</h3>
            <p className="mt-0.5 text-xs text-gray-500">{screens.length} pantalla{screens.length === 1 ? '' : 's'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 sm:px-5">Pantalla</th>
                  <th className="px-4 py-2.5 sm:px-5">Sede</th>
                  <th className="px-4 py-2.5 sm:px-5">Device ID</th>
                  <th className="px-4 py-2.5 sm:px-5">Estado</th>
                  <th className="px-4 py-2.5 text-right sm:px-5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {screens.map((screen) => {
                  const online = screen.status === 'online';
                  return (
                    <tr key={screen.id} className="transition hover:bg-indigo-50/35">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          to={`/screens/${screen.id}`}
                          className="font-semibold text-indigo-700 transition hover:text-indigo-900"
                        >
                          <span className="line-clamp-2">{screen.name}</span>
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-gray-600 sm:max-w-none sm:px-5">
                        {screen.Venue?.name || '—'}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <code className="rounded-md bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-800 ring-1 ring-gray-100">
                          {screen.device_id}
                        </code>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex shrink-0 flex-nowrap items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                            online
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/15'
                              : 'bg-rose-50 text-rose-800 ring-rose-600/15'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            aria-hidden
                          />
                          {online ? 'En línea' : 'Fuera de línea'}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            to={`/screens/${screen.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-indigo-100 hover:text-indigo-700"
                            title="Ver detalle"
                            aria-label="Ver detalle"
                          >
                            <IconEye />
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEdit(screen)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-200 hover:text-gray-900"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <IconPencil />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(screen.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar pantalla' : 'Nueva pantalla'}
              </h3>
              {editing && (
                <p className="mt-0.5 text-xs text-gray-500">El Device ID no se puede cambiar al editar</p>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div>
                <label htmlFor="screen-form-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Nombre *</label>
                <input
                  id="screen-form-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="screen-form-device" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Device ID *</label>
                <input
                  id="screen-form-device"
                  type="text"
                  required
                  value={form.device_id}
                  onChange={(e) => setForm({ ...form, device_id: e.target.value })}
                  placeholder="screen-001"
                  disabled={!!editing}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </div>
              <div>
                <label htmlFor="screen-form-venue" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Sede</label>
                <select
                  id="screen-form-venue"
                  value={form.venue_id}
                  onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Sin sede</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="screen-form-orientation" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Orientación</label>
                <select
                  id="screen-form-orientation"
                  value={form.orientation}
                  onChange={(e) => setForm({ ...form, orientation: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="landscape">Horizontal</option>
                  <option value="portrait">Vertical</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  {editing ? 'Guardar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
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
