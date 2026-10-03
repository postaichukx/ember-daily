import {readFileSync,readdirSync} from 'node:fs';
export function migrateLocal(sqlite) {
  sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
  for (const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
    if (sqlite.prepare('SELECT name FROM _local_migrations WHERE name = ?').get(file)) continue;
    const legacy = file.startsWith('0000_') && sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_state'").get();
    sqlite.exec('BEGIN');
    try {
      if (!legacy) sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
      sqlite.prepare('INSERT INTO _local_migrations (name) VALUES (?)').run(file);
      sqlite.exec('COMMIT');
    } catch(error) { sqlite.exec('ROLLBACK'); throw error; }
  }
}
export function d1Adapter(sqlite) {
  return {prepare(query) { return {bind(...values) { return {
    async first() { return sqlite.prepare(query).get(...values)??null; },
    async run() { const r=sqlite.prepare(query).run(...values); return {meta:{changes:Number(r.changes)}}; }
  }; }}; }};
}
