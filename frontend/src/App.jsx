import { Activity, AlertTriangle, ClipboardList, History, KeyRound, LogOut, MapPin, Navigation, Play, Plus, Radio, Route, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
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

const weekDays = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miercoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sabado" },
  { value: "domingo", label: "Domingo" },
];

const baseNeighborhoods = [
  "Barrio El Centro",
  "Barrio El Cortijo",
  "Barrio Las Acacias",
  "Barrio Los Fuentes",
  "Barrio Guadalupe",
  "Barrio El Aterrizaje",
  "Barrio La Libertad",
  "Barrio San Francisco",
  "Colonia San Jose",
  "Colonia 21 de Octubre",
];

function dayLabel(day) {
  return weekDays.find((item) => item.value === day)?.label || day || "Sin dia";
}

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
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState(emptyRoute);
  const [operatorForm, setOperatorForm] = useState({ name: "", email: "", phone: "", password: "Rutas123" });
  const [actionMessage, setActionMessage] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [mapMode, setMapMode] = useState("route");
  const [markerDraft, setMarkerDraft] = useState({ label: "", marker_type: "referencia" });
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedVehicleName, setSelectedVehicleName] = useState("Aguas de Choluteca");
  const [selectedDay, setSelectedDay] = useState("lunes");
  const [neighborhoodMode, setNeighborhoodMode] = useState("select");

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
  const neighborhoodOptions = useMemo(() => {
    const registered = routes.map((route) => route.neighborhood).filter(Boolean);
    return [...new Set([...baseNeighborhoods, ...registered])].sort((a, b) => a.localeCompare(b));
  }, [routes]);
  const selectedNeighborhoodOption = neighborhoodMode === "manual" ? "__manual__" : form.neighborhood || "";
  const assignmentsByDay = useMemo(() => {
    return weekDays.map((day) => ({
      ...day,
      assignments: assignments.filter((assignment) => assignment.service_day === day.value),
    }));
  }, [assignments]);

  async function saveRoute(event) {
    event.preventDefault();
    setBusyAction("saveRoute");
    setActionMessage(null);
    try {
      await apiFetch("/api/routes", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyRoute);
      setNeighborhoodMode("select");
      setActionMessage({ type: "success", text: "Ruta guardada correctamente." });
      await load();
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setBusyAction("");
    }
  }

  async function assignRoute(event) {
    event.preventDefault();
    setBusyAction("assignRoute");
    setActionMessage(null);
    try {
      await apiFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          route_id: Number(selectedRoute),
          operator_id: Number(selectedOperator),
          vehicle_name: selectedVehicleName,
          service_day: selectedDay,
        }),
      });
      setSelectedRoute("");
      setSelectedOperator("");
      setSelectedVehicleName("Aguas de Choluteca");
      setSelectedDay("lunes");
      setActionMessage({ type: "success", text: "Ruta asignada correctamente." });
      await load();
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setBusyAction("");
    }
  }

  async function openRoute(route) {
    const detail = await apiFetch(`/api/routes/${route.id}`);
    setRoutes((current) => current.map((item) => (item.id === route.id ? detail : item)));
  }

  async function deleteRoute(route) {
    if (!window.confirm(`Eliminar la ruta "${route.name}" y todo su historial asociado?`)) return;
    await apiFetch(`/api/routes/${route.id}`, { method: "DELETE" });
    await load();
  }

  async function showRouteHistory(route) {
    const detail = await apiFetch(`/api/routes/${route.id}/history`);
    setHistory(detail);
  }

  async function createOperator(event) {
    event.preventDefault();
    setBusyAction("createOperator");
    setActionMessage(null);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ ...operatorForm, role: "operador", is_active: true }),
      });
      setOperatorForm({ name: "", email: "", phone: "", password: "Rutas123" });
      setActionMessage({ type: "success", text: "Operador creado correctamente." });
      await load();
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setBusyAction("");
    }
  }

  async function toggleOperator(operator) {
    setBusyAction(`operator-${operator.id}`);
    setActionMessage(null);
    try {
      await apiFetch(`/api/users/${operator.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: operator.name,
          email: operator.email,
          phone: operator.phone,
          role: "operador",
          is_active: !Boolean(operator.is_active),
        }),
      });
      setActionMessage({
        type: "success",
        text: Boolean(operator.is_active) ? "Operador desactivado correctamente." : "Operador activado correctamente.",
      });
      await load();
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setBusyAction("");
    }
  }

  async function resetOperatorPassword(operator) {
    const password = window.prompt(`Nueva contrasena temporal para ${operator.name}`, "Rutas123");
    if (!password) return;
    if (password.length < 4) {
      setActionMessage({ type: "error", text: "La contrasena temporal debe tener al menos 4 caracteres." });
      return;
    }

    setBusyAction(`operator-password-${operator.id}`);
    setActionMessage(null);
    try {
      await apiFetch(`/api/users/${operator.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: operator.name,
          email: operator.email,
          phone: operator.phone,
          role: "operador",
          is_active: Boolean(operator.is_active),
          password,
        }),
      });
      setActionMessage({ type: "success", text: `Contrasena temporal actualizada para ${operator.name}.` });
      await load();
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setBusyAction("");
    }
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
      {actionMessage && <div className={`action-message ${actionMessage.type}`}>{actionMessage.text}</div>}
      <section id="rutas" className="panel wide">
        <div className="panel-title"><MapPin /><h2>Crear ruta</h2></div>
        <form className="route-form" onSubmit={saveRoute}>
          <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>
            Barrio o colonia
            <select
              value={selectedNeighborhoodOption}
              onChange={(e) => {
                if (e.target.value === "__manual__") {
                  setNeighborhoodMode("manual");
                  setForm({ ...form, neighborhood: "" });
                  return;
                }
                setNeighborhoodMode("select");
                setForm({ ...form, neighborhood: e.target.value });
              }}
            >
              <option value="">Seleccionar barrio</option>
              {neighborhoodOptions.map((neighborhood) => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}
              <option value="__manual__">Agregar manualmente</option>
            </select>
          </label>
          <label>Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
          {selectedNeighborhoodOption === "__manual__" && (
            <label className="span-2">Nuevo barrio o colonia<input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Ej. Colonia nueva" /></label>
          )}
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
              selectedNeighborhood={form.neighborhood}
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
          <button className="primary" disabled={form.points.length < 2 || busyAction === "saveRoute"}><Plus size={18} />{busyAction === "saveRoute" ? "Guardando..." : "Guardar ruta"}</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title"><Users /><h2>Asignar operador</h2></div>
        <form className="stack" onSubmit={assignRoute}>
          <span className="form-hint">Selecciona la ruta, el operador, el nombre visible del vehículo y el día de trabajo.</span>
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} required>
            <option value="">Seleccionar ruta</option>
            {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
          </select>
          <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} required>
            <option value="">Seleccionar operador</option>
            {operators.map((op) => <option key={op.id} value={op.id}>{op.name}</option>)}
          </select>
          <input value={selectedVehicleName} onChange={(e) => setSelectedVehicleName(e.target.value)} placeholder="Nombre del vehiculo" required />
          <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} required>
            {weekDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
          <button className="primary" disabled={busyAction === "assignRoute"}>{busyAction === "assignRoute" ? "Asignando..." : "Asignar"}</button>
        </form>
      </section>

      {user.role === "administrador" && (
        <section className="panel">
          <div className="panel-title"><UserPlus /><h2>Registrar operador</h2></div>
          <form className="stack" onSubmit={createOperator}>
            <label>Nombre<input value={operatorForm.name} onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })} placeholder="Nombre del operador" required /></label>
            <label>Correo<input type="email" value={operatorForm.email} onChange={(e) => setOperatorForm({ ...operatorForm, email: e.target.value })} placeholder="correo@ejemplo.com" required /></label>
            <label>Telefono<input value={operatorForm.phone} onChange={(e) => setOperatorForm({ ...operatorForm, phone: e.target.value })} placeholder="Telefono" /></label>
            <label>Contrasena temporal<input value={operatorForm.password} minLength={4} onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })} placeholder="Minimo 4 caracteres" required /></label>
            <button className="primary" disabled={busyAction === "createOperator"}>{busyAction === "createOperator" ? "Creando..." : "Crear operador"}</button>
          </form>
        </section>
      )}

      {user.role === "administrador" && (
        <section className="panel wide">
          <div className="panel-title"><UserCheck /><h2>Operadores registrados</h2></div>
          {operators.length === 0 ? (
            <p className="muted">Todavia no hay operadores registrados.</p>
          ) : (
            <div className="operator-management-grid">
              {operators.map((operator) => (
                <article className="operator-management-card" key={operator.id}>
                  <div>
                    <span className={`status-pill ${operator.is_active ? "active" : "inactive"}`}>
                      {operator.is_active ? "Activo" : "Inactivo"}
                    </span>
                    <h3>{operator.name}</h3>
                    <p>{operator.email}</p>
                    <small>{operator.phone || "Sin telefono"} - Alta {new Date(operator.created_at).toLocaleDateString()}</small>
                  </div>
                  <div className="operator-actions">
                    <button
                      className="ghost"
                      type="button"
                      disabled={busyAction === `operator-${operator.id}`}
                      onClick={() => toggleOperator(operator)}
                    >
                      {operator.is_active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      className="link-button"
                      type="button"
                      disabled={busyAction === `operator-password-${operator.id}`}
                      onClick={() => resetOperatorPassword(operator)}
                    >
                      <KeyRound size={16} />Restablecer clave
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

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

      <section className="panel wide">
        <div className="panel-title"><ClipboardList /><h2>Programacion semanal</h2></div>
        <div className="week-grid">
          {assignmentsByDay.map((day) => (
            <article className="day-column" key={day.value}>
              <h3>{day.label}</h3>
              {day.assignments.length === 0 ? (
                <p className="muted">Sin operadores</p>
              ) : day.assignments.map((assignment) => (
                <span className="day-assignment" key={assignment.id}>
                  <strong>{assignment.operator_name}</strong>
                  <small>{assignment.vehicle_name || "Aguas de Choluteca"}</small>
                  <small>{assignment.route_name}</small>
                </span>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section id="monitoreo" className="panel wide">
        <div className="panel-title"><Radio /><h2>Monitoreo en tiempo real</h2></div>
        <div className="map-dashboard">
          <span><strong>{locations.length}</strong> vehiculos activos</span>
          <span><strong>{routes.length}</strong> rutas</span>
          <span><strong>{warnings.length}</strong> alertas</span>
          <span><strong>{tracks.reduce((total, track) => total + (track.points?.length || 0), 0)}</strong> puntos GPS</span>
        </div>
        <MonitorMap routes={detailedRoutes} locations={locations} tracks={tracks} />
      </section>

      <section className="panel wide">
        <div className="panel-title"><Navigation /><h2>Vehiculos asignados</h2></div>
        <div className="vehicle-grid">
          {assignments.map((assignment) => {
            const latest = locations.find((location) => Number(location.assignment_id) === Number(assignment.id));
            return (
              <article className="vehicle-card" key={`vehicle-${assignment.id}`}>
                <div>
                  <span className="badge">{dayLabel(assignment.service_day)}</span>
                  <h3>{assignment.vehicle_name || "Aguas de Choluteca"}</h3>
                  <p>{assignment.operator_name}</p>
                  <p>{assignment.route_name}</p>
                </div>
                <strong>{Number(assignment.progress_percent)}%</strong>
                <small>{latest ? `GPS ${new Date(latest.recorded_at).toLocaleTimeString()}` : "Sin GPS reciente"}</small>
              </article>
            );
          })}
        </div>
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
            <thead><tr><th>Ruta</th><th>Barrio</th><th>Vehiculo</th><th>Operador</th><th>Dia</th><th>Estado</th><th>Avance</th><th>Asignada</th><th>Acciones</th></tr></thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td><button className="link-button" onClick={() => openRoute({ id: item.route_id })}>{item.route_name}</button></td>
                  <td>{item.neighborhood || "-"}</td>
                  <td>{item.vehicle_name || "Aguas de Choluteca"}</td>
                  <td>{item.operator_name}</td>
                  <td>{dayLabel(item.service_day)}</td>
                  <td><span className="badge">{statusLabel(item.status)}</span></td>
                  <td>{Number(item.progress_percent)}%</td>
                  <td>{new Date(item.assigned_at).toLocaleString()}</td>
                  <td className="table-actions">
                    <button className="link-button" type="button" onClick={() => simulateRoute(item)}>Simular</button>
                    <button className="link-button" type="button" onClick={() => showRouteHistory({ id: item.route_id })}><History size={16} />Historial</button>
                    {user.role === "administrador" && <button className="danger-link" type="button" onClick={() => deleteRoute({ id: item.route_id, name: item.route_name })}><Trash2 size={16} />Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {history && (
        <section className="panel wide">
          <div className="panel-title"><History /><h2>Historial de {history.route.name}</h2></div>
          <div className="history-grid">
            <article><strong>{history.assignments.length}</strong><span>Asignaciones</span></article>
            <article><strong>{history.locations.length}</strong><span>Ubicaciones</span></article>
            <article><strong>{history.events.length}</strong><span>Eventos</span></article>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Operador</th><th>Evento</th><th>Detalle</th></tr></thead>
              <tbody>
                {history.events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.created_at).toLocaleString()}</td>
                    <td>{event.operator_name || "-"}</td>
                    <td>{event.event_type}</td>
                    <td>{event.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function OperatorDashboard({ user }) {
  const [assignments, setAssignments] = useState([]);
  const [active, setActive] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [watching, setWatching] = useState(false);
  const [message, setMessage] = useState("");
  const [offlineCount, setOfflineCount] = useState(() => JSON.parse(localStorage.getItem("rutas_pending_locations") || "[]").length);

  async function load() {
    const list = await apiFetch("/api/assignments");
    setAssignments(list);
    setActive((current) => current || list.find((item) => item.status !== "completed"));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active?.route_id) return;
    apiFetch(`/api/routes/${active.route_id}`).then(setActiveRoute).catch(() => {});
  }, [active?.route_id]);

  function readQueue() {
    return JSON.parse(localStorage.getItem("rutas_pending_locations") || "[]");
  }

  function writeQueue(items) {
    localStorage.setItem("rutas_pending_locations", JSON.stringify(items));
    setOfflineCount(items.length);
  }

  async function flushQueue() {
    const items = readQueue();
    if (items.length === 0 || !navigator.onLine) return;
    const pending = [];
    for (const item of items) {
      try {
        await apiFetch("/api/locations", { method: "POST", body: JSON.stringify(item) });
      } catch {
        pending.push(item);
      }
    }
    writeQueue(pending);
    if (items.length !== pending.length) setMessage("Ubicaciones pendientes sincronizadas.");
  }

  useEffect(() => {
    window.addEventListener("online", flushQueue);
    flushQueue();
    return () => window.removeEventListener("online", flushQueue);
  }, []);

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
        const payload = {
          assignment_id: active.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        };

        if (!navigator.onLine) {
          writeQueue([...readQueue(), payload]);
          setMessage("Sin internet: ubicacion guardada para sincronizar luego.");
          return;
        }

        socket.emit("operator:location", payload, (response) => {
          if (response?.location?.progress_percent !== undefined) {
            setActive((item) => ({ ...item, progress_percent: response.location.progress_percent, status: "in_progress" }));
          }
          if (response?.location?.warning) {
            setMessage(`Advertencia: estas a ${response.location.warning.distance_meters} m de la ruta establecida.`);
          } else {
            setMessage("Ubicacion transmitida correctamente.");
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
            <h3>{active.vehicle_name || "Aguas de Choluteca"}</h3>
            <p>{active.route_name}</p>
            <p>{dayLabel(active.service_day)}</p>
            <div className="progress"><span style={{ width: `${Number(active.progress_percent)}%` }} /></div>
            <p>{Number(active.progress_percent)}% reportado</p>
            <button className="primary big" onClick={startGps} disabled={watching}><Play />{watching ? "GPS activo" : "Iniciar seguimiento"}</button>
            <button className="ghost big" onClick={complete}>Finalizar ruta</button>
          </div>
        )}
        {activeRoute && (
          <div className="operator-map">
            <MonitorMap routes={[activeRoute]} locations={[]} tracks={[]} compact />
          </div>
        )}
        {offlineCount > 0 && <p className="notice">{offlineCount} ubicaciones pendientes por sincronizar.</p>}
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}

function PublicScreen() {
  const [routes, setRoutes] = useState([]);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [selectedPublicDay, setSelectedPublicDay] = useState("todos");

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

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setExpandedRoute(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const visibleRoutes = selectedPublicDay === "todos"
    ? routes
    : routes.filter((route) => route.service_day === selectedPublicDay);
  const focusRoutes = visibleRoutes.slice(0, 8);
  const visibleLocations = visibleRoutes.filter((route) => route.latitude && route.longitude);

  return (
    <main className="public-screen">
      <header className="public-header">
        <div>
          <span className="eyebrow">Seguimiento ciudadano</span>
          <h1>Avance de rutas en tiempo real</h1>
        </div>
        <span>{new Date().toLocaleDateString()}</span>
      </header>
      <section className="public-controls">
        <div className="segmented public-day-tabs">
          <button type="button" className={selectedPublicDay === "todos" ? "active" : ""} onClick={() => setSelectedPublicDay("todos")}>Todos</button>
          {weekDays.map((day) => (
            <button key={day.value} type="button" className={selectedPublicDay === day.value ? "active" : ""} onClick={() => setSelectedPublicDay(day.value)}>
              {day.label}
            </button>
          ))}
        </div>
        <span>{focusRoutes.length} de 8 pantallas activas</span>
      </section>
      <section className="public-map"><MonitorMap routes={visibleRoutes} locations={visibleLocations} tracks={[]} /></section>
      <section className="public-focus">
        {focusRoutes.map((route) => {
          const routeLocation = route.latitude && route.longitude ? [route] : [];
          return (
            <article
              className="public-focus-panel"
              key={`focus-${route.assignment_id || route.id}-${route.service_day || "all"}`}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedRoute(route)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setExpandedRoute(route);
              }}
            >
              <div className="focus-head">
                <div>
                  <span className="eyebrow">Pantalla {focusRoutes.indexOf(route) + 1}</span>
                  <h2>{route.name}</h2>
                </div>
                <strong>{route.progress_percent}%</strong>
              </div>
              <MonitorMap routes={[route]} locations={routeLocation} tracks={[]} compact />
              <span className="expand-hint">Clic para pantalla completa</span>
            </article>
          );
        })}
      </section>
      <section className="public-list">
        {visibleRoutes.map((route) => (
          <article key={`${route.assignment_id || route.id}-${route.service_day || "all"}`} className="route-card">
            <span className="badge">{statusLabel(route.status)}</span>
            <h2>{route.name}</h2>
            {route.neighborhood && <small>{route.neighborhood}</small>}
            {route.vehicle_name && <small>{route.vehicle_name}</small>}
            {route.service_day && <small>{dayLabel(route.service_day)}</small>}
            <p>{route.description}</p>
            <div className="progress"><span style={{ width: `${route.progress_percent}%`, background: route.color }} /></div>
            <strong>{route.progress_percent}% de avance</strong>
          </article>
        ))}
      </section>
      {expandedRoute && (
        <section className="fullscreen-route" role="dialog" aria-modal="true">
          <header className="fullscreen-route-header">
            <div>
              <span className="eyebrow">Pantalla completa</span>
              <h2>{expandedRoute.name}</h2>
              <p>
                {[expandedRoute.neighborhood, expandedRoute.vehicle_name, expandedRoute.service_day && dayLabel(expandedRoute.service_day)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="fullscreen-route-stats">
              <strong>{expandedRoute.progress_percent}%</strong>
              <button type="button" onClick={() => setExpandedRoute(null)}>Cerrar</button>
            </div>
          </header>
          <div className="fullscreen-route-map">
            <MonitorMap
              routes={[expandedRoute]}
              locations={expandedRoute.latitude && expandedRoute.longitude ? [expandedRoute] : []}
              tracks={[]}
            />
          </div>
        </section>
      )}
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
