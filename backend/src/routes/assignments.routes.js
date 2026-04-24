import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

const assignmentSchema = z.object({
  route_id: z.number().int(),
  operator_id: z.number().int(),
  service_day: z.enum(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]),
  notes: z.string().optional().nullable(),
});

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const mine = req.user.role === "operador";
    const result = await query(
      `select a.*, r.name as route_name, r.neighborhood, r.color, u.name as operator_name
       from route_assignments a
       join field_routes r on r.id = a.route_id
       join users u on u.id = a.operator_id
       where (? = false or a.operator_id = ?)
       order by a.assigned_at desc`,
      [mine, req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("administrador", "supervisor"), async (req, res, next) => {
  try {
    const data = assignmentSchema.parse(req.body);
    const result = await query(
      `insert into route_assignments (route_id, operator_id, assigned_by, service_day, notes)
       values ($1, $2, $3, $4, $5)`,
      [data.route_id, data.operator_id, req.user.id, data.service_day, data.notes || null]
    );
    await query("update field_routes set status = 'assigned', updated_at = now() where id = $1", [data.route_id]);
    const created = await query("select * from route_assignments where id = $1", [result.rows.insertId]);
    res.status(201).json(created.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const data = z.object({
      status: z.enum(["assigned", "in_progress", "completed", "cancelled"]),
      progress_percent: z.number().min(0).max(100).optional(),
    }).parse(req.body);

    const allowed = ["administrador", "supervisor"].includes(req.user.role);
    const mine = await query("select * from route_assignments where id = $1", [req.params.id]);
    if (!mine.rows[0]) return res.status(404).json({ message: "Asignacion no encontrada" });
    if (!allowed && mine.rows[0].operator_id !== req.user.id) {
      return res.status(403).json({ message: "No autorizado" });
    }

    await query(
      `update route_assignments
       set status = ?,
           progress_percent = coalesce(?, progress_percent),
           started_at = case when ? = 'in_progress' and started_at is null then now() else started_at end,
           completed_at = case when ? = 'completed' then now() else completed_at end
       where id = ?`,
      [data.status, data.progress_percent ?? null, data.status, data.status, req.params.id]
    );
    const result = await query("select * from route_assignments where id = $1", [req.params.id]);
    await query("update field_routes set status = $1, updated_at = now() where id = $2", [data.status, result.rows[0].route_id]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
