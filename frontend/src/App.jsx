import { Activity, AlertTriangle, ClipboardList, Download, FileSpreadsheet, FileText, History, KeyRound, LogOut, MapPin, Navigation, Play, Plus, Radio, Route, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
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
  return weekDays.find((item) => item.value === day)?.label || day || "Sin día";
}

function getTodayServiceDay() {
  const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return days[new Date().getDay()];
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

function formatReportDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function reportFileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function tableRowsToHtml(rows) {
  if (rows.length === 0) return "<tr><td>Sin datos</td></tr>";
  const columns = Object.keys(rows[0]);
  return `
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
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
          <p>Planificación, asignación, seguimiento GPS y visualización pública de avances.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>Correo<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Entrar</button>
          <a className="public-link" href="/public">Abrir pantalla pública</a>
        </form>
      </section>
    </main>
  );
}

function Shell({ user, onLogout, children }) {
  const [activeSection, setActiveSection] = useState("rutas");
  const menuItems = [
    { id: "rutas", label: "Rutas", hint: "Trazado", icon: MapPin },
    { id: "operadores", label: "Operadores", hint: "Asignación", icon: Users },
    { id: "monitoreo", label: "Monitoreo", hint: "En vivo", icon: Radio },
    { id: "reportes", label: "Reportes", hint: "Analítica", icon: ClipboardList },
  ];

  useEffect(() => {
    const sections = menuItems.map((item) => document.getElementById(item.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.1, 0.35, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Route size={28} /><span>Rutas Operadores</span><small>Choluteca</small></div>
        <nav className="dynamic-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.id} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`}>
                <Icon size={18} />
                <span>{item.label}<small>{item.hint}</small></span>
              </a>
            );
          })}
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
  const [operatorEvents, setOperatorEvents] = useState([]);
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
    setOperatorEvents(eventList.filter((event) => event.event_type === "operator_login"));
  }

  useEffect(() => {
    load();
    const socket = io(getApiUrl(), { auth: { token: localStorage.getItem("rutas_token") } });
    socket.on("location:updated", () => load());
    socket.on("route:warning", (warning) => {
      setWarnings((current) => [{ ...warning, created_at: new Date().toISOString() }, ...current].slice(0, 10));
    });
    socket.on("operator:login", (event) => {
      setOperatorEvents((current) => [event, ...current].slice(0, 12));
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
  const reportStats = useMemo(() => {
    const completed = assignments.filter((assignment) => assignment.status === "completed");
    const durations = completed
      .map((assignment) => {
        if (!assignment.started_at || !assignment.completed_at) return null;
        return (new Date(assignment.completed_at).getTime() - new Date(assignment.started_at).getTime()) / 60000;
      })
      .filter((value) => Number.isFinite(value) && value >= 0);
    const averageMinutes = durations.length ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length) : 0;
    const gpsPoints = tracks.reduce((total, track) => total + (track.points?.length || 0), 0);
    const byStatus = ["assigned", "in_progress", "completed", "cancelled"].map((status) => ({
      status,
      label: statusLabel(status),
      count: assignments.filter((assignment) => assignment.status === status).length,
    }));
    const byOperator = operators.map((operator) => {
      const ownAssignments = assignments.filter((assignment) => Number(assignment.operator_id) === Number(operator.id));
      const ownWarnings = warnings.filter((warning) => Number(warning.operator_id) === Number(operator.id));
      const progress = ownAssignments.length
        ? Math.round(ownAssignments.reduce((total, assignment) => total + Number(assignment.progress_percent || 0), 0) / ownAssignments.length)
        : 0;
      return { ...operator, assignments: ownAssignments.length, warnings: ownWarnings.length, progress };
    }).sort((a, b) => b.assignments - a.assignments || b.progress - a.progress);
    const byRoute = assignments
      .map((assignment) => ({
        id: assignment.id,
        name: assignment.route_name,
        operator: assignment.operator_name,
        day: assignment.service_day,
        progress: Number(assignment.progress_percent || 0),
        status: assignment.status,
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 8);
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: locations.filter((location) => new Date(location.recorded_at || location.last_location_at || Date.now()).getHours() === hour).length,
    }));
    return { completed: completed.length, averageMinutes, gpsPoints, byStatus, byOperator, byRoute, hourly };
  }, [assignments, locations, operators, tracks, warnings]);

  const reportExport = useMemo(() => {
    const generatedAt = formatReportDate(new Date());
    const summaryRows = [
      { Indicador: "Rutas completadas", Valor: reportStats.completed, Detalle: `${assignments.length} asignaciones totales` },
      { Indicador: "Tiempo promedio", Valor: `${reportStats.averageMinutes} min`, Detalle: "Inicio a finalizacion" },
      { Indicador: "Puntos GPS", Valor: reportStats.gpsPoints, Detalle: "Ultimas 12 horas" },
      { Indicador: "Alertas", Valor: warnings.length, Detalle: "Desvios recientes" },
    ];
    const assignmentRows = assignments.map((item) => ({
      Ruta: item.route_name || "-",
      Barrio: item.neighborhood || "-",
      Vehiculo: item.vehicle_name || "Aguas de Choluteca",
      Operador: item.operator_name || "-",
      Dia: dayLabel(item.service_day),
      Estado: statusLabel(item.status),
      Avance: `${Number(item.progress_percent || 0)}%`,
      Asignada: formatReportDate(item.assigned_at),
      Inicio: formatReportDate(item.started_at),
      Finalizacion: formatReportDate(item.completed_at),
    }));
    const operatorRows = reportStats.byOperator.map((operator) => ({
      Operador: operator.name,
      Correo: operator.email || "-",
      Telefono: operator.phone || "-",
      Estado: operator.is_active ? "Activo" : "Inactivo",
      Rutas: operator.assignments,
      "Promedio avance": `${operator.progress}%`,
      Alertas: operator.warnings,
    }));
    const warningRows = warnings.map((warning) => ({
      Fecha: formatReportDate(warning.created_at),
      Ruta: warning.route_name || `Ruta #${warning.route_id}`,
      Operador: warning.operator_name || `Operador #${warning.operator_id}`,
      Detalle: warning.notes || warning.message || "Operador fuera de la ruta marcada.",
    }));
    return { generatedAt, summaryRows, assignmentRows, operatorRows, warningRows };
  }, [assignments, reportStats, warnings]);

  function exportExcelReport() {
    const sections = [
      ["Resumen", reportExport.summaryRows],
      ["Historial operativo", reportExport.assignmentRows],
      ["Operadores", reportExport.operatorRows],
      ["Alertas", reportExport.warningRows],
    ];
    const workbookHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #172033; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            h2 { margin: 22px 0 8px; font-size: 16px; color: #0f766e; }
            p { margin: 0 0 14px; color: #526173; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
            th { background: #0f766e; color: #ffffff; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Reporte de rutas y operadores</h1>
          <p>Generado: ${escapeHtml(reportExport.generatedAt)}</p>
          ${sections.map(([title, rows]) => `<h2>${escapeHtml(title)}</h2><table>${tableRowsToHtml(rows)}</table>`).join("")}
        </body>
      </html>
    `;
    downloadBlob(
      new Blob(["\ufeff", workbookHtml], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `reporte-operadores-${reportFileStamp()}.xls`
    );
  }

  async function exportPdfReport() {
    setBusyAction("exportPdf");
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const addSection = (title, rows, startY) => {
        doc.setFontSize(12);
        doc.setTextColor(15, 118, 110);
        doc.text(title, 40, startY);
        if (rows.length === 0) {
          doc.setFontSize(9);
          doc.setTextColor(82, 97, 115);
          doc.text("Sin datos", 40, startY + 18);
          return startY + 38;
        }
        autoTable(doc, {
          startY: startY + 10,
          head: [Object.keys(rows[0])],
          body: rows.map((row) => Object.values(row)),
          styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 40, right: 40 },
        });
        return doc.lastAutoTable.finalY + 28;
      };

      doc.setFontSize(18);
      doc.setTextColor(23, 32, 51);
      doc.text("Reporte de rutas y operadores", 40, 42);
      doc.setFontSize(9);
      doc.setTextColor(82, 97, 115);
      doc.text(`Generado: ${reportExport.generatedAt}`, 40, 60);

      let y = addSection("Resumen", reportExport.summaryRows, 88);
      y = addSection("Historial operativo", reportExport.assignmentRows.slice(0, 28), y);
      if (y > 470) {
        doc.addPage();
        y = 42;
      }
      y = addSection("Operadores", reportExport.operatorRows, y);
      if (reportExport.warningRows.length > 0) {
        if (y > 470) {
          doc.addPage();
          y = 42;
        }
        addSection("Alertas", reportExport.warningRows, y);
      }
      doc.save(`reporte-operadores-${reportFileStamp()}.pdf`);
    } finally {
      setBusyAction("");
    }
  }

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
    const password = window.prompt(`Nueva contraseña temporal para ${operator.name}`, "Rutas123");
    if (!password) return;
    if (password.length < 4) {
      setActionMessage({ type: "error", text: "La contraseña temporal debe tener al menos 4 caracteres." });
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
      setActionMessage({ type: "success", text: `Contraseña temporal actualizada para ${operator.name}.` });
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
          <label className="span-2">Descripción<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />Visible al público</label>
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
              <option value="punto_critico">Punto crítico</option>
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

      <section id="operadores" className="panel">
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
          <input value={selectedVehicleName} onChange={(e) => setSelectedVehicleName(e.target.value)} placeholder="Nombre del vehículo" required />
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
            <label>Teléfono<input value={operatorForm.phone} onChange={(e) => setOperatorForm({ ...operatorForm, phone: e.target.value })} placeholder="Teléfono" /></label>
            <label>Contraseña temporal<input value={operatorForm.password} minLength={4} onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })} placeholder="Mínimo 4 caracteres" required /></label>
            <button className="primary" disabled={busyAction === "createOperator"}>{busyAction === "createOperator" ? "Creando..." : "Crear operador"}</button>
          </form>
        </section>
      )}

      {user.role === "administrador" && (
        <section className="panel wide">
          <div className="panel-title"><UserCheck /><h2>Panel de operadores</h2></div>
          <div className="operator-summary">
            <span><strong>{operators.length}</strong> registrados</span>
            <span><strong>{operators.filter((operator) => operator.is_active).length}</strong> activos</span>
            <span><strong>{assignments.length}</strong> asignaciones</span>
            <span><strong>{operatorEvents.length}</strong> ingresos recientes</span>
          </div>
          {operators.length === 0 ? (
            <p className="muted">Todavía no hay operadores registrados.</p>
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
                    <small>{operator.phone || "Sin teléfono"} - Alta {new Date(operator.created_at).toLocaleDateString()}</small>
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

      <section className="panel wide">
        <div className="panel-title"><History /><h2>Ingresos de operadores</h2></div>
        {operatorEvents.length === 0 ? (
          <p className="muted">Aún no hay ingresos recientes de operadores.</p>
        ) : (
          <div className="operator-event-list">
            {operatorEvents.slice(0, 12).map((event) => (
              <article className="operator-event" key={`${event.id || event.operator_id}-${event.created_at}`}>
                <strong>{event.notes || `El operador ${event.operator_name || event.operator_id} ha ingresado al sistema`}</strong>
                <span>{event.created_at ? new Date(event.created_at).toLocaleString() : "Ahora"}</span>
              </article>
            ))}
          </div>
        )}
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

      <section className="panel wide">
        <div className="panel-title"><ClipboardList /><h2>Programación semanal</h2></div>
        <div className="week-grid">
          {assignmentsByDay.map((day) => (
            <article className="day-column" key={day.value}>
              <h3>{day.label}</h3>
              {day.assignments.length === 0 ? (
                <p className="muted">Sin operadores</p>
              ) : day.assignments.map((assignment) => (
                <span className="day-assignment" key={assignment.id}>
                  <i className={`week-live-dot ${assignment.status === "completed" ? "done" : ""}`} aria-hidden="true" />
                  <strong>{assignment.operator_name}</strong>
                  <small>{assignment.vehicle_name || "Aguas de Choluteca"}</small>
                  <small>{assignment.route_name}</small>
                  <em>{statusLabel(assignment.status)}</em>
                </span>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section id="monitoreo" className="panel wide">
        <div className="panel-title"><Radio /><h2>Monitoreo en tiempo real</h2></div>
        <div className="map-dashboard">
          <span><strong>{locations.length}</strong> vehículos activos</span>
          <span><strong>{routes.length}</strong> rutas</span>
          <span><strong>{warnings.length}</strong> alertas</span>
          <span><strong>{tracks.reduce((total, track) => total + (track.points?.length || 0), 0)}</strong> puntos GPS</span>
        </div>
        <MonitorMap routes={detailedRoutes} locations={locations} tracks={tracks} />
      </section>

      <section className="panel wide">
        <div className="panel-title"><Navigation /><h2>Vehículos asignados</h2></div>
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
        <div className="panel-title warning-title"><AlertTriangle /><h2>Alertas de desvío</h2></div>
        {warnings.length === 0 ? (
          <p className="muted">Sin alertas de desvío registradas.</p>
        ) : (
          <div className="warning-list">
            {warnings.slice(0, 8).map((warning, index) => (
              <article className="warning-card" key={`${warning.id || warning.assignment_id}-${warning.created_at || index}`}>
                <div className="warning-icon"><AlertTriangle size={20} /></div>
                <div>
                  <span className="warning-kicker">Desvío detectado</span>
                  <strong>{warning.route_name || `Ruta #${warning.route_id}`}</strong>
                  <p>{warning.notes || warning.message || "Operador fuera de la ruta marcada."}</p>
                  <small>{warning.operator_name || `Operador #${warning.operator_id}`} - {warning.created_at ? new Date(warning.created_at).toLocaleString() : "Ahora"}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="reportes" className="panel wide">
        <div className="panel-title report-title">
          <div><ClipboardList /><h2>Reportes estadísticos</h2></div>
          <div className="report-actions" aria-label="Descargar reportes">
            <button className="ghost icon-action" type="button" onClick={exportExcelReport}>
              <FileSpreadsheet size={18} />Excel
            </button>
            <button className="primary icon-action" type="button" onClick={exportPdfReport} disabled={busyAction === "exportPdf"}>
              {busyAction === "exportPdf" ? <Download size={18} /> : <FileText size={18} />}
              {busyAction === "exportPdf" ? "Generando..." : "PDF"}
            </button>
          </div>
        </div>
        <div className="report-hero">
          <article><span>Rutas completadas</span><strong>{reportStats.completed}</strong><small>{assignments.length} asignaciones totales</small></article>
          <article><span>Tiempo promedio</span><strong>{reportStats.averageMinutes} min</strong><small>Inicio a finalización</small></article>
          <article><span>Puntos GPS</span><strong>{reportStats.gpsPoints}</strong><small>Últimas 12 horas</small></article>
          <article><span>Alertas</span><strong>{warnings.length}</strong><small>Desvíos recientes</small></article>
        </div>
        <div className="report-grid">
          <article className="report-card">
            <h3>Asignaciones por día</h3>
            <div className="bar-list">
              {assignmentsByDay.map((day) => {
                const max = Math.max(...assignmentsByDay.map((item) => item.assignments.length), 1);
                return (
                  <span key={`report-day-${day.value}`}>
                    <small>{day.label}</small>
                    <i style={{ width: `${Math.max((day.assignments.length / max) * 100, 4)}%` }} />
                    <strong>{day.assignments.length}</strong>
                  </span>
                );
              })}
            </div>
          </article>
          <article className="report-card">
            <h3>Estado operativo</h3>
            <div className="donut-list">
              {reportStats.byStatus.map((item) => (
                <span key={`status-${item.status}`}>
                  <i className={`status-dot ${item.status}`} />
                  {item.label}
                  <strong>{item.count}</strong>
                </span>
              ))}
            </div>
          </article>
          <article className="report-card">
            <h3>Operadores</h3>
            <div className="ranking-list">
              {reportStats.byOperator.slice(0, 6).map((operator) => (
                <span key={`operator-report-${operator.id}`}>
                  <strong>{operator.name}</strong>
                  <small>{operator.assignments} rutas · {operator.progress}% promedio · {operator.warnings} alertas</small>
                </span>
              ))}
            </div>
          </article>
          <article className="report-card">
            <h3>Actividad GPS por hora</h3>
            <div className="spark-bars">
              {reportStats.hourly.map((item) => {
                const max = Math.max(...reportStats.hourly.map((hour) => hour.count), 1);
                return <span key={`hour-${item.hour}`} title={`${item.hour}:00 - ${item.count} puntos`} style={{ height: `${Math.max((item.count / max) * 100, 6)}%` }} />;
              })}
            </div>
            <small className="muted">Cada barra representa una hora del día.</small>
          </article>
          <article className="report-card span-report">
            <h3>Rutas con mayor avance</h3>
            <div className="route-progress-list">
              {reportStats.byRoute.map((route) => (
                <span key={`route-report-${route.id}`}>
                  <strong>{route.name}</strong>
                  <small>{route.operator} · {dayLabel(route.day)} · {statusLabel(route.status)}</small>
                  <i><b style={{ width: `${route.progress}%` }} /></i>
                  <em>{route.progress}%</em>
                </span>
              ))}
            </div>
          </article>
        </div>
        <div className="panel-title subpanel-title"><History /><h2>Historial operativo</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ruta</th><th>Barrio</th><th>Vehículo</th><th>Operador</th><th>Día</th><th>Estado</th><th>Avance</th><th>Asignada</th><th>Acciones</th></tr></thead>
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
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [active, setActive] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [operatorTrack, setOperatorTrack] = useState(null);
  const [watching, setWatching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [operatorNotice, setOperatorNotice] = useState(null);
  const [offlineCount, setOfflineCount] = useState(() => JSON.parse(localStorage.getItem("rutas_pending_locations") || "[]").length);
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);

  async function load() {
    const list = await apiFetch("/api/assignments");
    setAssignments(list);
    setActive((current) => {
      if (list.length === 0) return null;
      if (current && list.some((item) => Number(item.id) === Number(current.id))) return current;
      return list.find((item) => item.status !== "completed") || list[0];
    });
    setAssignmentsLoaded(true);
  }

  useEffect(() => { load(); }, []);

  function connectOperatorSocket() {
    if (socketRef.current && !socketRef.current.disconnected) return socketRef.current;
    const socket = io(getApiUrl(), { auth: { token: localStorage.getItem("rutas_token") } });
    socket.on("operator:warning", (warning) => {
      setOperatorNotice({
        type: "warning",
        title: "Desvío de ruta",
        text: `Estás a ${warning.distance_meters} m de la ruta establecida. Revisa el mapa y vuelve al tramo marcado.`,
      });
    });
    socketRef.current = socket;
    return socket;
  }

  useEffect(() => {
    connectOperatorSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!active?.route_id) return;
    apiFetch(`/api/routes/${active.route_id}`).then(setActiveRoute).catch(() => {});
    setCurrentLocation(null);
    setOperatorTrack(null);
  }, [active?.route_id]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      socketRef.current?.disconnect();
    };
  }, []);

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
    if (items.length !== pending.length) setOperatorNotice({ type: "success", title: "Sincronizado", text: "Ubicaciones pendientes sincronizadas." });
  }

  useEffect(() => {
    window.addEventListener("online", flushQueue);
    flushQueue();
    return () => window.removeEventListener("online", flushQueue);
  }, []);

  function startGps() {
    if (!active) return;
    if (watching) return;
    if (!navigator.geolocation) {
      setOperatorNotice({ type: "error", title: "GPS no disponible", text: "Este dispositivo no soporta GPS en el navegador." });
      return;
    }
    setWatching(true);
    setOperatorNotice({ type: "info", title: "GPS activo", text: "Transmitiendo ubicación en tiempo real." });
    connectOperatorSocket();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          assignment_id: active.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        };
        const visualLocation = {
          ...payload,
          vehicle_name: active.vehicle_name || "Aguas de Choluteca",
          operator_name: user.name,
          route_name: active.route_name,
          recorded_at: new Date().toISOString(),
        };
        setCurrentLocation(visualLocation);
        setOperatorTrack((current) => {
          const base = current || {
            assignment_id: active.id,
            route_id: active.route_id,
            operator_id: user.id,
            vehicle_name: active.vehicle_name || "Aguas de Choluteca",
            operator_name: user.name,
            route_name: active.route_name,
            color: active.color || "#0f766e",
            points: [],
          };
          return { ...base, points: [...base.points, visualLocation].slice(-80) };
        });

        if (!navigator.onLine) {
          writeQueue([...readQueue(), payload]);
          setOperatorNotice({ type: "warning", title: "Sin internet", text: "Ubicación guardada para sincronizar luego." });
          return;
        }

        socketRef.current?.emit("operator:location", payload, (response) => {
          if (!response?.ok) {
            setOperatorNotice({ type: "error", title: "No se transmitió", text: response?.message || "No se pudo transmitir la ubicación." });
            return;
          }
          if (response?.location?.progress_percent !== undefined) {
            setActive((item) => ({ ...item, progress_percent: response.location.progress_percent, status: "in_progress" }));
          }
          if (response?.location?.warning) {
            setOperatorNotice({ type: "warning", title: "Fuera de ruta", text: `Estás a ${response.location.warning.distance_meters} m de la ruta establecida.` });
          } else {
            setOperatorNotice({ type: "success", title: "Ubicación enviada", text: "Movimiento actualizado en el mapa." });
          }
        });
      },
      () => {
        setWatching(false);
        setOperatorNotice({ type: "error", title: "GPS no disponible", text: "No se pudo obtener la ubicación. Revisa permisos del navegador." });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  async function complete() {
    if (!active) return;
    setCompleting(true);
    setOperatorNotice(null);
    try {
      await apiFetch(`/api/assignments/${active.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", progress_percent: 100 }),
      });
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
      setWatching(false);
      setActive((item) => ({ ...item, status: "completed", progress_percent: 100 }));
      setOperatorNotice({ type: "success", title: "Ruta finalizada", text: "La ruta se marcó como completada correctamente." });
      await load();
    } catch (error) {
      setOperatorNotice({ type: "error", title: "No se pudo finalizar", text: error.message || "No se pudo finalizar la ruta." });
    } finally {
      setCompleting(false);
    }
  }

  return (
    <main className="operator-view">
      <header className="mobile-header">
        <div><span className="eyebrow">Operador</span><h1>{user.name}</h1></div>
        <div className={watching ? "operator-status active" : "operator-status"}>
          <Navigation size={18} />
          <span>{watching ? "GPS activo" : "Listo"}</span>
        </div>
      </header>
      <section className="panel operator-panel">
        <div className="operator-panel-head">
          <div>
            <span className="eyebrow">Turno actual</span>
            <h2>Ruta asignada</h2>
          </div>
          <span className="live-pill">{offlineCount > 0 ? `${offlineCount} pendientes` : "Sin pendientes"}</span>
        </div>
        <div className="operator-quick-stats">
          <article><strong>{assignments.length}</strong><span>Rutas</span></article>
          <article><strong>{active ? Number(active.progress_percent || 0) : 0}%</strong><span>Avance</span></article>
          <article><strong>{watching ? "On" : "Off"}</strong><span>GPS</span></article>
        </div>
        <select
          className="operator-route-select"
          value={active?.id || ""}
          disabled={!assignmentsLoaded || assignments.length === 0}
          onChange={(e) => setActive(assignments.find((item) => item.id === Number(e.target.value)) || null)}
        >
          {!assignmentsLoaded && <option value="">Cargando rutas...</option>}
          {assignmentsLoaded && assignments.length === 0 && <option value="">Sin rutas asignadas</option>}
          {assignments.map((item) => <option key={item.id} value={item.id}>{item.route_name}</option>)}
        </select>
        {!assignmentsLoaded && (
          <div className="operator-empty-state loading">
            <strong>Revisando rutas asignadas...</strong>
            <span>Estamos consultando tus rutas disponibles para hoy y la semana.</span>
          </div>
        )}
        {assignmentsLoaded && assignments.length === 0 && (
          <div className="operator-empty-state">
            <strong>No tienes rutas asignadas por ahora.</strong>
            <span>Cuando el supervisor te asigne una ruta, aparecerá aquí para iniciar seguimiento GPS desde el celular.</span>
          </div>
        )}
        {active && (
          <div className="operator-card">
            <div className="operator-card-head">
              <span className="badge">{statusLabel(active.status)}</span>
              <strong>{dayLabel(active.service_day)}</strong>
            </div>
            <h3>{active.route_name}</h3>
            <p>{active.vehicle_name || "Aguas de Choluteca"}</p>
            <div className="progress"><span style={{ width: `${Number(active.progress_percent)}%` }} /></div>
            <div className="operator-progress-row">
              <span>{Number(active.progress_percent)}% reportado</span>
              <small>{active.status === "completed" ? "Finalizada" : "En servicio"}</small>
            </div>
            <div className="operator-button-row">
              <button className="primary big" onClick={startGps} disabled={watching || active.status === "completed"}><Play />{watching ? "GPS activo" : "Iniciar seguimiento"}</button>
              <button className="ghost big" onClick={complete} disabled={completing || !active || active.status === "completed"}>{completing ? "Finalizando..." : "Finalizar ruta"}</button>
            </div>
          </div>
        )}
        {activeRoute && (
          <div className="operator-map">
            <div className="operator-map-head">
              <div>
                <strong>Mapa en vivo</strong>
                <span>Usa + y - para acercar o alejar. La línea celeste muestra tu recorrido real.</span>
              </div>
              <span className={watching ? "live-pill active" : "live-pill"}>{watching ? "GPS transmitiendo" : "GPS detenido"}</span>
            </div>
            <MonitorMap
              routes={[activeRoute]}
              locations={currentLocation ? [currentLocation] : []}
              tracks={operatorTrack ? [operatorTrack] : []}
              compact
              fitKey={`operator-route-${activeRoute.id}`}
            />
          </div>
        )}
        {offlineCount > 0 && <div className="operator-notice warning"><strong>Pendiente</strong><span>{offlineCount} ubicaciones por sincronizar.</span></div>}
        {operatorNotice && (
          <div className={`operator-notice ${operatorNotice.type}`}>
            <strong>{operatorNotice.title}</strong>
            <span>{operatorNotice.text}</span>
          </div>
        )}
      </section>
    </main>
  );
}

function PublicScreen() {
  const [routes, setRoutes] = useState([]);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [selectedPublicDay, setSelectedPublicDay] = useState(getTodayServiceDay);

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
  const todayServiceDay = getTodayServiceDay();
  const selectedDayLabel = selectedPublicDay === "todos" ? "Toda la semana" : dayLabel(selectedPublicDay);
  const activeRoutes = visibleRoutes.filter((route) => ["assigned", "in_progress"].includes(route.status)).length;
  const completedRoutes = visibleRoutes.filter((route) => route.status === "completed" || Number(route.progress_percent) >= 100).length;

  return (
    <main className="public-screen">
      <header className="public-header">
        <div>
          <div className="public-brand">
            <span className="eyebrow">Seguimiento ciudadano</span>
            <span className="public-city-pill">Ciudad de Choluteca</span>
          </div>
          <h1>Avance de rutas en tiempo real de Choluteca</h1>
          <p>Tablero público de monitoreo municipal. Mostrando {selectedDayLabel.toLowerCase()} con actualización automática.</p>
        </div>
        <div className="public-date-card">
          <span>{dayLabel(todayServiceDay)}</span>
          <strong>{new Date().toLocaleDateString()}</strong>
        </div>
      </header>
      <section className="public-context-strip" aria-label="Resumen del tablero público">
        <span>Municipio de Choluteca</span>
        <span>Cobertura ciudadana en tiempo real</span>
        <span>Sin datos sensibles de operadores</span>
      </section>
      <section className="public-controls">
        <div className="segmented public-day-tabs">
          <button type="button" className={selectedPublicDay === "todos" ? "active" : ""} onClick={() => setSelectedPublicDay("todos")}>Todos</button>
          {weekDays.map((day) => (
            <button key={day.value} type="button" className={selectedPublicDay === day.value ? "active" : ""} onClick={() => setSelectedPublicDay(day.value)}>
              {day.label}{day.value === todayServiceDay ? " hoy" : ""}
            </button>
          ))}
        </div>
        <div className="public-live-stats">
          <span><strong>{focusRoutes.length}</strong> de 8 pantallas</span>
          <span><strong>{activeRoutes}</strong> activas</span>
          <span><strong>{completedRoutes}</strong> completadas</span>
        </div>
      </section>
      <section className="public-map"><MonitorMap routes={visibleRoutes} locations={visibleLocations} tracks={[]} /></section>
      {focusRoutes.length === 0 ? (
        <section className="public-empty-state">
          <span className="eyebrow">Sin rutas visibles</span>
          <h2>No hay rutas públicas programadas para {selectedDayLabel.toLowerCase()}.</h2>
          <p>Puede revisar el tablero semanal completo o seleccionar otro día.</p>
          <button type="button" onClick={() => setSelectedPublicDay("todos")}>Ver toda la semana</button>
        </section>
      ) : (
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
      )}
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
