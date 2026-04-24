import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const vehicleIcon = new L.DivIcon({
  className: "vehicle-marker",
  html: '<span class="vehicle-body"><span class="vehicle-window"></span></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const hondurasCenter = [14.0818, -87.2068];
const cityTiles = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution: '&copy; OpenStreetMap &copy; CARTO',
};

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [28, 28] });
  }, [map, points]);
  return null;
}

function ClickCollector({ onAddPoint }) {
  useMapEvents({
    click(event) {
      onAddPoint?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

export function RouteEditorMap({ points, color = "#2563eb", onAddPoint, onRemovePoint }) {
  return (
    <MapContainer className="map" center={points[0] ? [points[0].latitude, points[0].longitude] : hondurasCenter} zoom={13}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.url} detectRetina maxZoom={20} />
      <ClickCollector onAddPoint={onAddPoint} />
      <FitBounds points={points} />
      {points.length > 1 && <Polyline positions={points.map((p) => [p.latitude, p.longitude])} pathOptions={{ color, weight: 5 }} />}
      {points.map((point, index) => (
        <Marker key={`${point.latitude}-${point.longitude}-${index}`} position={[point.latitude, point.longitude]} icon={markerIcon}>
          <Popup>
            Punto {index + 1}
            <button className="link-button" type="button" onClick={() => onRemovePoint?.(index)}>Quitar</button>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export function MonitorMap({ routes = [], locations = [], tracks = [], compact = false }) {
  const routePoints = routes.flatMap((route) => route.points || []);
  const trackPoints = tracks.flatMap((track) => track.points || []);
  return (
    <MapContainer className={`map ${compact ? "map-compact" : "map-large"}`} center={hondurasCenter} zoom={13}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.url} detectRetina maxZoom={20} />
      <FitBounds points={routePoints.length ? routePoints : (trackPoints.length ? trackPoints : locations)} />
      {routes.map((route) =>
        route.points?.length > 1 ? (
          <Polyline
            key={`route-${route.id}`}
            positions={route.points.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: route.color || "#2563eb", weight: 5 }}
          />
        ) : null
      )}
      {tracks.map((track) =>
        track.points?.length > 1 ? (
          <Polyline
            key={`track-${track.assignment_id}`}
            positions={track.points.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: track.color || "#f97316", weight: 4, dashArray: "8 8" }}
          />
        ) : null
      )}
      {locations.map((loc) => (
        <Marker key={`${loc.assignment_id}-${loc.recorded_at || loc.last_location_at}`} position={[Number(loc.latitude), Number(loc.longitude)]} icon={vehicleIcon}>
          <Popup>
            <strong>{loc.operator_name || "Operador"}</strong>
            <span>{loc.route_name || loc.name}</span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
