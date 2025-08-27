const dns = require('dns');

function isOnline() {
  return new Promise((resolve) => {
    dns.lookup('google.com', (err) => {
      resolve(!err);
    });
  });
}

module.exports = { isOnline };
