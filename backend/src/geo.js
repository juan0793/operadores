const metersPerDegreeLat = 110540;

function toPoint(point, originLat) {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  return {
    x: lng * 111320 * Math.cos((originLat * Math.PI) / 180),
    y: lat * metersPerDegreeLat,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { distanceMeters: distance(point, start), segmentProgress: 0 };
  }

  const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const projected = { x: start.x + t * dx, y: start.y + t * dy };
  return { distanceMeters: distance(point, projected), segmentProgress: t };
}

export function measureRoutePosition(location, routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return null;

  const originLat = Number(location.latitude);
  const current = toPoint(location, originLat);
  const points = routePoints.map((point) => toPoint(point, originLat));
  const segmentLengths = [];
  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentLength = distance(points[index], points[index + 1]);
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }

  let best = { distanceMeters: Number.POSITIVE_INFINITY, progressMeters: 0 };
  let accumulated = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const measured = pointToSegment(current, points[index], points[index + 1]);
    const progressMeters = accumulated + measured.segmentProgress * segmentLengths[index];
    if (measured.distanceMeters < best.distanceMeters) {
      best = { distanceMeters: measured.distanceMeters, progressMeters };
    }
    accumulated += segmentLengths[index];
  }

  return {
    distanceMeters: Math.round(best.distanceMeters),
    progressPercent: totalLength > 0 ? Math.min(100, Math.max(0, Math.round((best.progressMeters / totalLength) * 100))) : 0,
  };
}
