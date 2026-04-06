const User      = require('./User');
const Venue     = require('./Venue');
const Screen    = require('./Screen');
const Media     = require('./Media');
const ScreenMedia = require('./ScreenMedia');

// Venue → Screens
Venue.hasMany(Screen,  { foreignKey: 'venue_id', as: 'Screens', onDelete: 'CASCADE' });
Screen.belongsTo(Venue, { foreignKey: 'venue_id', as: 'Venue' });

// Screen → ScreenMedia → Media  (sin belongsToMany para evitar conflictos)
Screen.hasMany(ScreenMedia,    { foreignKey: 'screen_id', as: 'ScreenMedia', onDelete: 'CASCADE' });
ScreenMedia.belongsTo(Screen,  { foreignKey: 'screen_id' });

Media.hasMany(ScreenMedia,     { foreignKey: 'media_id', onDelete: 'CASCADE' });
ScreenMedia.belongsTo(Media,   { foreignKey: 'media_id', as: 'Media' });

module.exports = { User, Venue, Screen, Media, ScreenMedia };
