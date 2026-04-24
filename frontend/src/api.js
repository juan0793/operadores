const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

export function getApiUrl() {
  return API_URL;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("rutas_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "No se pudo completar la solicitud");
  }
  return data;
}
