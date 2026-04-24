import { Router } from "express";
import { query } from "../db.js";
import { publicRoute } from "../utils.js";

const router = Router();

router.get("/routes", async (_req, res, next) => {
  try {
    const result = await query(
      `select r.id, r.name, r.description, r.color, r.status,
              coalesce(a.progress_percent, 0) as progress_percent,
              a.started_at, a.completed_at,
              u.name as operator_name,
              latest.recorded_at as last_location_at,
              latest.latitude, latest.longitude,
              coalesce(
                json_agg(
                  json_build_object('latitude', rp.latitude, 'longitude', rp.longitude, 'sequence', rp.sequence)
                  order by rp.sequence
                ) filter (where rp.id is not null),
                '[]'
              ) as points
       from field_routes r
       left join route_assignments a on a.route_id = r.id and a.status <> 'cancelled'
       left join users u on u.id = a.operator_id
       left join route_points rp on rp.route_id = r.id
       left join lateral (
         select latitude, longitude, recorded_at
         from operator_locations ol
         where ol.route_id = r.id
         order by recorded_at desc
         limit 1
       ) latest on true
       where r.is_public = true
       group by r.id, a.progress_percent, a.started_at, a.completed_at, u.name,
                latest.recorded_at, latest.latitude, latest.longitude
       order by r.updated_at desc`
    );
    res.json(result.rows.map(publicRoute));
  } catch (error) {
    next(error);
  }
});

export default router;
