import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const params = new URLSearchParams(window.location.search);
const DEVICE_ID = params.get('device') || 'screen-001';
/** Si abres el player por IP/Dominio, HOST ya apunta al PC. En Android usa http://IP_PC:5174/?device=... */
const HOST = params.get('host') || window.location.hostname || 'localhost';
const API_PORT = params.get('api_port') || '3000';
const MQTT_PORT = params.get('mqtt_port') || '8083';
const API_URL = `http://${HOST}:${API_PORT}`;
const MQTT_URL = `ws://${HOST}:${MQTT_PORT}`;

export default function App() {
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [fade, setFade] = useState(true);
  const [imageError, setImageError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const clientRef = useRef(null);
  const timerRef = useRef(null);
  const heartbeatRef = useRef(null);

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
      console.log(`[Player] Conectado a MQTT (clientId=${client.options.clientId})`);
      setConnected(true);
      // Al reconectar a MQTT, forzamos recarga de la imagen para evitar "pantalla congelada"
      setImageError('');
      setReloadToken((t) => t + 1);
      client.subscribe(`signage/${DEVICE_ID}/playlist`, { qos: 1 });
      client.subscribe(`signage/${DEVICE_ID}/command`, { qos: 1 });

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
          if (data.items && Array.isArray(data.items)) {
            setPlaylist(data.items);
            setCurrentIndex(0);
            setImageError('');
            setReloadToken((t) => t + 1);
          }
        }

        if (topic.endsWith('/command')) {
          console.log('[Player] Comando recibido:', data);
          if (data.type === 'reload') window.location.reload();
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

    return () => {
      clearInterval(heartbeatRef.current);
      client.end();
    };
  }, []);

  // Manejo básico online/offline para evitar que quede en error tras caer internet.
  useEffect(() => {
    function handleOnline() {
      console.log('[Player] Evento: online');
      setConnected(true);
      setImageError('');
      setReloadToken((t) => t + 1);
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    const duration = (currentItem?.duration || 10) * 1000;

    timerRef.current = setTimeout(advanceSlide, duration);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, playlist, advanceSlide]);

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
          <p style={styles.serverInfo}>
            API: {API_URL} | MQTT: {MQTT_URL}
          </p>
        </div>
      </div>
    );
  }

  const currentMedia = playlist[currentIndex];
  const rawUrl = currentMedia?.url || '';
  const imageUrl = rawUrl.startsWith('http') ? rawUrl : `${API_URL}${rawUrl}`;

  return (
    <div style={styles.player}>
      {imageError ? (
        <div style={styles.errorBanner}>{imageError}</div>
      ) : null}
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

      <div style={styles.counter}>
        {currentIndex + 1} / {playlist.length}
      </div>
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
  counter: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    opacity: 0.5,
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
