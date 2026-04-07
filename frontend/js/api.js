const API = (() => {
  const BASE = '/api';
  let _token = localStorage.getItem('tc_token');
  let _user  = JSON.parse(localStorage.getItem('tc_user') || 'null');

  function setSession(token, user) {
    _token = token; _user = user;
    localStorage.setItem('tc_token', token);
    localStorage.setItem('tc_user', JSON.stringify(user));
  }
  function clearSession() {
    _token = null; _user = null;
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_user');
  }
  function getUser() { return _user; }
  function isAdmin() { return _user?.role === 'admin'; }
  function hasSession() { return !!_token; }

  async function req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (_token) opts.headers['Authorization'] = `Bearer ${_token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (res.status === 401) { clearSession(); window.location.reload(); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  }

  return {
    setSession, clearSession, getUser, isAdmin, hasSession,
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    delete: (p) => req('DELETE', p),
  };
})();
