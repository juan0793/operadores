import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Sesión requerida" });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Sesión inválida o expirada" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "No autorizado" });
    }
    return next();
  };
}

export function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.user = { id: null, role: "publico", name: "Pantalla Pública" };
    return next();
  }

  try {
    socket.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return next(new Error("Sesión inválida"));
  }
}
