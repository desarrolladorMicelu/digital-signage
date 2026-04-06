import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

const log = (...args) => console.log('[ScreenDetail]', ...args);

/** Con alias explícito `as: 'ScreenMedia'`, Sequelize devuelve exactamente esa clave. */
function getScreenMediaRows(data) {
  if (!data || typeof data !== 'object') return [];
  // Busca cualquier variante por si acaso
  const rows = data.ScreenMedia ?? data.ScreenMedias ?? data.screenMedia ?? data.screenMedias;
  if (Array.isArray(rows)) {
    log('getScreenMediaRows encontró', rows.length, 'filas');
    return rows;
  }
  log('getScreenMediaRows: clave no encontrada. Keys:', Object.keys(data));
  return [];
}

export default function ScreenDetail() {
  const { id } = useParams();
  const [screen, setScreen] = useState(null);
  const [allMedia, setAllMedia] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Evita que el polling borre la playlist antes de guardar */
  const playlistDirtyRef = useRef(false);

  useEffect(() => {
    playlistDirtyRef.current = false;
    loadScreen({ initial: true });
    loadAllMedia();
    const interval = setInterval(() => loadScreen({ initial: false }), 10000);
    return () => clearInterval(interval);
  }, [id]);

  function markPlaylistDirty() {
    playlistDirtyRef.current = true;
    log('Playlist marcada como sin guardar (no se sobrescribe al refrescar)');
  }

  async function loadScreen(opts = {}) {
    const { initial = false } = opts;
    try {
      const { data } = await api.get(`/screens/${id}`);
      const mediaRows = getScreenMediaRows(data);
      log('GET /screens/:id OK', {
        screenId: id,
        items: mediaRows.length,
        keys: Object.keys(data).filter((k) => /media/i.test(k)),
      });
      setScreen(data);
      if (playlistDirtyRef.current && !initial) {
        log('Refresco omitido: hay cambios locales sin publicar');
        return;
      }
      if (mediaRows.length > 0) {
        const next = mediaRows
          .filter((sm) => sm.Media != null)
          .map((sm) => ({
            media_id: sm.Media.id,
            url: sm.Media.url,
            original_name: sm.Media.original_name,
            duration: sm.duration,
            position: sm.position,
          }));
        setPlaylist(next);
      } else {
        setPlaylist([]);
      }
    } catch (err) {
      console.error('[ScreenDetail] Error cargando pantalla:', err);
      console.error('Respuesta:', err.response?.data, 'status:', err.response?.status);
      toast.error(err.response?.data?.error || 'Error cargando pantalla');
    } finally {
      if (initial) setLoading(false);
    }
  }

  async function loadAllMedia() {
    try {
      const { data } = await api.get('/media');
      setAllMedia(data);
    } catch {}
  }

  function addToPlaylist(media) {
    if (media == null || media.id == null) {
      console.error('[ScreenDetail] addToPlaylist: media inválido', media);
      toast.error('No se pudo agregar: datos de media incompletos');
      return;
    }
    if (playlist.find((p) => p.media_id === media.id)) {
      toast.error('Ya está en la playlist');
      return;
    }
    markPlaylistDirty();
    setPlaylist([
      ...playlist,
      {
        media_id: media.id,
        url: media.url,
        original_name: media.original_name,
        duration: 10,
        position: playlist.length,
      },
    ]);
    setShowMediaPicker(false);
    log('Item agregado a playlist local', { media_id: media.id });
  }

  function removeFromPlaylist(index) {
    markPlaylistDirty();
    setPlaylist(playlist.filter((_, i) => i !== index));
  }

  function updateDuration(index, duration) {
    markPlaylistDirty();
    const updated = [...playlist];
    updated[index] = { ...updated[index], duration: parseInt(duration, 10) || 10 };
    setPlaylist(updated);
  }

  function moveItem(index, direction) {
    markPlaylistDirty();
    const updated = [...playlist];
    const target = index + direction;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setPlaylist(updated.map((item, i) => ({ ...item, position: i })));
  }

  async function savePlaylist() {
    const items = playlist.map((p, i) => ({
      media_id: p.media_id,
      duration: p.duration,
      position: i,
    }));
    const invalid = items.filter((it) => it.media_id == null || Number.isNaN(Number(it.media_id)));
    if (invalid.length > 0) {
      console.error('[ScreenDetail] Items sin media_id válido:', playlist, items);
      toast.error('Hay ítems sin ID de media. Quita y vuelve a agregar.');
      return;
    }
    try {
      log('POST /screens/:id/playlist', { screenId: id, items });
      const res = await api.post(`/screens/${id}/playlist`, { items });
      log('Playlist guardada, respuesta:', res.data);
      playlistDirtyRef.current = false;
      toast.success('Playlist guardada y enviada al dispositivo');
      await loadScreen({ initial: false });
    } catch (err) {
      console.error('[ScreenDetail] Error guardando playlist:', err);
      console.error('Status:', err.response?.status, 'Body:', err.response?.data);
      const msg =
        err.response?.data?.error ||
        err.message ||
        (err.response?.data && JSON.stringify(err.response.data)) ||
        'Error guardando playlist';
      toast.error(typeof msg === 'string' ? msg : 'Error guardando playlist');
    }
  }

  async function sendCommand(type) {
    try {
      log('POST /screens/:id/command', type);
      await api.post(`/screens/${id}/command`, { type });
      toast.success(`Comando "${type}" enviado`);
    } catch (err) {
      console.error('[ScreenDetail] Error comando:', err.response?.data || err);
      toast.error('Error enviando comando');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Cargando...</p></div>;
  }

  if (!screen) {
    return <div className="text-center py-12"><p className="text-gray-500">Pantalla no encontrada</p></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/screens" className="hover:text-indigo-600">Pantallas</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{screen.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Información</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Nombre</dt>
                <dd className="text-sm font-medium text-gray-800">{screen.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Device ID</dt>
                <dd className="text-sm font-mono text-gray-800">{screen.device_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Sede</dt>
                <dd className="text-sm text-gray-800">{screen.Venue?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Orientación</dt>
                <dd className="text-sm text-gray-800 capitalize">{screen.orientation}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Estado</dt>
                <dd>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    screen.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${screen.status === 'online' ? 'bg-green-500' : 'bg-red-400'}`} />
                    {screen.status === 'online' ? 'En línea' : 'Fuera de línea'}
                  </span>
                </dd>
              </div>
              {screen.last_heartbeat && (
                <div>
                  <dt className="text-xs text-gray-500">Último heartbeat</dt>
                  <dd className="text-sm text-gray-800">{new Date(screen.last_heartbeat).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Comandos</h3>
            <div className="space-y-2">
              <button onClick={() => sendCommand('reload')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 border border-gray-200 transition-colors">
                Recargar página
              </button>
              <button onClick={() => sendCommand('refresh')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 border border-gray-200 transition-colors">
                Actualizar playlist
              </button>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-5">
            <h3 className="font-semibold text-indigo-800 mb-2">URL del Player</h3>
            <p className="text-xs text-indigo-600 font-mono break-all">
              http://TU_IP:5174/?device={screen.device_id}
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Playlist ({playlist.length} items)</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowMediaPicker(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  + Agregar Media
                </button>
                <button onClick={savePlaylist} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  Guardar y Publicar
                </button>
              </div>
            </div>

            {playlist.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 text-sm">No hay items en la playlist</p>
                <button onClick={() => setShowMediaPicker(true)} className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  Agregar contenido
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {playlist.map((item, index) => (
                  <div key={`${item.media_id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">Arriba</button>
                      <button onClick={() => moveItem(index, 1)} disabled={index === playlist.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">Abajo</button>
                    </div>
                    <span className="text-xs font-mono text-gray-400 w-6 text-center">{index + 1}</span>
                    <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{item.original_name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="1" max="300"
                        value={item.duration}
                        onChange={(e) => updateDuration(index, e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                      <span className="text-xs text-gray-500">seg</span>
                    </div>
                    <button onClick={() => removeFromPlaylist(index)} className="text-red-400 hover:text-red-600 p-1" title="Quitar">
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Seleccionar Media</h3>
              <button onClick={() => setShowMediaPicker(false)} className="text-gray-400 hover:text-gray-600 text-sm font-medium">Cerrar</button>
            </div>
            <div className="flex-1 overflow-auto">
              {allMedia.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500">No hay archivos disponibles</p>
                  <Link to="/media" className="text-indigo-600 text-sm font-medium mt-2 inline-block">Subir archivos</Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {allMedia.map((item) => {
                    const inPlaylist = playlist.some((p) => p.media_id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToPlaylist(item)}
                        disabled={inPlaylist}
                        className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
                          inPlaylist
                            ? 'border-green-300 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                        }`}
                      >
                        <div className="aspect-video bg-gray-100">
                          <img src={item.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs truncate text-gray-700">{item.original_name}</p>
                          {inPlaylist && <p className="text-xs text-green-600">Ya agregado</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
