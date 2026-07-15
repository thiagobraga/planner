import pg from "pg";
import { DATABASE_URL } from "../config.js";

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export default pool;
