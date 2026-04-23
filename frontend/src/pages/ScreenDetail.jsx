import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

const log = (...args) => console.log('[ScreenDetail]', ...args);

function IconGrip({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M7 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM13 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM13 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM13 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}

function IconChevronUp({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );
}

function IconChevronDown({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function IconCopy({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M8 3a1 1 0 011-1h2a1 1 0 011 1v4h-4V3zM3 8a1 1 0 011-1h4v9H4a1 1 0 01-1-1V8zm6-1h6a1 1 0 011 1v9a1 1 0 01-1 1h-6V7z" />
    </svg>
  );
}

function IconRefresh({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  );
}

function IconPlaylist({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h10v2H3v-2z" />
    </svg>
  );
}

function isVideoMedia(item) {
  const mime = String(item?.mime_type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  const url = String(item?.url || '').toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|mpeg|mpg|wmv|3gp|flv|ts)(\?|$)/i.test(url);
}

/** Con alias explícito `as: 'ScreenMedia'`, Sequelize devuelve exactamente esa clave. */
function playlistQueueSubtitle(length) {
  if (length === 0) return 'Aún no hay contenido asignado';
  if (length === 1) return '1 elemento en cola';
  return `${length} elementos en cola`;
}

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
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [pickerUploading, setPickerUploading] = useState(false);
  const [pickerDragActive, setPickerDragActive] = useState(false);
  const [playlistDragSource, setPlaylistDragSource] = useState(null);
  const [playlistDragOver, setPlaylistDragOver] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Evita que el polling borre la playlist antes de guardar */
  const playlistDirtyRef = useRef(false);
  const pickerFileInputRef = useRef(null);

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
            mime_type: sm.Media.mime_type,
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

  async function uploadPickerFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setPickerUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append('files', f));
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newIds = Array.isArray(data) ? data.map((m) => m.id).filter(Boolean) : [];
      toast.success(`${fileList.length} archivo(s) subido(s)`);
      await loadAllMedia();
      if (newIds.length === 0) return;
      setSelectedMediaIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((nid) => next.add(nid));
        return Array.from(next);
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error subiendo archivos');
    } finally {
      setPickerUploading(false);
      if (pickerFileInputRef.current) pickerFileInputRef.current.value = '';
    }
  }

  function handlePickerDrop(e) {
    e.preventDefault();
    setPickerDragActive(false);
    uploadPickerFiles(e.dataTransfer.files);
  }

  function toggleMediaSelection(mediaId) {
    setSelectedMediaIds((prev) => (
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    ));
  }

  function addSelectedToPlaylist() {
    if (selectedMediaIds.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    const existing = new Set(playlist.map((p) => p.media_id));
    const toAdd = allMedia.filter((m) => selectedMediaIds.includes(m.id) && !existing.has(m.id));

    if (toAdd.length === 0) {
      toast.error('Los elementos seleccionados ya están en la playlist');
      return;
    }

    markPlaylistDirty();
    const basePosition = playlist.length;
    const appended = toAdd.map((media, idx) => ({
      media_id: media.id,
      url: media.url,
      original_name: media.original_name,
      mime_type: media.mime_type,
      duration: 10,
      position: basePosition + idx,
    }));
    setPlaylist([...playlist, ...appended]);
    setSelectedMediaIds([]);
    setShowMediaPicker(false);
    toast.success(`${toAdd.length} item(s) agregado(s)`);
  }

  function removeFromPlaylist(index) {
    markPlaylistDirty();
    setPlaylist(playlist.filter((_, i) => i !== index));
  }

  function updateDuration(index, duration) {
    markPlaylistDirty();
    const updated = [...playlist];
    updated[index] = { ...updated[index], duration: Number.parseInt(duration, 10) || 10 };
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

  function reorderPlaylistDrop(from, to) {
    if (from === to) return;
    markPlaylistDirty();
    setPlaylist((prev) => {
      const item = prev[from];
      const next = prev.filter((_, i) => i !== from);
      next.splice(to, 0, item);
      return next.map((it, i) => ({ ...it, position: i }));
    });
  }

  function handlePlaylistDragStart(index, e) {
    setPlaylistDragSource(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handlePlaylistDragEnd() {
    setPlaylistDragSource(null);
    setPlaylistDragOver(null);
  }

  function handlePlaylistRowDragOver(index, e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setPlaylistDragOver(index);
  }

  function handlePlaylistRowDrop(toIndex, e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    let from;
    if (raw === '') {
      from = playlistDragSource;
    } else {
      from = Number.parseInt(raw, 10);
    }
    if (from == null || Number.isNaN(from)) {
      handlePlaylistDragEnd();
      return;
    }
    reorderPlaylistDrop(from, toIndex);
    handlePlaylistDragEnd();
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

  const playerUrl = `http://20.81.42.176:5174/?device=${screen.device_id}`;

  async function copyPlayerUrl() {
    try {
      await navigator.clipboard.writeText(playerUrl);
      toast.success('URL copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar la URL');
    }
  }

  return (
    <div className="w-full space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Miga de pan">
        <Link to="/screens" className="text-gray-500 hover:text-indigo-600 transition-colors">Pantallas</Link>
        <span className="text-gray-300" aria-hidden>/</span>
        <span className="text-gray-900 font-semibold">{screen.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-4">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Información</h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
              <dl className="space-y-3 min-w-0">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Nombre</dt>
                  <dd className="mt-0.5 font-semibold text-gray-900 leading-snug break-words">{screen.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Device ID</dt>
                  <dd className="mt-0.5 text-gray-800 capitalize">{screen.device_id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Orientación</dt>
                  <dd className="mt-0.5 text-gray-800 capitalize">{screen.orientation}</dd>
                </div>
              </dl>
              <dl className="space-y-3 min-w-0">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Sede</dt>
                  <dd className="mt-0.5 text-gray-800 break-words">{screen.Venue?.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Estado</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-flex shrink-0 flex-nowrap items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full ${
                      screen.status === 'online' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20' : 'bg-red-50 text-red-800 ring-1 ring-red-600/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${screen.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {screen.status === 'online' ? 'En línea' : 'Fuera de línea'}
                    </span>
                  </dd>
                </div>
                {screen.last_heartbeat && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Último heartbeat</dt>
                    <dd className="mt-0.5 text-gray-800 text-xs tabular-nums leading-snug">{new Date(screen.last_heartbeat).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Comandos al dispositivo</h2>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => sendCommand('reload')}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-900"
              >
                <IconRefresh className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                Recargar página
              </button>
              <button
                type="button"
                onClick={() => sendCommand('refresh')}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <IconPlaylist className="h-3.5 w-3.5 shrink-0 opacity-95" />
                Actualizar playlist
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600">URL del player</h2>
              <button
                type="button"
                onClick={copyPlayerUrl}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50"
              >
                <IconCopy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-indigo-900/90 break-all">{playerUrl}</p>
          </section>
        </div>

        <div className="lg:col-span-8">
          <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm flex flex-col min-h-[280px]">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="text-lg font-semibold text-gray-900">Playlist</h2>
                <span className="hidden sm:inline text-gray-300" aria-hidden>·</span>
                <p className="text-sm text-gray-500">{playlistQueueSubtitle(playlist.length)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Agregar media
                </button>
                <button
                  type="button"
                  onClick={savePlaylist}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Guardar y publicar
                </button>
              </div>
            </div>

            {playlist.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                <p className="text-sm text-gray-500 max-w-sm">Añade imágenes o videos desde tu biblioteca o súbelos al instante desde el selector.</p>
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Abrir selector de media
                </button>
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Arrastra el asa para reordenar · Usa las flechas si prefieres</p>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/40 overflow-hidden">
                  {playlist.map((item, index) => (
                    <li
                      key={`${item.media_id}-${index}`}
                      onDragOver={(e) => handlePlaylistRowDragOver(index, e)}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setPlaylistDragOver(null);
                      }}
                      onDrop={(e) => handlePlaylistRowDrop(index, e)}
                      className={`flex items-center gap-2 bg-white px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2 transition ${
                        playlistDragOver === index ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50/30' : ''
                      } ${playlistDragSource === index ? 'opacity-50' : ''}`}
                    >
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handlePlaylistDragStart(index, e)}
                          onDragEnd={handlePlaylistDragEnd}
                          className="cursor-grab touch-none rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing inline-flex border-0 bg-transparent leading-none"
                          title="Arrastrar para reordenar"
                          aria-label="Arrastrar para reordenar fila"
                        >
                          <IconGrip className="h-5 w-5" />
                        </button>
                        <div className="flex flex-col border-l border-gray-100 pl-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-25"
                            aria-label="Subir una posición"
                          >
                            <IconChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 1)}
                            disabled={index === playlist.length - 1}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-25"
                            aria-label="Bajar una posición"
                          >
                            <IconChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400">{index + 1}</span>
                      <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/5 sm:h-10 sm:w-16">
                        {isVideoMedia(item) ? (
                          <>
                            <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" playsInline />
                            <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 py-px text-[8px] font-bold text-white">VIDEO</span>
                          </>
                        ) : (
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{item.original_name}</p>
                        {isVideoMedia(item) && (
                          <p className="truncate text-[11px] text-indigo-600/90">Duración según archivo de video</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isVideoMedia(item) ? (
                          <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">Auto</span>
                        ) : (
                          <label className="flex items-center gap-1">
                            <span className="sr-only">Duración en segundos</span>
                            <input
                              type="number"
                              min="1"
                              max="300"
                              value={item.duration}
                              onChange={(e) => updateDuration(index, e.target.value)}
                              className="w-14 rounded-md border border-gray-200 bg-white py-1 text-center text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <span className="text-[11px] font-medium text-gray-500">seg</span>
                          </label>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromPlaylist(index)}
                        className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Quitar de la playlist"
                        aria-label="Quitar de la playlist"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl xl:max-w-5xl">
            <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar media</h3>
                <p className="mt-0.5 text-xs text-gray-500">Elige archivos o súbelos con la zona inferior</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addSelectedToPlaylist}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Agregar seleccionados ({selectedMediaIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMediaIds([]);
                    setShowMediaPicker(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden p-5 pt-4">
            <div className="shrink-0 mb-3">
              <input
                ref={pickerFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => uploadPickerFiles(e.target.files)}
              />
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setPickerDragActive(true);
                }}
                onDragLeave={() => setPickerDragActive(false)}
                onDrop={handlePickerDrop}
                onClick={() => {
                  if (pickerUploading) return;
                  pickerFileInputRef.current?.click();
                }}
                disabled={pickerUploading}
                className={`w-full rounded-xl border-2 border-dashed px-4 py-3 text-center cursor-pointer transition-all ${
                  pickerDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                } ${pickerUploading ? 'opacity-70 cursor-wait' : ''}`}
              >
                {pickerUploading ? (
                  <p className="text-sm text-gray-600">Subiendo...</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Arrastra archivos aquí o haz clic para subir</p>
                    <p className="text-xs text-gray-400 mt-0.5">Imágenes y videos (incl. MOV, MP4…), máx. 50 MB</p>
                  </div>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              {allMedia.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500 text-sm">No hay más archivos en la biblioteca</p>
                  <p className="text-gray-400 text-xs mt-1">Usa la zona de arriba para agregar el primero</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {allMedia.map((item) => {
                    const inPlaylist = playlist.some((p) => p.media_id === item.id);
                    const isSelected = selectedMediaIds.includes(item.id);
                    let cardClass = 'border-gray-200 hover:border-indigo-500 hover:shadow-md cursor-pointer';
                    if (inPlaylist) {
                      cardClass = 'border-green-300 opacity-50 cursor-not-allowed';
                    } else if (isSelected) {
                      cardClass = 'border-indigo-500 ring-2 ring-indigo-200 cursor-pointer';
                    }
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleMediaSelection(item.id)}
                        disabled={inPlaylist}
                        className={`rounded-lg overflow-hidden border-2 transition-all text-left ${cardClass}`}
                      >
                        <div className="aspect-video bg-gray-100">
                          {isVideoMedia(item) ? (
                            <div className="w-full h-full relative">
                              <video
                                src={item.url}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                                playsInline
                              />
                              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                VIDEO
                              </div>
                            </div>
                          ) : (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs truncate text-gray-700">{item.original_name}</p>
                          {isVideoMedia(item) && <p className="text-xs text-indigo-600">Reproduce completo</p>}
                          {inPlaylist && <p className="text-xs text-green-600">Ya agregado</p>}
                          {!inPlaylist && isSelected && (
                            <p className="text-xs text-indigo-600">Seleccionado</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
