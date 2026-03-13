const TOKEN_STORAGE_KEY = 'pedagogiskKartaAuthToken';

function parseJwtPayload(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getCurrentUsername() {
  const token = getToken();
  const payload = parseJwtPayload(token);
  return payload?.username || '';
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function login(username, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) {
    throw new Error(body.message || 'Invalid username or password.');
  }

  setToken(body.token);
  return { mustChangePassword: Boolean(body.mustChangePassword) };
}

export async function changePassword(newPassword) {
  const response = await fetch('/api/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ newPassword })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Could not change password.');
  }

  return body;
}

export function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${getToken()}`
  };
}
