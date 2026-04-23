const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const auth = require('../middleware/auth');
const { Media } = require('../models');

const uploadDir = path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']);
const VIDEO_EXT = new Set([
  '.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.ogv', '.ogg',
  '.mpeg', '.mpg', '.wmv', '.3gp', '.3g2', '.flv', '.f4v', '.ts', '.m2ts',
  '.qt', '.asf', '.vob',
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/')) {
      cb(null, true);
      return;
    }
    if (mime.startsWith('video/')) {
      cb(null, true);
      return;
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten imágenes y videos'));
  },
});

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const media = await Media.findAll({ order: [['createdAt', 'DESC']] });
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.array('files', 20), async (req, res) => {
  try {
    const mediaItems = [];
    for (const file of req.files) {
      const media = await Media.create({
        filename: file.filename,
        original_name: file.originalname,
        url: `/uploads/${file.filename}`,
        mime_type: file.mimetype,
        size: file.size,
      });
      mediaItems.push(media);
    }
    res.status(201).json(mediaItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media no encontrado' });

    const filePath = path.join(uploadDir, media.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await media.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
