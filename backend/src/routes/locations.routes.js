import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export const locationSchema = z.object({
  assignment_id: z.number().int(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
  heading: z.number().optional().nullable(),
  battery_level: z.number().optional().nullable(),
  progress_percent: z.number().min(0).max(100).optional(),
});

export async function saveLocation(user, data) {
  const assignment = await query("select * from route_assignments where id = $1", [data.assignment_id]);
  if (!assignment.rows[0]) throw Object.assign(new Error("Asignacion no encontrada"), { statusCode: 404 });
  if (user.role === "operador" && assignment.rows[0].operator_id !== user.id) {
    throw Object.assign(new Error("No autorizado"), { statusCode: 403 });
  }

  const result = await query(
    `insert into operator_locations
     (assignment_id, operator_id, route_id, latitude, longitude, accuracy, speed, heading, battery_level)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.assignment_id,
      assignment.rows[0].operator_id,
      assignment.rows[0].route_id,
      data.latitude,
      data.longitude,
      data.accuracy ?? null,
      data.speed ?? null,
      data.heading ?? null,
      data.battery_level ?? null,
    ]
  );

  await query(
    `update route_assignments
     set status = 'in_progress',
         progress_percent = coalesce($1, progress_percent),
         started_at = coalesce(started_at, now())
     where id = $2`,
    [data.progress_percent ?? null, data.assignment_id]
  );
  await query("update field_routes set status = 'in_progress', updated_at = now() where id = $1", [assignment.rows[0].route_id]);
  return result.rows[0];
}

const router = Router();
router.use(authenticate);

router.post("/", async (req, res, next) => {
  try {
    const data = locationSchema.parse(req.body);
    const location = await saveLocation(req.user, data);
    req.app.get("io")?.to("monitor").emit("location:updated", location);
    req.app.get("io")?.to("public").emit("public:updated");
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.get("/latest", async (_req, res, next) => {
  try {
    const result = await query(
      `select distinct on (ol.assignment_id)
              ol.*, u.name as operator_name, r.name as route_name, r.color
       from operator_locations ol
       join users u on u.id = ol.operator_id
       join field_routes r on r.id = ol.route_id
       order by ol.assignment_id, ol.recorded_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
