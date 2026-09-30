export async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(localStorage.token && { Authorization: 'Bearer ' + localStorage.token }) },
    body: body && JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && localStorage.token) { localStorage.removeItem('token'); location.reload(); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
