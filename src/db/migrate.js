const fs = require('node:fs');
const path = require('node:path');
function migrate(db) {
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations', '001-initial.sql'), 'utf8'));
}
module.exports = {migrate};
