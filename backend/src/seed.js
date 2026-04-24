import bcrypt from "bcryptjs";
import { pool, query } from "./db.js";

const users = [
  ["Administrador", "admin@rutas.local", "administrador"],
  ["Supervisor", "supervisor@rutas.local", "supervisor"],
  ["Operador Campo", "operador@rutas.local", "operador"],
  ["Pantalla Publica", "publico@rutas.local", "publico"],
];

async function seed() {
  const passwordHash = await bcrypt.hash("Rutas123", 10);
  for (const [name, email, role] of users) {
    await query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, $4)
       on conflict (email) do nothing`,
      [name, email, passwordHash, role]
    );
  }
  console.log("Usuarios iniciales listos. Password: Rutas123");
  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
