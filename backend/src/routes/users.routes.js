import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(4).optional(),
  role: z.enum(["administrador", "supervisor", "operador", "publico"]),
  phone: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

router.use(authenticate, authorize("administrador", "supervisor"));

router.get("/", async (_req, res, next) => {
  try {
    const result = await query(
      "select id, name, email, role, phone, is_active, created_at from users order by name"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("administrador"), async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password || "Temporal123", 10);
    const result = await query(
      `insert into users (name, email, password_hash, role, phone, is_active)
       values ($1, $2, $3, $4, $5, $6)`,
      [data.name, data.email, passwordHash, data.role, data.phone || null, data.is_active ?? true]
    );
    const created = await query(
      "select id, name, email, role, phone, is_active, created_at from users where id = $1",
      [result.rows.insertId]
    );
    res.status(201).json(created.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("administrador"), async (req, res, next) => {
  try {
    const data = userSchema.partial().parse(req.body);
    const current = await query("select * from users where id = $1", [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ message: "Usuario no encontrado" });

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 10)
      : current.rows[0].password_hash;

    const result = await query(
      `update users set name = $1, email = $2, password_hash = $3, role = $4, phone = $5, is_active = $6
       where id = $7`,
      [
        data.name ?? current.rows[0].name,
        data.email ?? current.rows[0].email,
        passwordHash,
        data.role ?? current.rows[0].role,
        data.phone ?? current.rows[0].phone,
        data.is_active ?? current.rows[0].is_active,
        req.params.id,
      ]
    );
    const updated = await query(
      "select id, name, email, role, phone, is_active, created_at from users where id = $1",
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
