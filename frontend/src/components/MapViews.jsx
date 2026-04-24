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

function escapeHtml(value) {
  return String(value || "Aguas de Choluteca")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createVehicleIcon(vehicleName) {
  const label = escapeHtml(vehicleName || "Aguas de Choluteca");
  return new L.DivIcon({
    className: "vehicle-marker",
    html: `<span class="vehicle-label">${label}</span><span class="vehicle-body"><span class="vehicle-window"></span><span class="vehicle-stripe"></span></span>`,
    iconSize: [128, 58],
    iconAnchor: [64, 38],
  });
}

const routeMarkerIcon = new L.DivIcon({
  className: "route-special-marker",
  html: '<span class="route-special-dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const cholutecaCenter = [13.303, -87.1907];
const cholutecaBounds = [
  [13.255, -87.245],
  [13.355, -87.135],
];
const cityTiles = {
  imageryUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  labelsUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize();
    const timers = [80, 300, 900].map((delay) => window.setTimeout(resize, delay));
    window.addEventListener("resize", resize);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", resize);
    };
  }, [map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [28, 28] });
    } else {
      map.fitBounds(cholutecaBounds, { padding: [18, 18] });
    }
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

export function RouteEditorMap({ points, markers = [], color = "#2563eb", onAddPoint, onRemovePoint, onAddMarker, onRemoveMarker, mode = "route" }) {
  return (
    <MapContainer className="map" center={points[0] ? [points[0].latitude, points[0].longitude] : cholutecaCenter} zoom={15} maxBounds={cholutecaBounds}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.imageryUrl} maxZoom={20} />
      <TileLayer url={cityTiles.labelsUrl} maxZoom={20} pane="overlayPane" />
      <MapResizeFix />
      <ClickCollector onAddPoint={(point) => (mode === "marker" ? onAddMarker?.(point) : onAddPoint?.(point))} />
      <FitBounds points={points.length ? points : markers} />
      {points.length > 1 && <Polyline positions={points.map((p) => [p.latitude, p.longitude])} pathOptions={{ color, weight: 5 }} />}
      {points.map((point, index) => (
        <Marker key={`${point.latitude}-${point.longitude}-${index}`} position={[point.latitude, point.longitude]} icon={markerIcon}>
          <Popup>
            Punto {index + 1}
            <button className="link-button" type="button" onClick={() => onRemovePoint?.(index)}>Quitar</button>
          </Popup>
        </Marker>
      ))}
      {markers.map((marker, index) => (
        <Marker key={`marker-${marker.latitude}-${marker.longitude}-${index}`} position={[marker.latitude, marker.longitude]} icon={routeMarkerIcon}>
          <Popup>
            <strong>{marker.label}</strong>
            <span>{marker.marker_type || "referencia"}</span>
            <button className="link-button" type="button" onClick={() => onRemoveMarker?.(index)}>Quitar</button>
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
    <MapContainer className={`map ${compact ? "map-compact" : "map-large"}`} center={cholutecaCenter} zoom={14} maxBounds={cholutecaBounds}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.imageryUrl} maxZoom={20} />
      <TileLayer url={cityTiles.labelsUrl} maxZoom={20} pane="overlayPane" />
      <MapResizeFix />
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
      {routes.flatMap((route) => route.markers || []).map((marker, index) => (
        <Marker key={`route-marker-${marker.id || index}`} position={[Number(marker.latitude), Number(marker.longitude)]} icon={routeMarkerIcon}>
          <Popup>
            <strong>{marker.label}</strong>
            <span>{marker.marker_type || "referencia"}</span>
          </Popup>
        </Marker>
      ))}
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
        <Marker key={`${loc.assignment_id}-${loc.recorded_at || loc.last_location_at}`} position={[Number(loc.latitude), Number(loc.longitude)]} icon={createVehicleIcon(loc.vehicle_name)}>
          <Popup>
            <strong>{loc.vehicle_name || "Aguas de Choluteca"}</strong>
            <span>{loc.operator_name || "Operador"}</span>
            <span>{loc.route_name || loc.name}</span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
