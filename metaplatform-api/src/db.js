/**
 * Database entry point.
 *
 * Re-exports from db-adapter.js which selects SQLite or PostgreSQL
 * based on the DATABASE_URL environment variable.
 *
 * All 27 route files continue to import from "../db.js" unchanged.
 */
export { default } from "./db-adapter.js";
