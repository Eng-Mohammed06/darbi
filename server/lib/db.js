import pg from 'pg';

// Railway injects DATABASE_URL when you reference the Postgres service:
//   DATABASE_URL = ${{Postgres.DATABASE_URL}}
// Locally it points at the docker-compose container (see .env.example).
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Locally: `npm run db:up` then copy .env.example to .env. ' +
      'On Railway: add a Postgres service and set DATABASE_URL = ${{Postgres.DATABASE_URL}}',
  );
}

// Railway's managed Postgres terminates TLS with a cert Node does not trust by
// default. Everything stays inside the project's private network, so relaxing
// verification here is scoped to that hop — not a public-internet connection.
const isRailway = /\.railway\.(app|internal)/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: isRailway ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

/** Run a parameterised query. Always pass values as $1, $2 — never interpolate. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Run several statements in one transaction, rolling back on any throw. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
