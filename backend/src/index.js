require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Op } = require('sequelize');
const sequelize = require('./database');
const { setupMQTT } = require('./services/mqtt');
require('./models');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/screens', require('./routes/screens'));
app.use('/api/media', require('./routes/media'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT || '3000');

async function start() {
  try {
    await sequelize.sync();
    console.log('[DB] Base de datos sincronizada');

    setupMQTT();

    // Mark screens offline if no heartbeat in 60 seconds
    setInterval(async () => {
      try {
        const { Screen } = require('./models');
        const threshold = new Date(Date.now() - 60000);
        await Screen.update(
          { status: 'offline' },
          {
            where: {
              status: 'online',
              last_heartbeat: { [Op.lt]: threshold },
            },
          }
        );
      } catch {}
    }, 30000);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] Servidor corriendo en http://0.0.0.0:${PORT}`);
      console.log(`[API] Uploads en ${uploadDir}`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err);
    process.exit(1);
  }
}

start();
