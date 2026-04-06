const router = require('express').Router();
const auth = require('../middleware/auth');
const { Venue, Screen } = require('../models');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const venues = await Venue.findAll({
      include: [{ model: Screen, as: 'Screens', attributes: ['id'] }],
      order: [['createdAt', 'DESC']],
    });
    const result = venues.map((v) => {
      const json = v.toJSON();
      return { ...json, screenCount: Array.isArray(json.Screens) ? json.Screens.length : 0 };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id, {
      include: [{ model: Screen, as: 'Screens' }],
    });
    if (!venue) return res.status(404).json({ error: 'Sede no encontrada' });
    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const venue = await Venue.create(req.body);
    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    if (!venue) return res.status(404).json({ error: 'Sede no encontrada' });
    await venue.update(req.body);
    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const venue = await Venue.findByPk(req.params.id);
    if (!venue) return res.status(404).json({ error: 'Sede no encontrada' });
    await venue.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
