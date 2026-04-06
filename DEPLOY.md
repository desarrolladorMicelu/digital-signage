# Guía de Despliegue en Azure

## Arquitectura en producción

```
Internet
   │
   ├── :80   → Frontend Dashboard  (nginx → React build)
   ├── :5174 → Player Web          (nginx → React build)   ← MXQ apunta aquí
   ├── :3000 → Backend API         (Node.js + Express)     ← nginx frontend proxea /api/
   └── :8083 → MQTT WebSocket      (Aedes broker)          ← player se conecta aquí

Todo corre en un Azure VM con Docker Compose.
Las imágenes se almacenan en GitHub Container Registry (GHCR) - gratuito.
```

---

## PASO 1: Crear la VM en Azure

1. Portal Azure → **Crear recurso → Máquina Virtual**
2. Configuración mínima:
   - **OS**: Ubuntu Server 22.04 LTS
   - **Tamaño**: B2s (2 vCPU, 4GB RAM) — aprox $30/mes
   - **Autenticación**: clave SSH (guarda la clave privada)
3. En **Redes → Puertos de entrada**, abre:
   - 22 (SSH)
   - 80 (Dashboard)
   - 5174 (Player)
   - 3000 (API — opcional si usas proxy)
   - 8083 (MQTT WebSocket)

---

## PASO 2: Preparar la VM

Conéctate vía SSH:
```bash
ssh -i tu_clave.pem azureuser@IP_DE_TU_VM
```

Instala Docker y Docker Compose:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
newgrp docker                        # aplica el grupo sin cerrar sesión
docker --version                     # debe mostrar la versión
```

Crea el directorio de la app:
```bash
sudo mkdir -p /opt/digital-signage
sudo chown $USER:$USER /opt/digital-signage
cd /opt/digital-signage
```

---

## PASO 3: Crear `.env.production` en la VM

```bash
nano /opt/digital-signage/.env.production
```

Contenido (reemplaza los valores):
```
REGISTRY=ghcr.io/TU_USUARIO_GITHUB/digital-signage
IMAGE_TAG=latest
JWT_SECRET=pon-aqui-una-clave-larga-y-aleatoria-minimo-32-chars
```

Para generar JWT_SECRET aleatorio:
```bash
openssl rand -hex 32
```

---

## PASO 4: Subir el docker-compose.yml a la VM

Copia el `docker-compose.yml` del repositorio a la VM:
```bash
# Desde tu PC local:
scp -i tu_clave.pem docker-compose.yml azureuser@IP_VM:/opt/digital-signage/
```

O en la VM, descárgalo desde GitHub una vez que hayas hecho push:
```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/docker-compose.yml
```

---

## PASO 5: Configurar secrets en GitHub

En tu repositorio GitHub → **Settings → Secrets and variables → Actions**,
agrega estos secrets:

| Secret | Valor |
|--------|-------|
| `AZURE_VM_HOST` | IP pública de tu Azure VM (ej: `20.50.10.5`) |
| `AZURE_VM_USER` | Usuario SSH (normalmente `azureuser`) |
| `AZURE_VM_SSH_KEY` | Contenido completo de tu clave privada SSH (`.pem`) |

> **Nota**: `GITHUB_TOKEN` lo genera GitHub automáticamente, no necesitas crearlo.

---

## PASO 6: Primer deploy manual (solo la primera vez)

En la VM, antes de que GitHub Actions haga el primer deploy, inicializa la base de datos:

```bash
cd /opt/digital-signage

# Login al registry
echo "TU_GITHUB_TOKEN" | docker login ghcr.io -u TU_USUARIO --password-stdin

# Levantar solo el backend para crear la DB
docker compose --env-file .env.production up -d backend

# Esperar que arranque
sleep 10

# Correr el seed (crea admin/admin123 y datos iniciales)
docker compose --env-file .env.production exec backend node seed.js

# Levantar todo
docker compose --env-file .env.production up -d
```

---

## PASO 7: Push a main → deploy automático

```bash
git add .
git commit -m "feat: primer deploy en Azure"
git push origin main
```

GitHub Actions hará:
1. Build de las 3 imágenes Docker (backend, frontend, player)
2. Push a GHCR (gratuito para repositorios públicos y privados con límites)
3. SSH a la VM → pull de nuevas imágenes → restart de contenedores

Puedes ver el progreso en **GitHub → Actions**.

---

## PASO 8: Actualizar el APK del MXQ

Cuando el servidor ya esté en Azure, cambia la URL en el APK:

En `android/app/src/main/java/com/digitalsignage/player/MainActivity.kt`:
```kotlin
private val SERVER_URL = "http://IP_DE_AZURE:5174/?device=screen-001"
```

Recompila y reinstala con ADB.

---

## URLs en producción

| Servicio | URL |
|----------|-----|
| Dashboard | `http://IP_AZURE` |
| Player | `http://IP_AZURE:5174/?device=screen-001` |
| API Health | `http://IP_AZURE:3000/api/health` |

---

## Ver logs en producción

```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo un servicio específico
docker compose logs -f player
```

## Reinicio manual

```bash
cd /opt/digital-signage
docker compose --env-file .env.production restart
```

## Backup de la base de datos y uploads

```bash
# Crear backup
docker compose --env-file .env.production exec backend \
  cp /app/data/database.sqlite /app/uploads/backup_$(date +%Y%m%d).sqlite

# Descargar a tu PC
scp -i tu_clave.pem azureuser@IP_VM:/opt/digital-signage/uploads/backup_*.sqlite ./
```
