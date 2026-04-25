import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authenticate, signToken } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await query(
      "select id, name, email, password_hash, role, is_active from users where lower(email) = lower($1)",
      [data.email]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Credenciales invalidas" });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    if (user.role === "operador") {
      const loginEvent = await query(
        `insert into route_events (operator_id, event_type, notes)
         values ($1, 'operator_login', $2)`,
        [user.id, `El operador ${user.name} ha ingresado al sistema`]
      );
      req.app.get("io")?.to("monitor").emit("operator:login", {
        id: loginEvent.rows.insertId,
        operator_id: user.id,
        operator_name: user.name,
        event_type: "operator_login",
        notes: `El operador ${user.name} ha ingresado al sistema`,
        created_at: new Date().toISOString(),
      });
    }
    return res.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
