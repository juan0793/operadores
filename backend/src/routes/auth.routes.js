import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authenticate, signToken } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
    return res.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
