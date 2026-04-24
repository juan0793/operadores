import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { normalizeRoutePayload } from "../utils.js";

const router = Router();

const pointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  sequence: z.number().int().optional(),
  instruction: z.string().optional().nullable(),
});

const routeSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["draft", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  is_public: z.boolean().optional(),
  points: z.array(pointSchema).min(2),
});

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const onlyMine = req.user.role === "operador";
    const result = await query(
      `select r.*,
              coalesce(a.progress_percent, 0) as progress_percent,
              a.operator_id,
              u.name as operator_name
       from field_routes r
       left join route_assignments a on a.route_id = r.id and a.status <> 'cancelled'
       left join users u on u.id = a.operator_id
       where ($1::boolean = false or a.operator_id = $2)
       order by r.created_at desc`,
      [onlyMine, req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const route = await query("select * from field_routes where id = $1", [req.params.id]);
    if (!route.rows[0]) return res.status(404).json({ message: "Ruta no encontrada" });

    const points = await query(
      "select id, latitude, longitude, sequence, instruction from route_points where route_id = $1 order by sequence",
      [req.params.id]
    );
    const assignment = await query(
      `select a.*, u.name as operator_name
       from route_assignments a join users u on u.id = a.operator_id
       where a.route_id = $1 and a.status <> 'cancelled'
       order by a.assigned_at desc limit 1`,
      [req.params.id]
    );
    res.json({ ...route.rows[0], points: points.rows, assignment: assignment.rows[0] || null });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("administrador", "supervisor"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = normalizeRoutePayload(routeSchema.parse(req.body));
    await client.query("begin");
    const route = await client.query(
      `insert into field_routes (name, description, color, status, starts_at, ends_at, is_public, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [data.name, data.description, data.color, data.status, data.starts_at, data.ends_at, data.is_public, req.user.id]
    );

    for (const [index, point] of data.points.entries()) {
      await client.query(
        `insert into route_points (route_id, latitude, longitude, sequence, instruction)
         values ($1, $2, $3, $4, $5)`,
        [route.rows[0].id, point.latitude, point.longitude, point.sequence ?? index + 1, point.instruction || null]
      );
    }

    await client.query("commit");
    res.status(201).json(route.rows[0]);
  } catch (error) {
    await client.query("rollback");
    next(error);
  } finally {
    client.release();
  }
});

router.put("/:id", authorize("administrador", "supervisor"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = normalizeRoutePayload(routeSchema.parse(req.body));
    await client.query("begin");
    const route = await client.query(
      `update field_routes
       set name = $1, description = $2, color = $3, status = $4, starts_at = $5, ends_at = $6, is_public = $7, updated_at = now()
       where id = $8 returning *`,
      [data.name, data.description, data.color, data.status, data.starts_at, data.ends_at, data.is_public, req.params.id]
    );
    if (!route.rows[0]) {
      await client.query("rollback");
      return res.status(404).json({ message: "Ruta no encontrada" });
    }
    await client.query("delete from route_points where route_id = $1", [req.params.id]);
    for (const [index, point] of data.points.entries()) {
      await client.query(
        `insert into route_points (route_id, latitude, longitude, sequence, instruction)
         values ($1, $2, $3, $4, $5)`,
        [req.params.id, point.latitude, point.longitude, point.sequence ?? index + 1, point.instruction || null]
      );
    }
    await client.query("commit");
    res.json(route.rows[0]);
  } catch (error) {
    await client.query("rollback");
    next(error);
  } finally {
    client.release();
  }
});

export default router;
