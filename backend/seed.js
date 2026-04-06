require('dotenv').config();
const bcrypt = require('bcryptjs');
const sequelize = require('./src/database');
const { User, Venue, Screen } = require('./src/models');

async function seed() {
  await sequelize.sync({ force: true });

  const password = await bcrypt.hash('admin123', 10);
  await User.create({ username: 'admin', password, role: 'admin' });

  const sede = await Venue.create({
    name: 'Sede Principal',
    address: 'Calle Principal #123',
    description: 'Sede principal de la empresa',
  });

  await Screen.create({
    name: 'Pantalla Lobby',
    venue_id: sede.id,
    device_id: 'screen-001',
    orientation: 'landscape',
  });

  await Screen.create({
    name: 'Pantalla Recepción',
    venue_id: sede.id,
    device_id: 'screen-002',
    orientation: 'landscape',
  });

  console.log('=================================');
  console.log('  Seed completado!');
  console.log('  Usuario: admin');
  console.log('  Password: admin123');
  console.log('  Sede: Sede Principal');
  console.log('  Pantallas: screen-001, screen-002');
  console.log('=================================');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
