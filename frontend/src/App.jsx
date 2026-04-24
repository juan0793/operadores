import { Activity, AlertTriangle, ClipboardList, LogOut, MapPin, Navigation, Play, Plus, Radio, Route, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch, getApiUrl } from "./api.js";
import { MonitorMap, RouteEditorMap } from "./components/MapViews.jsx";

const emptyRoute = {
  name: "",
  neighborhood: "",
  description: "",
  color: "#2563eb",
  status: "draft",
  is_public: true,
  points: [],
  markers: [],
};

function statusLabel(status) {
  return {
    draft: "Borrador",
    assigned: "Asignada",
    in_progress: "En recorrido",
    completed: "Completada",
    cancelled: "Cancelada",
  }[status] || status;
}

function useSession() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("rutas_user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = async (email, password) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("rutas_token", data.token);
    localStorage.setItem("rutas_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("rutas_token");
    localStorage.removeItem("rutas_user");
    setUser(null);
  };

  return { user, login, logout };
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@rutas.local");
  const [password, setPassword] = useState("Rutas123");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div>
          <span className="eyebrow">Sistema independiente</span>
          <h1>Rutas de operadores</h1>
          <p>Planificacion, asignacion, seguimiento GPS y visualizacion publica de avances.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Correo<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Entrar</button>
          <a className="public-link" href="/public">Abrir pantalla publica</a>
        </form>
      </section>
    </main>
  );
}

function Shell({ user, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Route size={28} /><span>Rutas Operadores</span></div>
        <nav>
          <a href="#rutas"><MapPin size={18} />Rutas</a>
          <a href="#monitoreo"><Radio size={18} />Monitoreo</a>
          <a href="#reportes"><ClipboardList size={18} />Reportes</a>
        </nav>
        <button className="ghost" onClick={onLogout}><LogOut size={18} />Salir</button>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user.role}</span>
            <h1>Panel de control</h1>
          </div>
          <div className="user-pill">{user.name}</div>
        </header>
        {children}
      </section>
    </div>
  );
}

function AdminDashboard({ user }) {
  const [routes, setRoutes] = useState([]);
  const [operators, setOperators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyRoute);
  const [mapMode, setMapMode] = useState("route");
  const [markerDraft, setMarkerDraft] = useState({ label: "", marker_type: "referencia" });
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");

  async function load() {
    const [routeList, userList, assignmentList, locationList, trackList, report, eventList] = await Promise.all([
      apiFetch("/api/routes"),
      apiFetch("/api/users"),
      apiFetch("/api/assignments"),
      apiFetch("/api/locations/latest"),
      apiFetch("/api/locations/tracks"),
      apiFetch("/api/reports/summary"),
      apiFetch("/api/reports/events"),
    ]);
    setRoutes(routeList);
    setOperators(userList.filter((item) => item.role === "operador"));
    setAssignments(assignmentList);
    setLocations(locationList);
    setTracks(trackList);
    setSummary(report);
    setWarnings(eventList.filter((event) => event.event_type === "route_deviation"));
  }

  useEffect(() => {
    load();
    const socket = io(getApiUrl(), { auth: { token: localStorage.getItem("rutas_token") } });
    socket.on("location:updated", () => load());
    socket.on("route:warning", (warning) => {
      setWarnings((current) => [{ ...warning, created_at: new Date().toISOString() }, ...current].slice(0, 10));
    });
    return () => socket.disconnect();
  }, []);

  const detailedRoutes = useMemo(() => routes.map((route) => ({ ...route, points: route.points || [] })), [routes]);

  async function saveRoute(event) {
    event.preventDefault();
    await apiFetch("/api/routes", { method: "POST", body: JSON.stringify(form) });
    setForm(emptyRoute);
    await load();
  }

  async function assignRoute(event) {
    event.preventDefault();
    await apiFetch("/api/assignments", {
      method: "POST",
      body: JSON.stringify({ route_id: Number(selectedRoute), operator_id: Number(selectedOperator) }),
    });
    setSelectedRoute("");
    setSelectedOperator("");
    await load();
  }

  async function openRoute(route) {
    const detail = await apiFetch(`/api/routes/${route.id}`);
    setRoutes((current) => current.map((item) => (item.id === route.id ? detail : item)));
  }

  async function simulateRoute(assignment) {
    const route = await apiFetch(`/api/routes/${assignment.route_id}`);
    const points = route.points || [];
    if (points.length < 2) return;

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      for (let step = 0; step <= 8; step += 1) {
        const t = step / 8;
        await apiFetch("/api/locations", {
          method: "POST",
          body: JSON.stringify({
            assignment_id: Number(assignment.id),
            latitude: Number(start.latitude) + (Number(end.latitude) - Number(start.latitude)) * t,
            longitude: Number(start.longitude) + (Number(end.longitude) - Number(start.longitude)) * t,
            accuracy: 8,
          }),
        });
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
    }
    await load();
  }

  return (
    <div className="grid-layout">
      <section id="rutas" className="panel wide">
        <div className="panel-title"><MapPin /><h2>Crear ruta</h2></div>
        <form className="route-form" onSubmit={saveRoute}>
          <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Barrio o colonia<input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Ej. Barrio El Centro" /></label>
          <label>Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
          <label className="span-2">Descripcion<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />Visible al publico</label>
          <div className="marker-tools span-2">
            <div className="segmented">
              <button type="button" className={mapMode === "route" ? "active" : ""} onClick={() => setMapMode("route")}>Trazar ruta</button>
              <button type="button" className={mapMode === "marker" ? "active" : ""} onClick={() => setMapMode("marker")}>Agregar marcador</button>
            </div>
            <input value={markerDraft.label} onChange={(e) => setMarkerDraft({ ...markerDraft, label: e.target.value })} placeholder="Nombre del marcador" />
            <select value={markerDraft.marker_type} onChange={(e) => setMarkerDraft({ ...markerDraft, marker_type: e.target.value })}>
              <option value="referencia">Referencia</option>
              <option value="inicio">Inicio</option>
              <option value="fin">Fin</option>
              <option value="parada">Parada</option>
              <option value="punto_critico">Punto critico</option>
            </select>
          </div>
          <div className="span-2 editor-map">
            <RouteEditorMap
              points={form.points}
              markers={form.markers}
              color={form.color}
              mode={mapMode}
              onAddPoint={(point) => setForm({ ...form, points: [...form.points, point] })}
              onRemovePoint={(index) => setForm({ ...form, points: form.points.filter((_, i) => i !== index) })}
              onAddMarker={(point) => {
                const label = markerDraft.label.trim() || `Marcador ${form.markers.length + 1}`;
                setForm({ ...form, markers: [...form.markers, { ...point, label, marker_type: markerDraft.marker_type }] });
                setMarkerDraft({ ...markerDraft, label: "" });
              }}
              onRemoveMarker={(index) => setForm({ ...form, markers: form.markers.filter((_, i) => i !== index) })}
            />
          </div>
          <button className="primary" disabled={form.points.length < 2}><Plus size={18} />Guardar ruta</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title"><Users /><h2>Asignar operador</h2></div>
        <form className="stack" onSubmit={assignRoute}>
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} required>
            <option value="">Seleccionar ruta</option>
            {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
          </select>
          <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} required>
            <option value="">Seleccionar operador</option>
            {operators.map((op) => <option key={op.id} value={op.id}>{op.name}</option>)}
          </select>
          <button className="primary">Asignar</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title"><Activity /><h2>Resumen</h2></div>
        {summary && (
          <div className="stats">
            <span><strong>{summary.assigned}</strong> asignadas</span>
            <span><strong>{summary.in_progress}</strong> activas</span>
            <span><strong>{summary.completed}</strong> completadas</span>
            <span><strong>{summary.average_progress}%</strong> avance</span>
          </div>
        )}
      </section>

      <section id="monitoreo" className="panel wide">
        <div className="panel-title"><Radio /><h2>Monitoreo en tiempo real</h2></div>
        <MonitorMap routes={detailedRoutes} locations={locations} tracks={tracks} />
      </section>

      <section className="panel wide">
        <div className="panel-title warning-title"><AlertTriangle /><h2>Alertas de desvio</h2></div>
        {warnings.length === 0 ? (
          <p className="muted">Sin alertas de desvio registradas.</p>
        ) : (
          <div className="warning-list">
            {warnings.slice(0, 8).map((warning, index) => (
              <article className="warning-card" key={`${warning.id || warning.assignment_id}-${warning.created_at || index}`}>
                <strong>{warning.route_name || `Ruta #${warning.route_id}`}</strong>
                <span>{warning.operator_name || `Operador #${warning.operator_id}`}</span>
                <p>{warning.notes || warning.message || "Operador fuera de la ruta marcada."}</p>
                <small>{warning.created_at ? new Date(warning.created_at).toLocaleString() : "Ahora"}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="reportes" className="panel wide">
        <div className="panel-title"><ClipboardList /><h2>Historial</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ruta</th><th>Operador</th><th>Estado</th><th>Avance</th><th>Asignada</th><th>Demo</th></tr></thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td><button className="link-button" onClick={() => openRoute({ id: item.route_id })}>{item.route_name}</button></td>
                  <td>{item.operator_name}</td>
                  <td><span className="badge">{statusLabel(item.status)}</span></td>
                  <td>{Number(item.progress_percent)}%</td>
                  <td>{new Date(item.assigned_at).toLocaleString()}</td>
                  <td><button className="link-button" type="button" onClick={() => simulateRoute(item)}>Simular recorrido</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OperatorDashboard({ user }) {
  const [assignments, setAssignments] = useState([]);
  const [active, setActive] = useState(null);
  const [watching, setWatching] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const list = await apiFetch("/api/assignments");
    setAssignments(list);
    setActive((current) => current || list.find((item) => item.status !== "completed"));
  }

  useEffect(() => { load(); }, []);

  function startGps() {
    if (!active) return;
    if (!navigator.geolocation) {
      setMessage("Este dispositivo no soporta GPS en el navegador.");
      return;
    }
    setWatching(true);
    const socket = io(getApiUrl(), { auth: { token: localStorage.getItem("rutas_token") } });
    navigator.geolocation.watchPosition(
      (position) => {
        socket.emit("operator:location", {
          assignment_id: active.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        }, (response) => {
          if (response?.location?.progress_percent !== undefined) {
            setActive((item) => ({ ...item, progress_percent: response.location.progress_percent, status: "in_progress" }));
          }
          if (response?.location?.warning) {
            setMessage(`Atencion: estas a ${response.location.warning.distance_meters} m de la ruta marcada.`);
          }
        });
      },
      () => setMessage("No se pudo obtener la ubicacion. Revisa permisos del navegador."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  async function complete() {
    await apiFetch(`/api/assignments/${active.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", progress_percent: 100 }),
    });
    setMessage("Ruta marcada como completada.");
    await load();
  }

  return (
    <main className="operator-view">
      <header className="mobile-header">
        <div><span className="eyebrow">Operador</span><h1>{user.name}</h1></div>
        <Navigation />
      </header>
      <section className="panel">
        <h2>Ruta asignada</h2>
        <select value={active?.id || ""} onChange={(e) => setActive(assignments.find((item) => item.id === Number(e.target.value)))}>
          {assignments.map((item) => <option key={item.id} value={item.id}>{item.route_name}</option>)}
        </select>
        {active && (
          <div className="operator-card">
            <span className="badge">{statusLabel(active.status)}</span>
            <h3>{active.route_name}</h3>
            <div className="progress"><span style={{ width: `${Number(active.progress_percent)}%` }} /></div>
            <p>{Number(active.progress_percent)}% reportado</p>
            <button className="primary big" onClick={startGps} disabled={watching}><Play />{watching ? "GPS activo" : "Iniciar seguimiento"}</button>
            <button className="ghost big" onClick={complete}>Finalizar ruta</button>
          </div>
        )}
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}

function PublicScreen() {
  const [routes, setRoutes] = useState([]);

  async function load() {
    const list = await apiFetch("/api/public/routes", { headers: {} });
    setRoutes(list);
  }

  useEffect(() => {
    load();
    const socket = io(getApiUrl());
    socket.on("public:updated", load);
    const timer = setInterval(load, 30000);
    return () => {
      socket.disconnect();
      clearInterval(timer);
    };
  }, []);

  const locations = routes.filter((route) => route.latitude && route.longitude);
  const focusRoutes = routes.slice(0, 5);

  return (
    <main className="public-screen">
      <header className="public-header">
        <div>
          <span className="eyebrow">Seguimiento ciudadano</span>
          <h1>Avance de rutas en tiempo real</h1>
        </div>
        <span>{new Date().toLocaleDateString()}</span>
      </header>
      <section className="public-map"><MonitorMap routes={routes} locations={locations} tracks={[]} /></section>
      <section className="public-focus">
        {focusRoutes.map((route) => {
          const routeLocation = route.latitude && route.longitude ? [route] : [];
          return (
            <article className="public-focus-panel" key={`focus-${route.id}`}>
              <div className="focus-head">
                <div>
                  <span className="eyebrow">Pantalla {focusRoutes.indexOf(route) + 1}</span>
                  <h2>{route.name}</h2>
                </div>
                <strong>{route.progress_percent}%</strong>
              </div>
              <MonitorMap routes={[route]} locations={routeLocation} tracks={[]} compact />
            </article>
          );
        })}
      </section>
      <section className="public-list">
        {routes.map((route) => (
          <article key={route.id} className="route-card">
            <span className="badge">{statusLabel(route.status)}</span>
            <h2>{route.name}</h2>
            {route.neighborhood && <small>{route.neighborhood}</small>}
            <p>{route.description}</p>
            <div className="progress"><span style={{ width: `${route.progress_percent}%`, background: route.color }} /></div>
            <strong>{route.progress_percent}% de avance</strong>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const { user, login, logout } = useSession();
  const isPublic = window.location.pathname.startsWith("/public");

  if (isPublic) return <PublicScreen />;
  if (!user) return <Login onLogin={login} />;
  if (user.role === "operador") return <OperatorDashboard user={user} />;
  if (user.role === "publico") return <PublicScreen />;

  return (
    <Shell user={user} onLogout={logout}>
      <AdminDashboard user={user} />
    </Shell>
  );
}
