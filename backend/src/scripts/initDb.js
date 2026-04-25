import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, "../../sql/schema.sql");

const requiredEnv = [
  ["DB_HOST", "MYSQLHOST"],
  ["DB_PORT", "MYSQLPORT"],
  ["DB_USER", "MYSQLUSER"],
  ["DB_PASSWORD", "MYSQLPASSWORD"],
  ["DB_NAME", "MYSQLDATABASE"],
];

const initialUsers = [
  { name: "Administrador", email: "admin@rutas.local", role: "administrador" },
  { name: "Supervisor", email: "supervisor@rutas.local", role: "supervisor" },
  { name: "Operador Campo", email: "operador@rutas.local", role: "operador" },
  { name: "Pantalla Pública", email: "publico@rutas.local", role: "publico" },
];

function env(primary, fallback) {
  return process.env[primary] || process.env[fallback] || "";
}

function getDatabaseConfig() {
  const missing = requiredEnv
    .filter(([primary, fallback]) => !env(primary, fallback))
    .map(([primary, fallback]) => `${primary} o ${fallback}`);

  if (missing.length > 0) {
    throw new Error(`Faltan variables de base de datos: ${missing.join(", ")}`);
  }

  return {
    host: env("DB_HOST", "MYSQLHOST"),
    port: Number(env("DB_PORT", "MYSQLPORT")),
    user: env("DB_USER", "MYSQLUSER"),
    password: env("DB_PASSWORD", "MYSQLPASSWORD"),
    database: env("DB_NAME", "MYSQLDATABASE"),
    multipleStatements: true,
  };
}

function assertSafeSchema(schema) {
  const dangerousPattern = /\b(drop\s+(database|schema|table)|truncate\s+table|delete\s+from)\b/i;
  const match = schema.match(dangerousPattern);
  if (match) {
    throw new Error(`schema.sql contiene una sentencia no permitida: ${match[0]}`);
  }
}

async function seedInitialUsers(connection) {
  const passwordHash = await bcrypt.hash("Rutas123", 10);

  for (const user of initialUsers) {
    await connection.execute(
      `insert into users (name, email, password_hash, role, is_active)
       values (?, ?, ?, ?, true)
       on duplicate key update
         name = values(name),
         role = values(role),
         is_active = true`,
      [user.name, user.email, passwordHash, user.role]
    );
  }
}

async function initDb() {
  let connection;
  try {
    console.log("Conectando a MySQL...");
    connection = await mysql.createConnection(getDatabaseConfig());

    console.log("Ejecutando schema.sql...");
    const schema = await readFile(schemaPath, "utf8");
    assertSafeSchema(schema);
    await connection.query(schema);
    console.log("Tablas verificadas/creadas...");

    console.log("Verificando usuarios iniciales...");
    await seedInitialUsers(connection);

    console.log("Base de datos inicializada correctamente.");
  } catch (error) {
    console.error(`No se pudo inicializar la base de datos: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

initDb();
