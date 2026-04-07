import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const params = new URLSearchParams(globalThis.location.search);
const DEVICE_ID = params.get('device') || 'screen-001';
/** Si abres el player por IP/Dominio, HOST ya apunta al PC. En Android usa http://IP_PC:5174/?device=... */
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
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [fade, setFade] = useState(true);
  const [imageError, setImageError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [currentImageSrc, setCurrentImageSrc] = useState('');
  const clientRef = useRef(null);
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const syncRef = useRef(null);
  const blobUrlRef = useRef('');
  const playlistSigRef = useRef('');

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
    return rawUrl.startsWith('http') ? rawUrl : `${API_URL}${rawUrl}`;
  }, []);

  const isVideoMedia = useCallback((item) => {
    const mime = String(item?.mime_type || '').toLowerCase();
    if (mime.startsWith('video/')) return true;
    const url = String(item?.url || '').toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/.test(url);
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
    } catch (err) {
      console.warn('[Player] No se pudo leer playlist local:', err);
      return [];
    }
  }, []);

  const cachePlaylistMedia = useCallback(async (items) => {
    if (!('caches' in globalThis) || !Array.isArray(items) || items.length === 0) return;
    try {
      const cache = await caches.open(MEDIA_CACHE_NAME);
      for (const item of items) {
        const mediaUrl = resolveMediaUrl(item);
        try {
          const response = await fetch(mediaUrl, { cache: 'no-store' });
          if (response.ok) await cache.put(mediaUrl, response.clone());
        } catch (err) {
          console.warn('[Player] No se pudo cachear media:', mediaUrl, err);
        }
      }
    } catch (err) {
      console.warn('[Player] Error abriendo cache de media:', err);
    }
  }, [resolveMediaUrl]);

  const pruneMediaCache = useCallback(async (items) => {
    if (!('caches' in globalThis)) return;
    try {
      const keep = new Set(
        (Array.isArray(items) ? items : [])
          .map((item) => resolveMediaUrl(item))
          .filter(Boolean)
      );
      const cache = await caches.open(MEDIA_CACHE_NAME);
      const requests = await cache.keys();

      await Promise.all(
        requests.map(async (req) => {
          if (!keep.has(req.url)) {
            await cache.delete(req);
          }
        })
      );
    } catch (err) {
      console.warn('[Player] Error limpiando cache de media:', err);
    }
  }, [resolveMediaUrl]);

  const applyPlaylist = useCallback((items, source = 'unknown') => {
    if (!Array.isArray(items)) return;
    const nextSig = makePlaylistSignature(items);
    if (nextSig === playlistSigRef.current) return;

    playlistSigRef.current = nextSig;
    setPlaylist(items);
    setCurrentIndex(0);
    setImageError('');
    setReloadToken((t) => t + 1);
    persistPlaylist(items);
    cachePlaylistMedia(items);
    pruneMediaCache(items);
    console.log(`[Player] Playlist aplicada desde ${source}:`, items.length, 'ítems');
  }, [cachePlaylistMedia, makePlaylistSignature, persistPlaylist, pruneMediaCache]);

  const syncPlaylistFromApi = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const resp = await fetch(PLAYLIST_API_URL, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data?.items)) {
        applyPlaylist(data.items, 'api-sync');
      }
    } catch (err) {
      console.warn('[Player] Error sincronizando playlist por API:', err);
    }
  }, [applyPlaylist]);

  useEffect(() => {
    console.log('[Player] Endpoints', { DEVICE_ID, API_URL, MQTT_URL });
    const persisted = readPersistedPlaylist();
    if (persisted.length > 0) {
      applyPlaylist(persisted, 'local-storage');
    }

    const client = mqtt.connect(MQTT_URL, {
      clientId: `player-${DEVICE_ID}-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      keepalive: 60,
    });
    clientRef.current = client;

    client.on('connect', () => {
      console.log(`[Player] Conectado a MQTT (clientId=${client.options.clientId})`);
      setConnected(true);
      // Al reconectar a MQTT, forzamos recarga de la imagen para evitar "pantalla congelada"
      setImageError('');
      setReloadToken((t) => t + 1);
      client.subscribe(`signage/${DEVICE_ID}/playlist`, { qos: 1 });
      client.subscribe(`signage/${DEVICE_ID}/command`, { qos: 1 });
      syncPlaylistFromApi();

      client.publish(`signage/${DEVICE_ID}/heartbeat`, JSON.stringify({
        timestamp: Date.now(),
        status: 'connected',
      }));
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());

        if (topic.endsWith('/playlist')) {
          const n = Array.isArray(data.items) ? data.items.length : 0;
          console.log('[Player] Mensaje playlist:', n, 'ítems', data);
          if (data.items && Array.isArray(data.items)) applyPlaylist(data.items, 'mqtt');
        }

        if (topic.endsWith('/command')) {
          console.log('[Player] Comando recibido:', data);
          if (data.type === 'reload') globalThis.location.reload();
        }
      } catch (err) {
        console.error('[Player] Error parsing message:', err);
      }
    });

    client.on('close', () => {
      console.warn('[Player] MQTT cerrado (red, broker o otra pestaña con mismo clientId en algunos brokers)');
      setConnected(false);
    });
    client.on('reconnect', () => console.log('[Player] Reconectando MQTT...'));
    client.on('offline', () => console.warn('[Player] MQTT offline'));
    client.on('error', (err) => console.error('[Player] MQTT error:', err));

    heartbeatRef.current = setInterval(() => {
      if (client.connected) {
        client.publish(`signage/${DEVICE_ID}/heartbeat`, JSON.stringify({
          timestamp: Date.now(),
          status: 'playing',
        }));
      }
    }, 30000);

    syncRef.current = setInterval(() => {
      syncPlaylistFromApi();
    }, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(syncRef.current);
      client.end();
    };
  }, [applyPlaylist, readPersistedPlaylist, syncPlaylistFromApi]);

  // Manejo básico online/offline para evitar que quede en error tras caer internet.
  useEffect(() => {
    function handleOnline() {
      console.log('[Player] Evento: online');
      setConnected(true);
      setImageError('');
      setReloadToken((t) => t + 1);
      syncPlaylistFromApi();
      try {
        clientRef.current?.reconnect?.();
      } catch (e) {
        console.warn('[Player] reconnect() falló:', e);
      }
    }

    function handleOffline() {
      console.warn('[Player] Evento: offline');
      setConnected(false);
      // No sobreescribimos imageError si ya estabas mostrando un mensaje de error de carga.
    }

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);
    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [syncPlaylistFromApi]);

  useEffect(() => {
    const currentMedia = playlist[currentIndex];
    if (!currentMedia) {
      setCurrentImageSrc('');
      return;
    }

    let cancelled = false;
    const remoteUrl = resolveMediaUrl(currentMedia);

    async function resolveImageSource() {
      if (!('caches' in globalThis)) {
        if (!cancelled) setCurrentImageSrc(remoteUrl);
        return;
      }
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const cachedResp = await cache.match(remoteUrl);
        if (cachedResp) {
          const blob = await cachedResp.blob();
          if (!cancelled) {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = URL.createObjectURL(blob);
            setCurrentImageSrc(blobUrlRef.current);
          }
          return;
        }
      } catch (err) {
        console.warn('[Player] Error leyendo cache local:', err);
      }
      if (!cancelled) setCurrentImageSrc(remoteUrl);
    }

    resolveImageSource();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, playlist, reloadToken, resolveMediaUrl]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const advanceSlide = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
      setFade(true);
    }, 500);
  }, [playlist.length]);

  useEffect(() => {
    if (playlist.length <= 1) return;

    const currentItem = playlist[currentIndex];
    if (isVideoMedia(currentItem)) return;
    const duration = (currentItem?.duration || 10) * 1000;

    timerRef.current = setTimeout(advanceSlide, duration);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, playlist, advanceSlide, isVideoMedia]);

  // Single image: just show it without advancing
  useEffect(() => {
    if (playlist.length === 1) setFade(true);
  }, [playlist]);

  if (playlist.length === 0) {
    return (
      <div style={styles.waiting}>
        <div style={styles.waitingContent}>
          <div style={styles.logo}>📺</div>
          <h1 style={styles.title}>Digital Signage Mi celu</h1>
          <p style={styles.deviceId}>{DEVICE_ID}</p>
          <div style={styles.statusRow}>
            <span style={{
              ...styles.statusDot,
              backgroundColor: connected ? '#22c55e' : '#ef4444',
            }} />
            <span style={styles.statusText}>
              {connected ? 'Conectado - Esperando contenido...' : 'Conectando al servidor...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentMedia = playlist[currentIndex];
  const imageUrl = currentImageSrc || resolveMediaUrl(currentMedia);
  const currentIsVideo = isVideoMedia(currentMedia);

  return (
    <div style={styles.player}>
      {imageError ? (
        <div style={styles.errorBanner}>{imageError}</div>
      ) : null}
      {currentIsVideo ? (
        <video
          key={`${currentMedia?.id}-${currentIndex}-${reloadToken}`}
          src={imageUrl}
          style={{
            ...styles.slide,
            opacity: fade ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
          autoPlay
          playsInline
          muted
          loop={playlist.length === 1}
          onEnded={() => {
            if (playlist.length > 1) advanceSlide();
          }}
          onError={() => {
            const msg = `No se pudo cargar el video. URL: ${imageUrl} (API debe ser alcanzable desde este dispositivo; en TV/Android usa la IP del PC, no localhost).`;
            console.error('[Player]', msg);
            setImageError(msg);
          }}
          onLoadedData={() => setImageError('')}
        />
      ) : (
        <img
          key={`${currentMedia?.id}-${currentIndex}-${reloadToken}`}
          src={imageUrl}
          alt=""
          style={{
            ...styles.slide,
            opacity: fade ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
          onError={() => {
            const msg = `No se pudo cargar la imagen. URL: ${imageUrl} (API debe ser alcanzable desde este dispositivo; en TV/Android usa la IP del PC, no localhost).`;
            console.error('[Player]', msg);
            setImageError(msg);
          }}
          onLoad={() => setImageError('')}
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
  serverInfo: {
    fontSize: '11px',
    color: '#475569',
    fontFamily: 'monospace',
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
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    background: '#7f1d1d',
    color: '#fecaca',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
  },
};
