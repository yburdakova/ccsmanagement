const profile = String(process.env.APP_ENV || 'local').trim().toLowerCase();

const provider =
  profile === 'backend'
    ? require('./backend-api')
    : require('./db');

module.exports = provider;

