export function normalizeRoutePayload(body) {
  return {
    name: body.name?.trim(),
    description: body.description?.trim() || null,
    color: body.color || "#2563eb",
    status: body.status || "draft",
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    is_public: Boolean(body.is_public),
    points: Array.isArray(body.points) ? body.points : [],
  };
}

export function publicRoute(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status,
    progress_percent: Number(row.progress_percent || 0),
    started_at: row.started_at,
    completed_at: row.completed_at,
    operator_name: row.operator_name || null,
    last_location_at: row.last_location_at || null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    points: (Array.isArray(row.points) ? row.points : JSON.parse(row.points || "[]"))
      .filter(Boolean)
      .map((point) => ({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          sequence: point.sequence,
        })),
  };
}
