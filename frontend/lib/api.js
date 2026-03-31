const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function requestUrl(path) {
  if (API_URL) return `${API_URL}${path}`;

  if (typeof window !== "undefined") {
    return `/api${path}`;
  }

  return `http://127.0.0.1:4000${path}`;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(requestUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.error || data.message || (response.status ? `Erro HTTP ${response.status}` : null);
    throw new Error(msg || "Erro na requisicao");
  }

  return data;
}
