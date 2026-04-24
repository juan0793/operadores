import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db.js";
import { measureRoutePosition } from "../geo.js";
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

  const routePoints = await query(
    "select latitude, longitude, sequence from route_points where route_id = $1 order by sequence",
    [assignment.rows[0].route_id]
  );
  const routePosition = measureRoutePosition(data, routePoints.rows);
  const progressPercent = routePosition?.progressPercent ?? data.progress_percent ?? null;
  const isDeviation = routePosition && routePosition.distanceMeters > config.deviationWarningMeters;

  const result = await query(
    `insert into operator_locations
     (assignment_id, operator_id, route_id, latitude, longitude, accuracy, speed, heading, battery_level)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
  const created = await query("select * from operator_locations where id = $1", [result.rows.insertId]);

  await query(
    `update route_assignments
     set status = 'in_progress',
         progress_percent = coalesce($1, progress_percent),
         started_at = coalesce(started_at, now())
     where id = $2`,
    [progressPercent, data.assignment_id]
  );
  await query("update field_routes set status = 'in_progress', updated_at = now() where id = $1", [assignment.rows[0].route_id]);

  let warning = null;
  if (isDeviation) {
    const recent = await query(
      `select id from route_events
       where assignment_id = $1
         and event_type = 'route_deviation'
         and created_at >= date_sub(now(), interval 5 minute)
       order by created_at desc
       limit 1`,
      [data.assignment_id]
    );

    warning = {
      type: "route_deviation",
      assignment_id: data.assignment_id,
      operator_id: assignment.rows[0].operator_id,
      route_id: assignment.rows[0].route_id,
      distance_meters: routePosition.distanceMeters,
      threshold_meters: config.deviationWarningMeters,
      latitude: data.latitude,
      longitude: data.longitude,
      progress_percent: progressPercent,
      message: `Operador fuera de ruta por ${routePosition.distanceMeters} m`,
    };

    if (!recent.rows[0]) {
      await query(
        `insert into route_events (assignment_id, route_id, operator_id, event_type, notes, latitude, longitude)
         values ($1, $2, $3, 'route_deviation', $4, $5, $6)`,
        [
          data.assignment_id,
          assignment.rows[0].route_id,
          assignment.rows[0].operator_id,
          warning.message,
          data.latitude,
          data.longitude,
        ]
      );
    }
  }

  return { ...created.rows[0], route_distance_meters: routePosition?.distanceMeters ?? null, progress_percent: progressPercent, warning };
}

const router = Router();
router.use(authenticate);

router.post("/", async (req, res, next) => {
  try {
    const data = locationSchema.parse(req.body);
    const location = await saveLocation(req.user, data);
    req.app.get("io")?.to("monitor").emit("location:updated", location);
    if (location.warning) req.app.get("io")?.to("monitor").emit("route:warning", location.warning);
    req.app.get("io")?.to("public").emit("public:updated");
    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
});

router.get("/latest", async (_req, res, next) => {
  try {
    const result = await query(
      `select ol.*, a.vehicle_name, u.name as operator_name, r.name as route_name, r.color
       from operator_locations ol
       join route_assignments a on a.id = ol.assignment_id
       join users u on u.id = ol.operator_id
       join field_routes r on r.id = ol.route_id
       join (
         select assignment_id, max(id) as id
         from operator_locations
         group by assignment_id
       ) latest on latest.assignment_id = ol.assignment_id and latest.id = ol.id
       order by ol.recorded_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/tracks", async (_req, res, next) => {
  try {
    const result = await query(
      `select ol.assignment_id, ol.route_id, ol.operator_id, ol.latitude, ol.longitude,
              ol.recorded_at, a.vehicle_name, u.name as operator_name, r.name as route_name, r.color
       from operator_locations ol
       join route_assignments a on a.id = ol.assignment_id
       join users u on u.id = ol.operator_id
       join field_routes r on r.id = ol.route_id
       where ol.recorded_at >= date_sub(now(), interval 12 hour)
       order by ol.assignment_id, ol.recorded_at`
    );

    const tracks = new Map();
    for (const row of result.rows) {
      if (!tracks.has(row.assignment_id)) {
        tracks.set(row.assignment_id, {
          assignment_id: row.assignment_id,
          route_id: row.route_id,
          operator_id: row.operator_id,
          vehicle_name: row.vehicle_name,
          operator_name: row.operator_name,
          route_name: row.route_name,
          color: row.color,
          points: [],
        });
      }
      tracks.get(row.assignment_id).points.push({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        recorded_at: row.recorded_at,
      });
    }

    res.json([...tracks.values()]);
  } catch (error) {
    next(error);
  }
});

export default router;
