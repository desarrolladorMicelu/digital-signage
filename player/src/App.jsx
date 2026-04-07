import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const params = new URLSearchParams(globalThis.location.search);
const DEVICE_ID = params.get('device') || 'screen-001';
const HOST = params.get('host') || globalThis.location.hostname || 'localhost';
const API_PORT = params.get('api_port') || '3000';
const MQTT_PORT = params.get('mqtt_port') || '8083';
const API_URL = `http://${HOST}:${API_PORT}`;
const MQTT_URL = `ws://${HOST}:${MQTT_PORT}`;
const PLAYLIST_API_URL = `${API_URL}/api/screens/by-device/${encodeURIComponent(DEVICE_ID)}/playlist`;
const PLAYLIST_STORAGE_KEY = `signage:playlist:${DEVICE_ID}`;
const MEDIA_CACHE_NAME = 'signage-media-v1';
const SYNC_INTERVAL_MS = 30000;

export default function App() {
  const [activePlaylist, setActivePlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [fade, setFade] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  // {done, total} mientras descarga nueva playlist; null si no hay descarga activa
  const [downloadProgress, setDownloadProgress] = useState(null);

  const clientRef = useRef(null);
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const syncRef = useRef(null);
  const retryVideoRef = useRef(null);
  const videoReadyTimeoutRef = useRef(null);
  const currentIsVideoRef = useRef(false);
  const playlistSigRef = useRef('');
  // remoteUrl → blobUrl (o remoteUrl como fallback)
  const mediaBlobMapRef = useRef(new Map());

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const makePlaylistSignature = useCallback((items) => {
    if (!Array.isArray(items)) return '[]';
    return JSON.stringify(
      items.map((item) => ({
        id: item?.id ?? null,
        url: item?.url ?? '',
        mime_type: item?.mime_type ?? '',
        duration: item?.duration ?? 10,
        position: item?.position ?? 0,
      }))
    );
  }, []);

  const resolveMediaUrl = useCallback((item) => {
    const rawUrl = item?.url || '';
    if (!rawUrl) return '';
    if (!rawUrl.startsWith('http')) return `${API_URL}${rawUrl}`;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.pathname.startsWith('/uploads/')) return `${API_URL}${parsed.pathname}`;
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }, []);

  // Devuelve el blob URL local si está pre-descargado, o la URL remota como fallback.
  const getPlaybackUrl = useCallback((item) => {
    const remoteUrl = resolveMediaUrl(item);
    if (!remoteUrl) return '';
    return mediaBlobMapRef.current.get(remoteUrl) ?? remoteUrl;
  }, [resolveMediaUrl]);

  const isVideoMedia = useCallback((item) => {
    const mime = String(item?.mime_type || '').toLowerCase();
    if (mime.startsWith('video/')) return true;
    return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/.test(String(item?.url || '').toLowerCase());
  }, []);

  const persistPlaylist = useCallback((items) => {
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify({ items, updatedAt: Date.now() }));
    } catch (err) {
      console.warn('[Player] No se pudo guardar playlist localmente:', err);
    }
  }, []);

  const readPersistedPlaylist = useCallback(() => {
    try {
      const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }, []);

  // ─── Descarga individual ──────────────────────────────────────────────────

  const downloadItem = useCallback(async (item) => {
    const remoteUrl = resolveMediaUrl(item);
    if (!remoteUrl) return [remoteUrl, remoteUrl];

    // Ya está en memoria
    const inMemory = mediaBlobMapRef.current.get(remoteUrl);
    if (inMemory) return [remoteUrl, inMemory];

    // Intentar red → blob + guardar en Cache API
    try {
      const resp = await fetch(remoteUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if ('caches' in globalThis) {
          const cache = await caches.open(MEDIA_CACHE_NAME);
          await cache.put(remoteUrl, new Response(blob.slice(), { headers: { 'Content-Type': blob.type } }));
        }
        return [remoteUrl, URL.createObjectURL(blob)];
      }
    } catch { /* sin red, intentar cache */ }

    // Fallback: Cache API guardada previamente
    if ('caches' in globalThis) {
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const cached = await cache.match(remoteUrl);
        if (cached) {
          const blob = await cached.blob();
          return [remoteUrl, URL.createObjectURL(blob)];
        }
      } catch { /* ignorar */ }
    }

    // Último fallback: URL remota (bufferiza en tiempo real)
    console.warn('[Player] Sin caché para:', remoteUrl, '— usando URL remota');
    return [remoteUrl, remoteUrl];
  }, [resolveMediaUrl]);

  // ─── Descarga toda la playlist y luego la activa ──────────────────────────

  const downloadAndActivate = useCallback(async (items, source) => {
    if (!Array.isArray(items) || items.length === 0) return;

    console.log(`[Player] Descargando playlist (${source}): ${items.length} ítems`);
    setDownloadProgress({ done: 0, total: items.length });

    const newBlobMap = new Map();
    for (let i = 0; i < items.length; i++) {
      const [remoteUrl, blobUrl] = await downloadItem(items[i]);
      if (remoteUrl) newBlobMap.set(remoteUrl, blobUrl);
      setDownloadProgress({ done: i + 1, total: items.length });
    }

    // Liberar blobs que ya no están en la nueva playlist
    for (const [url, blobUrl] of mediaBlobMapRef.current) {
      if (!newBlobMap.has(url) && String(blobUrl).startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    }

    // Limpiar Cache API de recursos obsoletos
    if ('caches' in globalThis) {
      try {
        const keep = new Set(newBlobMap.keys());
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const keys = await cache.keys();
        await Promise.all(keys.filter((r) => !keep.has(r.url)).map((r) => cache.delete(r)));
      } catch { /* ignorar */ }
    }

    mediaBlobMapRef.current = newBlobMap;
    persistPlaylist(items);

    // Activar la nueva playlist de golpe — todo está listo localmente
    setActivePlaylist(items);
    setCurrentIndex(0);
    setVideoReady(false);
    setDownloadProgress(null);

    console.log(`[Player] Playlist activa (${source}): ${items.length} ítems listos localmente`);
  }, [downloadItem, persistPlaylist]);

  // ─── Dedup + encolar descarga ─────────────────────────────────────────────

  const applyPlaylist = useCallback((items, source = 'unknown') => {
    if (!Array.isArray(items)) return;
    const nextSig = makePlaylistSignature(items);
    if (nextSig === playlistSigRef.current) return;
    playlistSigRef.current = nextSig;
    downloadAndActivate(items, source);
  }, [makePlaylistSignature, downloadAndActivate]);

  const syncPlaylistFromApi = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const resp = await fetch(PLAYLIST_API_URL, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data?.items)) applyPlaylist(data.items, 'api-sync');
    } catch (err) {
      console.warn('[Player] Error sincronizando playlist por API:', err);
    }
  }, [applyPlaylist]);

  // ─── Arranque: cargar playlist persistida ────────────────────────────────

  useEffect(() => {
    const persisted = readPersistedPlaylist();
    if (persisted.length > 0) applyPlaylist(persisted, 'local-storage');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── MQTT + intervalo de sync ─────────────────────────────────────────────

  useEffect(() => {
    console.log('[Player] Endpoints', { DEVICE_ID, API_URL, MQTT_URL });

    const client = mqtt.connect(MQTT_URL, {
      clientId: `player-${DEVICE_ID}-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      keepalive: 60,
    });
    clientRef.current = client;

    client.on('connect', () => {
      console.log('[Player] Conectado a MQTT');
      setConnected(true);
      client.subscribe(`signage/${DEVICE_ID}/playlist`, { qos: 1 });
      client.subscribe(`signage/${DEVICE_ID}/command`, { qos: 1 });
      syncPlaylistFromApi();
      client.publish(`signage/${DEVICE_ID}/heartbeat`, JSON.stringify({ timestamp: Date.now(), status: 'connected' }));
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic.endsWith('/playlist') && Array.isArray(data?.items)) applyPlaylist(data.items, 'mqtt');
        if (topic.endsWith('/command') && data.type === 'reload') globalThis.location.reload();
      } catch (err) {
        console.error('[Player] Error parsing message:', err);
      }
    });

    client.on('close', () => setConnected(false));
    client.on('reconnect', () => console.log('[Player] Reconectando MQTT...'));
    client.on('offline', () => console.warn('[Player] MQTT offline'));
    client.on('error', (err) => console.error('[Player] MQTT error:', err));

    heartbeatRef.current = setInterval(() => {
      if (client.connected) {
        client.publish(`signage/${DEVICE_ID}/heartbeat`, JSON.stringify({ timestamp: Date.now(), status: 'playing' }));
      }
    }, 30000);

    syncRef.current = setInterval(syncPlaylistFromApi, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(syncRef.current);
      client.end();
    };
  }, [applyPlaylist, syncPlaylistFromApi]);

  // ─── online / offline ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleOnline() {
      setConnected(true);
      syncPlaylistFromApi();
      try { clientRef.current?.reconnect?.(); } catch { /* ignorar */ }
    }
    function handleOffline() { setConnected(false); }
    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);
    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [syncPlaylistFromApi]);

  // ─── Cleanup blob URLs al desmontar ──────────────────────────────────────

  useEffect(() => {
    return () => {
      if (retryVideoRef.current) clearTimeout(retryVideoRef.current);
      if (videoReadyTimeoutRef.current) clearTimeout(videoReadyTimeoutRef.current);
      for (const blobUrl of mediaBlobMapRef.current.values()) {
        if (String(blobUrl).startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  // ─── Avance de slides ─────────────────────────────────────────────────────

  const markVideoReady = useCallback(() => {
    if (videoReadyTimeoutRef.current) clearTimeout(videoReadyTimeoutRef.current);
    setVideoReady(true);
  }, []);

  // Arranca timeout de seguridad cada vez que cambia el video actual
  useEffect(() => {
    if (!currentIsVideoRef.current) return;
    if (videoReadyTimeoutRef.current) clearTimeout(videoReadyTimeoutRef.current);
    // Si en 4s ningún evento disparó videoReady, mostramos el video igual
    videoReadyTimeoutRef.current = setTimeout(() => {
      setVideoReady(true);
    }, 4000);
    return () => {
      if (videoReadyTimeoutRef.current) clearTimeout(videoReadyTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activePlaylist]);

  const advanceSlide = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activePlaylist.length);
      setFade(true);
      setVideoReady(false);
    }, 500);
  }, [activePlaylist.length]);

  useEffect(() => {
    if (activePlaylist.length <= 1) return;
    const currentItem = activePlaylist[currentIndex];
    if (isVideoMedia(currentItem)) return;
    const duration = (currentItem?.duration || 10) * 1000;
    timerRef.current = setTimeout(advanceSlide, duration);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, activePlaylist, advanceSlide, isVideoMedia]);

  useEffect(() => {
    if (activePlaylist.length === 1) setFade(true);
  }, [activePlaylist]);

  // ─── Render: esperando contenido ─────────────────────────────────────────

  if (activePlaylist.length === 0) {
    return (
      <div style={styles.waiting}>
        <div style={styles.waitingContent}>
          <div style={styles.logo}>📺</div>
          <h1 style={styles.title}>Digital Signage Mi celu</h1>
          <p style={styles.deviceId}>{DEVICE_ID}</p>
          <div style={styles.statusRow}>
            <span style={{ ...styles.statusDot, backgroundColor: connected ? '#22c55e' : '#ef4444' }} />
            <span style={styles.statusText}>
                      {(() => {
                if (downloadProgress) return `Descargando contenido... ${downloadProgress.done}/${downloadProgress.total}`;
                if (connected) return 'Conectado — esperando contenido...';
                return 'Conectando al servidor...';
              })()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: reproduciendo ────────────────────────────────────────────────

  const currentMedia = activePlaylist[currentIndex];
  const imageUrl = getPlaybackUrl(currentMedia);
  const currentIsVideo = isVideoMedia(currentMedia);
  currentIsVideoRef.current = currentIsVideo;

  return (
    <div style={styles.player}>
      {/* Indicador discreto de descarga de nueva playlist (esquina inferior izquierda) */}
      {downloadProgress && (
        <div style={styles.downloadBadge}>
          ↓ {downloadProgress.done}/{downloadProgress.total}
        </div>
      )}

      {/* Fondo negro mientras el video carga — oculta el placeholder nativo del OS */}
      {currentIsVideo && !videoReady && <div style={styles.videoLoading} />}

      {currentIsVideo ? (
        <video
          key={`${currentMedia?.id}-${currentIndex}`}
          src={imageUrl}
          style={{ ...styles.slide, opacity: videoReady && fade ? 1 : 0, transition: 'opacity 0.4s ease-in-out' }}
          autoPlay
          playsInline
          muted
          preload="auto"
          loop={activePlaylist.length === 1}
          onCanPlay={markVideoReady}
          onCanPlayThrough={markVideoReady}
          onLoadedData={markVideoReady}
          onLoadedMetadata={markVideoReady}
          onPlay={markVideoReady}
          onEnded={() => { if (activePlaylist.length > 1) advanceSlide(); }}
          onError={() => {
            console.error('[Player] Error cargando video:', imageUrl);
            if (retryVideoRef.current) clearTimeout(retryVideoRef.current);
            retryVideoRef.current = setTimeout(async () => {
              const [remoteUrl, blobUrl] = await downloadItem(currentMedia);
              if (remoteUrl) mediaBlobMapRef.current.set(remoteUrl, blobUrl);
              setVideoReady(false);
            }, 2000);
          }}
        />
      ) : (
        <img
          key={`${currentMedia?.id}-${currentIndex}`}
          src={imageUrl}
          alt=""
          style={{ ...styles.slide, opacity: fade ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }}
          onError={() => console.error('[Player] Error cargando imagen:', imageUrl)}
          onLoad={() => {}}
        />
      )}
    </div>
  );
}

const styles = {
  waiting: {
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingContent: {
    textAlign: 'center',
    color: '#fff',
  },
  logo: {
    fontSize: '80px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
    fontFamily: 'system-ui, sans-serif',
  },
  deviceId: {
    fontSize: '18px',
    color: '#818cf8',
    fontFamily: 'monospace',
    marginBottom: '24px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '14px',
    color: '#94a3b8',
    fontFamily: 'system-ui, sans-serif',
  },
  player: {
    width: '100vw',
    height: '100vh',
    background: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  videoLoading: {
    position: 'absolute',
    inset: 0,
    background: '#000',
    zIndex: 5,
  },
  downloadBadge: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    background: 'rgba(0,0,0,0.5)',
    color: '#94a3b8',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    zIndex: 10,
  },
};
