# Digital Signage - MVP

Sistema de señalización digital con dashboard web, player web con MQTT, y app Android WebView wrapper.

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                      TU PC (Servidor)                     │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Backend    │  │   Dashboard  │  │     Player     │  │
│  │  Express API │  │  React+Vite  │  │  React+MQTT.js │  │
│  │  Puerto 3000 │  │  Puerto 5173 │  │  Puerto 5174   │  │
│  └──────┬───────┘  └──────────────┘  └────────────────┘  │
│         │                                                │
│  ┌──────┴───────┐                                        │
│  │  MQTT Broker │                                        │
│  │  (Aedes)     │                                        │
│  │  WS: 8083    │                                        │
│  │  TCP: 1883   │                                        │
│  └──────────────┘                                        │
└──────────────────────────────────────────────────────────┘
         │ WiFi
         ▼
┌──────────────────┐
│  MXQ PRO 4K      │
│  App WebView      │
│  Carga Player    │
│  Puerto 5174     │
└──────────────────┘
```

## Requisitos Previos

- **Node.js** v18 o superior ([descargar](https://nodejs.org/))
- **Android Studio** (solo para compilar el APK)
- Tu PC y el MXQ PRO 4K en la **misma red WiFi**

## Paso a Paso - Prueba Local

### PASO 1: Instalar dependencias

Abre 3 terminales en la carpeta del proyecto:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
```

**Terminal 2 - Frontend Dashboard:**
```bash
cd frontend
npm install
```

**Terminal 3 - Player:**
```bash
cd player
npm install
```

### PASO 2: Inicializar la base de datos

En la Terminal 1 (backend):
```bash
npm run seed
```

Esto crea:
- Usuario: `admin` / Password: `admin123`
- Sede: "Sede Principal"
- Pantallas: `screen-001`, `screen-002`

### PASO 3: Iniciar los servidores

**Terminal 1 - Backend** (API + MQTT Broker):
```bash
npm run dev
```
Verás:
```
[DB] Base de datos sincronizada
[MQTT] TCP broker en puerto 1883
[MQTT] WebSocket en puerto 8083
[API] Servidor corriendo en http://0.0.0.0:3000
```

**Terminal 2 - Dashboard:**
```bash
npm run dev
```
Verás: `Local: http://localhost:5173/`

**Terminal 3 - Player:**
```bash
npm run dev
```
Verás: `Local: http://localhost:5174/`

### PASO 4: Probar en el navegador

1. **Dashboard**: Abre http://localhost:5173
   - Login: `admin` / `admin123`
   - Ve a **Media** y sube algunas imágenes (drag & drop)
   - Ve a **Pantallas** → click en **"Pantalla Lobby"**
   - Click **"+ Agregar Media"** → selecciona imágenes
   - Configura la duración (segundos) de cada imagen
   - Click **"Guardar y Publicar"**

2. **Player**: Abre http://localhost:5174/?device=screen-001
   - Verás la pantalla de espera
   - Cuando publiques el playlist desde el dashboard, el player lo recibirá automáticamente via MQTT
   - Las imágenes rotarán con transiciones suaves

### PASO 5: Verificar MQTT

- En el Dashboard, ve a una pantalla → verás "En línea" si el player está corriendo
- El player envía heartbeat cada 30 segundos
- Puedes enviar comandos (Recargar, Actualizar) desde el detalle de la pantalla

---

## Despliegue en MXQ PRO 4K

### PASO 6: Obtener tu IP local

En Windows (PowerShell):
```bash
ipconfig
```
Busca tu **IPv4 Address** (ej: `192.168.1.100`)

### Misma red Wi‑Fi: ¿cómo entra el MXQ a tu PC?

Sí: **si el MXQ y tu PC están en la misma Wi‑Fi** (normalmente la misma subred, p. ej. `192.168.1.x`), el aparato puede llamar a los servicios de tu PC usando **la IPv4 de tu PC**, no `localhost`. En el Android, `localhost` es **el propio MXQ**, no tu ordenador.

| Servicio | Puerto | URL típica desde el MXQ (ejemplo IP PC = `192.168.1.100`) |
|----------|--------|-------------------------------------------------------------|
| Player (Vite) | 5174 | `http://192.168.1.100:5174/?device=screen-001` |
| API + imágenes | 3000 | `http://192.168.1.100:3000` (el player la usa solo) |
| MQTT WebSocket | 8083 | `ws://192.168.1.100:8083` (el player la usa solo) |

El **WebView del APK** solo abre la URL del player (`5174`). Esa página, ya cargada en el MXQ, construye sola la API (`3000`) y el MQTT (`8083`) usando **el mismo host** que pusiste en la URL (por hostname de la barra de direcciones), salvo que añadas `&host=...` en la query.

**Qué debes tener en marcha en tu PC** (misma red): `npm run dev` en **backend**, **player** y, para administrar, **frontend**.

**Firewall de Windows:** puede bloquear conexiones entrantes a los puertos 3000, 5174 y 8083. Si el MXQ no carga la página, permite **Node.js** (o esos puertos) en *Firewall de Windows* o prueba temporalmente con el firewall desactivado solo para diagnosticar.

**Router / Wi‑Fi de invitados:** algunas redes “Invitado” **aislan** dispositivos entre sí; si no hay ping entre MXQ y PC, usa la Wi‑Fi principal o desactiva el aislamiento en el router si tu modelo lo permite.

### PASO 7: Compilar el APK

1. Abre la carpeta `android/` con **Android Studio**
2. En `app/src/main/java/com/digitalsignage/player/MainActivity.kt`, cambia:
   ```kotlin
   private val SERVER_URL = "http://192.168.1.100:5174/?device=screen-001"
   ```
   Reemplaza `192.168.1.100` con TU IP local.

3. Build → Build Bundle(s)/APK(s) → Build APK(s)
4. El APK estará en `android/app/build/outputs/apk/debug/app-debug.apk`

### PASO 8: Instalar en MXQ PRO 4K

**Opción A - USB:**
1. Copia el APK a un USB
2. Conecta el USB al MXQ PRO 4K
3. Usa un File Manager para encontrar e instalar el APK
4. Habilita "Fuentes desconocidas" en Configuración → Seguridad

**Opción B - ADB (si tienes cable USB-A a USB-A):**
```bash
adb connect <IP_DEL_MXQ>:5555
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Opción C - ADB WiFi:**
1. En el MXQ PRO, ve a Configuración → Acerca de → toca "Build number" 7 veces
2. En Opciones de Desarrollador, habilita "Depuración USB" y "Depuración ADB por red"
3. Desde tu PC:
   ```bash
   adb connect <IP_DEL_MXQ>:5555
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### PASO 9: Configurar como Launcher

Al abrir la app, Android te preguntará si quieres usarla como launcher (pantalla de inicio).
Selecciona "Digital Signage" y "Siempre".

Esto hace que al encender el MXQ PRO, la app se abra automáticamente.

---

## Estructura del Proyecto

```
├── backend/                 # API REST + MQTT Broker
│   ├── src/
│   │   ├── index.js        # Servidor principal
│   │   ├── database.js     # Configuración SQLite
│   │   ├── models/         # Modelos Sequelize
│   │   ├── routes/         # Endpoints API
│   │   ├── middleware/      # JWT auth
│   │   └── services/       # MQTT broker + client
│   ├── seed.js             # Datos iniciales
│   └── uploads/            # Imágenes subidas
│
├── frontend/               # Dashboard Admin
│   └── src/
│       ├── pages/          # Login, Dashboard, Venues, Screens, Media
│       ├── components/     # Layout, etc.
│       └── AuthContext.jsx  # Autenticación
│
├── player/                 # Player para pantallas
│   └── src/
│       └── App.jsx         # MQTT + Slideshow
│
└── android/                # WebView Wrapper
    └── app/src/main/
        └── java/.../MainActivity.kt
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Registro |
| GET/POST/PUT/DELETE | /api/venues | CRUD Sedes |
| GET/POST/PUT/DELETE | /api/screens | CRUD Pantallas |
| GET | /api/screens/:id | Detalle + playlist |
| POST | /api/screens/:id/playlist | Asignar playlist |
| POST | /api/screens/:id/command | Enviar comando |
| GET/POST/DELETE | /api/media | Gestión de archivos |
| POST | /api/media/upload | Subir archivos |

## MQTT Topics

| Topic | Dirección | Descripción |
|-------|-----------|-------------|
| signage/{device_id}/playlist | Server → Player | Playlist actualizado |
| signage/{device_id}/command | Server → Player | Comandos (reload, refresh) |
| signage/{device_id}/heartbeat | Player → Server | Estado del dispositivo |

## Puertos

| Servicio | Puerto | Protocolo |
|----------|--------|-----------|
| API Backend | 3000 | HTTP |
| Dashboard | 5173 | HTTP |
| Player | 5174 | HTTP |
| MQTT TCP | 1883 | MQTT |
| MQTT WebSocket | 8083 | WS |

## Troubleshooting

**El player no se conecta al MQTT:**
- Verifica que el backend esté corriendo
- Verifica que el firewall de Windows permita los puertos 3000, 5174, 8083
- En Windows: Panel de Control → Firewall → Permitir aplicación → node.js

**El MXQ PRO no carga la página:**
- Verifica que esté en la misma red WiFi
- Prueba acceder desde el navegador del MXQ a `http://TU_IP:5174/?device=screen-001`
- Verifica la IP en el código de MainActivity.kt

**Las imágenes no se muestran en el player:**
- Verifica que el backend esté corriendo en puerto 3000
- Las imágenes se sirven desde `http://TU_IP:3000/uploads/`
