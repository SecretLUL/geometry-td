import pgPromise from 'pg-promise';

const pgp = pgPromise();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const dbName = process.env.DB_NAME || 'geometry_td';
const dbUser = process.env.DB_USER || 'gtd_user';
const dbPassword = process.env.DB_PASSWORD || 'sicheres_passwort_dev';

const cn = {
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
  max: 10, // maximum number of clients in the pool
};

console.log(`[DATABASE] Verbindungsdaten: Host=${dbHost}, Port=${dbPort}, Database=${dbName}, User=${dbUser}`);

export const db = pgp(cn);

// Hilfsfunktion zur Initialisierung des Schemas
export async function initDatabaseSchema() {
  try {
    // 1. Tabelle users erstellen
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DATABASE] Tabelle "users" verifiziert.');

    // 2. Tabelle progress erstellen
    await db.none(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        highest_wave INTEGER DEFAULT 0,
        unlocked_skins JSONB DEFAULT '["default"]'::jsonb,
        unlocked_achievements JSONB DEFAULT '[]'::jsonb,
        selected_skin VARCHAR(50) DEFAULT 'default',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DATABASE] Tabelle "progress" verifiziert.');
    
    console.log('[DATABASE] Schema-Initialisierung erfolgreich abgeschlossen.');
  } catch (error) {
    console.error('[DATABASE] Fehler bei der Schema-Initialisierung:', error);
    throw error;
  }
}
