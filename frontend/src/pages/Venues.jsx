import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Venues() {
  const [venues, setVenues] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', description: '' });

  useEffect(() => { loadVenues(); }, []);

  async function loadVenues() {
    try {
      const { data } = await api.get('/venues');
      setVenues(data);
    } catch { toast.error('Error cargando sedes'); }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', address: '', description: '' });
    setShowModal(true);
  }

  function openEdit(venue) {
    setEditing(venue);
    setForm({ name: venue.name, address: venue.address || '', description: venue.description || '' });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/venues/${editing.id}`, form);
        toast.success('Sede actualizada');
      } else {
        await api.post('/venues', form);
        toast.success('Sede creada');
      }
      setShowModal(false);
      loadVenues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta sede? Se eliminarán sus pantallas asociadas.')) return;
    try {
      await api.delete(`/venues/${id}`);
      toast.success('Sede eliminada');
      loadVenues();
    } catch { toast.error('Error eliminando sede'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Sedes</h2>
        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nueva Sede
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <p className="text-gray-500">No hay sedes registradas</p>
          <button onClick={openCreate} className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
            Crear primera sede
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <div key={venue.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{venue.name}</h3>
                  {venue.address && <p className="text-sm text-gray-500 mt-1">{venue.address}</p>}
                </div>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
                  {venue.screenCount || 0} pantallas
                </span>
              </div>
              {venue.description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{venue.description}</p>}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(venue)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Editar
                </button>
                <button onClick={() => handleDelete(venue.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editing ? 'Editar Sede' : 'Nueva Sede'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.description} rows={3}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
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
