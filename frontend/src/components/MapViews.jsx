import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

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
  [13.245, -87.275],
  [13.365, -87.115],
];
const cityTiles = {
  imageryUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  labelsUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

const planningZones = [
  {
    name: "Barrio El Centro",
    color: "#0f766e",
    points: [[13.304, -87.199], [13.312, -87.192], [13.309, -87.182], [13.299, -87.186], [13.297, -87.195]],
  },
  {
    name: "Barrio El Cortijo",
    color: "#2563eb",
    points: [[13.292, -87.212], [13.303, -87.207], [13.299, -87.196], [13.287, -87.201]],
  },
  {
    name: "Barrio Las Acacias",
    color: "#0891b2",
    points: [[13.294, -87.181], [13.305, -87.176], [13.300, -87.164], [13.289, -87.170]],
  },
  {
    name: "Barrio Los Fuentes",
    color: "#7c3aed",
    points: [[13.313, -87.194], [13.323, -87.187], [13.318, -87.176], [13.309, -87.182]],
  },
  {
    name: "Barrio Guadalupe",
    color: "#ea580c",
    points: [[13.285, -87.222], [13.294, -87.214], [13.288, -87.202], [13.277, -87.211]],
  },
  {
    name: "Barrio El Aterrizaje",
    color: "#16a34a",
    points: [[13.319, -87.212], [13.331, -87.203], [13.325, -87.190], [13.313, -87.197]],
  },
];

const municipalGuides = [
  {
    name: "Linea guia Choluteca - Yusguare",
    color: "#f59e0b",
    points: [[13.35, -87.158], [13.331, -87.151], [13.312, -87.143], [13.292, -87.132], [13.273, -87.121]],
  },
  {
    name: "Salida hacia Marcovia",
    color: "#ef4444",
    points: [[13.287, -87.213], [13.274, -87.227], [13.263, -87.243], [13.252, -87.263]],
  },
];

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

function FitBounds({ points, enabled = true, fitKey = "" }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [28, 28] });
    } else {
      map.fitBounds(cholutecaBounds, { padding: [18, 18] });
    }
  }, [map, enabled, fitKey]);
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

function PlanningOverlays({ selectedNeighborhood }) {
  const normalized = (selectedNeighborhood || "").toLowerCase();
  return (
    <>
      {planningZones.map((zone) => {
        const isSelected = normalized && zone.name.toLowerCase() === normalized;
        return (
          <Polygon
            key={zone.name}
            positions={zone.points}
            pathOptions={{
              color: zone.color,
              weight: isSelected ? 4 : 2,
              opacity: isSelected ? 0.95 : 0.62,
              fillColor: zone.color,
              fillOpacity: isSelected ? 0.16 : 0.06,
              dashArray: isSelected ? undefined : "8 8",
            }}
          >
            <Tooltip sticky>{zone.name}</Tooltip>
          </Polygon>
        );
      })}
      {municipalGuides.map((guide) => (
        <Polyline
          key={guide.name}
          positions={guide.points}
          pathOptions={{ color: guide.color, weight: 4, opacity: 0.9, dashArray: "12 8" }}
        >
          <Tooltip sticky>{guide.name}</Tooltip>
        </Polyline>
      ))}
    </>
  );
}

function PlanningLegend() {
  const map = useMap();
  useEffect(() => {
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const container = L.DomUtil.create("div", "map-guide-legend");
      container.innerHTML = `
        <strong>Guias de ordenamiento</strong>
        <span><i style="background:#0f766e"></i>Barrios / colonias</span>
        <span><i style="background:#f59e0b"></i>Choluteca - Yusguare</span>
        <span><i style="background:#ef4444"></i>Salida a Marcovia</span>
      `;
      return container;
    };
    legend.addTo(map);
    return () => legend.remove();
  }, [map]);
  return null;
}

export function RouteEditorMap({ points, markers = [], color = "#2563eb", selectedNeighborhood = "", onAddPoint, onRemovePoint, onAddMarker, onRemoveMarker, mode = "route" }) {
  const editorFitKey = `${points.length}-${markers.length}-${points.at(-1)?.latitude || ""}-${points.at(-1)?.longitude || ""}`;
  return (
    <MapContainer className="map" center={points[0] ? [points[0].latitude, points[0].longitude] : cholutecaCenter} zoom={15} maxBounds={cholutecaBounds}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.imageryUrl} maxZoom={20} />
      <TileLayer url={cityTiles.labelsUrl} maxZoom={20} pane="overlayPane" />
      <MapResizeFix />
      <ClickCollector onAddPoint={(point) => (mode === "marker" ? onAddMarker?.(point) : onAddPoint?.(point))} />
      <FitBounds points={points.length ? points : markers} fitKey={editorFitKey} />
      <PlanningOverlays selectedNeighborhood={selectedNeighborhood} />
      <PlanningLegend />
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

export function MonitorMap({ routes = [], locations = [], tracks = [], compact = false, fitKey = "" }) {
  const routePoints = routes.flatMap((route) => route.points || []);
  const trackPoints = tracks.flatMap((track) => track.points || []);
  const defaultFitKey = fitKey || [
    routes.map((route) => route.assignment_id || route.id).join("-"),
    locations.length,
    tracks.map((track) => `${track.assignment_id}:${track.points?.length || 0}`).join("-"),
  ].join("|");
  return (
    <MapContainer className={`map ${compact ? "map-compact" : "map-large"}`} center={cholutecaCenter} zoom={14} maxBounds={cholutecaBounds}>
      <TileLayer attribution={cityTiles.attribution} url={cityTiles.imageryUrl} maxZoom={20} />
      <TileLayer url={cityTiles.labelsUrl} maxZoom={20} pane="overlayPane" />
      <MapResizeFix />
      <FitBounds points={routePoints.length ? routePoints : (trackPoints.length ? trackPoints : locations)} fitKey={defaultFitKey} />
      {routes.map((route) =>
        route.points?.length > 1 ? (
          <Polyline
            key={`route-${route.assignment_id || route.id}-${route.service_day || "all"}`}
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
