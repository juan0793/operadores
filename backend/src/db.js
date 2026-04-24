import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool({
  host: config.dbHost,
  port: config.dbPort,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

export async function query(text, params = []) {
  const sql = text.replace(/\$\d+/g, "?");
  const [rows] = await pool.execute(sql, params);
  return { rows };
}

export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = {
      async query(text, params = []) {
        const sql = text.replace(/\$\d+/g, "?");
        const [rows] = await connection.execute(sql, params);
        return { rows };
      },
    };
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
