const router = require('express').Router();
const auth = require('../middleware/auth');
const { Screen, Venue, Media, ScreenMedia } = require('../models');
const { publishPlaylist, publishCommand } = require('../services/mqtt');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const screens = await Screen.findAll({
      include: [{ model: Venue, as: 'Venue', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(screens);
  } catch (err) {
    console.error('[screens GET /]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const screen = await Screen.findByPk(req.params.id, {
      include: [
        { model: Venue, as: 'Venue', attributes: ['id', 'name'] },
        {
          model: ScreenMedia,
          as: 'ScreenMedia',
          include: [{ model: Media, as: 'Media' }],
          separate: true,
          order: [['position', 'ASC']],
        },
      ],
    });
    if (!screen) return res.status(404).json({ error: 'Pantalla no encontrada' });
    res.json(screen);
  } catch (err) {
    console.error('[screens GET /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const screen = await Screen.create(req.body);
    res.status(201).json(screen);
  } catch (err) {
    console.error('[screens POST /]', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const screen = await Screen.findByPk(req.params.id);
    if (!screen) return res.status(404).json({ error: 'Pantalla no encontrada' });
    await screen.update(req.body);
    res.json(screen);
  } catch (err) {
    console.error('[screens PUT /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const screen = await Screen.findByPk(req.params.id);
    if (!screen) return res.status(404).json({ error: 'Pantalla no encontrada' });
    await screen.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('[screens DELETE /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/playlist', async (req, res) => {
  try {
    const screen = await Screen.findByPk(req.params.id);
    if (!screen) return res.status(404).json({ error: 'Pantalla no encontrada' });

    const { items } = req.body;
    console.log('[playlist] Recibido:', JSON.stringify(items));

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items[] requerido' });
    }

    const sanitized = items
      .map((item, idx) => ({
        screen_id: screen.id,
        media_id:  Number(item.media_id),
        duration:  Number(item.duration) || 10,
        position:  item.position !== undefined ? Number(item.position) : idx,
      }))
      .filter((row) => row.media_id && !Number.isNaN(row.media_id));

    console.log('[playlist] Sanitized:', JSON.stringify(sanitized));

    // Verificar que los media_id existen realmente
    for (const row of sanitized) {
      const exists = await Media.findByPk(row.media_id);
      if (!exists) {
        console.error(`[playlist] Media ${row.media_id} no existe en la base de datos`);
        return res.status(400).json({ error: `Media con id ${row.media_id} no existe` });
      }
    }

    await ScreenMedia.destroy({ where: { screen_id: screen.id } });
    console.log('[playlist] ScreenMedia eliminados para screen_id', screen.id);

    if (sanitized.length > 0) {
      await ScreenMedia.bulkCreate(sanitized);
      console.log('[playlist] bulkCreate OK:', sanitized.length, 'filas');
    }

    // Verificar lo que quedó guardado
    const rawRows = await ScreenMedia.findAll({ where: { screen_id: screen.id } });
    console.log('[playlist] Filas en DB tras bulkCreate:', rawRows.map((r) => r.toJSON()));

    const rows = await ScreenMedia.findAll({
      where: { screen_id: screen.id },
      include: [{ model: Media, as: 'Media' }],
      order: [['position', 'ASC']],
    });

    console.log('[playlist] Filas con Media:', rows.map((r) => ({
      id: r.id, screen_id: r.screen_id, media_id: r.media_id, media: r.Media?.id,
    })));

    const playlistData = rows
      .filter((r) => r.Media != null)
      .map((r) => ({
        id:       r.Media.id,
        url:      r.Media.url,
        filename: r.Media.original_name,
        duration: r.duration,
        position: r.position,
      }));

    publishPlaylist(screen.device_id, { items: playlistData });

    res.json({ success: true, playlist: playlistData });
  } catch (err) {
    console.error('[playlist] ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/command', async (req, res) => {
  try {
    const screen = await Screen.findByPk(req.params.id);
    if (!screen) return res.status(404).json({ error: 'Pantalla no encontrada' });
    publishCommand(screen.device_id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('[screens command]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
