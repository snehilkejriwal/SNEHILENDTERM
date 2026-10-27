import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'settlewise.token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export const api = axios.create({ baseURL: API_URL, timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) onUnauthorized();
    return Promise.reject(err);
  }
);

// A readable message for any failed request, including network failures and a sleeping server.
export function errorMessage(err) {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.';
  if (err?.request && !err.response) return 'Cannot reach the server. It may be waking up; wait a few seconds and try again.';
  return err?.message || 'Something went wrong.';
}

export const fieldErrors = (err) => err?.response?.data?.error?.details?.fields || {};

export async function downloadLetter(caseId, stage) {
  const res = await api.get(`/cases/${caseId}/letter`, { params: { stage }, responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || 'settlewise-letter.pdf';
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Errors on blob requests arrive as a Blob; read them back as JSON for the message.
export async function blobErrorMessage(err) {
  if (err?.response?.data instanceof Blob) {
    try { return JSON.parse(await err.response.data.text())?.error?.message || errorMessage(err); } catch { /* fall through */ }
  }
  return errorMessage(err);
}
