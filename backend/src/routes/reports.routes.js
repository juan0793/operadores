import { Router } from "express";
import { query } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize("administrador", "supervisor"));

router.get("/summary", async (_req, res, next) => {
  try {
    const result = await query(
      `select
         coalesce(sum(case when r.status = 'draft' then 1 else 0 end), 0) as draft,
         coalesce(sum(case when r.status = 'assigned' then 1 else 0 end), 0) as assigned,
         coalesce(sum(case when r.status = 'in_progress' then 1 else 0 end), 0) as in_progress,
         coalesce(sum(case when r.status = 'completed' then 1 else 0 end), 0) as completed,
         coalesce(sum(case when r.status = 'cancelled' then 1 else 0 end), 0) as cancelled,
         coalesce(round(avg(a.progress_percent)), 0) as average_progress
       from field_routes r
       left join route_assignments a on a.route_id = r.id and a.status <> 'cancelled'`
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (_req, res, next) => {
  try {
    const result = await query(
      `select a.id, r.name as route_name, u.name as operator_name, a.status,
              a.progress_percent, a.assigned_at, a.started_at, a.completed_at
       from route_assignments a
       join field_routes r on r.id = a.route_id
       join users u on u.id = a.operator_id
       order by a.assigned_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
