import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { authenticateSocket } from "./middleware/auth.js";
import { locationSchema, saveLocation } from "./routes/locations.routes.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.frontendUrl, credentials: true },
});

io.use(authenticateSocket);

io.on("connection", (socket) => {
  if (["administrador", "supervisor"].includes(socket.user.role)) socket.join("monitor");
  if (socket.user.role === "publico") socket.join("public");
  if (socket.user.role === "operador") socket.join(`operator:${socket.user.id}`);

  socket.on("operator:location", async (payload, ack) => {
    try {
      const data = locationSchema.parse(payload);
      const location = await saveLocation(socket.user, data);
      io.to("monitor").emit("location:updated", location);
      if (location.warning) io.to("monitor").emit("route:warning", location.warning);
      io.to("public").emit("public:updated");
      ack?.({ ok: true, location });
    } catch (error) {
      ack?.({ ok: false, message: error.message || "No se pudo guardar ubicacion" });
    }
  });
});

app.set("io", io);

server.listen(config.port, () => {
  console.log(`API rutas operadores escuchando en puerto ${config.port}`);
});
