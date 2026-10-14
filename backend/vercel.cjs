const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, 'dist', 'server.js'),
  path.join(__dirname, 'backend', 'dist', 'server.js'),
  path.join(process.cwd(), 'dist', 'server.js'),
  path.join(process.cwd(), 'backend', 'dist', 'server.js'),
];

const server = candidates.find((file) => fs.existsSync(file));
if (!server) {
  console.error('API bundle missing', {
    dirname: __dirname,
    cwd: process.cwd(),
    candidates,
  });
  throw new Error('API bundle missing');
}

require(server);
