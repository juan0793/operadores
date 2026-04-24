import { Router } from "express";
import { query } from "../db.js";
import { publicRoute } from "../utils.js";

const router = Router();

router.get("/routes", async (_req, res, next) => {
  try {
    const result = await query(
      `select r.id, r.name, r.neighborhood, r.description, r.color, r.status,
              coalesce(a.progress_percent, 0) as progress_percent,
              a.vehicle_name, a.service_day, a.started_at, a.completed_at,
              u.name as operator_name,
              latest.recorded_at as last_location_at,
              latest.latitude, latest.longitude,
              coalesce(
                json_arrayagg(
                  case
                    when rp.id is null then null
                    else json_object('latitude', rp.latitude, 'longitude', rp.longitude, 'sequence', rp.sequence)
                  end
                ),
                json_array()
              ) as points
       from field_routes r
       left join route_assignments a on a.route_id = r.id and a.status <> 'cancelled'
       left join users u on u.id = a.operator_id
       left join route_points rp on rp.route_id = r.id
       left join (
         select ol.route_id, ol.latitude, ol.longitude, ol.recorded_at
         from operator_locations ol
         join (
           select route_id, max(id) as id
           from operator_locations
           group by route_id
         ) mx on mx.route_id = ol.route_id and mx.id = ol.id
       ) latest on latest.route_id = r.id
       where r.is_public = true
       group by r.id, a.progress_percent, a.vehicle_name, a.service_day, a.started_at, a.completed_at, u.name,
                latest.recorded_at, latest.latitude, latest.longitude
       order by r.updated_at desc`
    );
    res.json(result.rows.map(publicRoute));
  } catch (error) {
    next(error);
  }
});

export default router;
