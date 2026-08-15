const Database = require('better-sqlite3');
const db = new Database('data/friday_brain.db');

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
).all().map(r => r.name);

console.log('Tables found:', tables);

tables.forEach(t => {
  try {
    db.prepare(`DELETE FROM "${t}"`).run();
    console.log(`Cleared: ${t}`);
  } catch (e) {
    console.warn(`Could not clear ${t}:`, e.message);
  }
});

db.close();
console.log('\nAll demo data wiped. Database is now clean.');
