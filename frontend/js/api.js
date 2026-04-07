// ─── API Client ───
const API = {
  _token: null,
  _user: null,

  get token() { return this._token || localStorage.getItem('token'); },
  set token(t) { this._token = t; if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); },
  get user() {
    if (this._user) return this._user;
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
  set user(u) { this._user = u; if (u) localStorage.setItem('user', JSON.stringify(u)); else localStorage.removeItem('user'); },

  async req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  // Auth
  login: (u, p) => API.req('POST', '/api/auth/login', { username: u, password: p }),
  logout() { this.token = null; this.user = null; },

  // Users
  getUsers: () => API.req('GET', '/api/users'),
  createUser: (d) => API.req('POST', '/api/users', d),
  updateUser: (id, d) => API.req('PUT', `/api/users/${id}`, d),

  // Products
  getProducts: () => API.req('GET', '/api/products'),
  getProductByBarcode: (c) => API.req('GET', `/api/products/barcode/${c}`),
  createProduct: (d) => API.req('POST', '/api/products', d),
  updateProduct: (id, d) => API.req('PUT', `/api/products/${id}`, d),
  deleteProduct: (id) => API.req('DELETE', `/api/products/${id}`),

  // Tournaments
  getTournaments: () => API.req('GET', '/api/tournaments'),
  getTournament: (id) => API.req('GET', `/api/tournaments/${id}`),
  createTournament: (d) => API.req('POST', '/api/tournaments', d),
  updateTournament: (id, d) => API.req('PUT', `/api/tournaments/${id}`, d),

  // Purchases & Sales
  getPurchases: (pid) => API.req('GET', `/api/purchases${pid ? '?product_id=' + pid : ''}`),
  createPurchase: (d) => API.req('POST', '/api/purchases', d),
  getSales: (tid) => API.req('GET', `/api/sales${tid ? '?tournament_id=' + tid : ''}`),
  createSale: (d) => API.req('POST', '/api/sales', d),
  getDashboard: () => API.req('GET', '/api/dashboard'),

  // Compta
  getInscriptions: (tid) => API.req('GET', `/api/compta/inscriptions?tournament_id=${tid}`),
  createInscription: (d) => API.req('POST', '/api/compta/inscriptions', d),
  updateInscription: (id, d) => API.req('PUT', `/api/compta/inscriptions/${id}`, d),
  deleteInscription: (id) => API.req('DELETE', `/api/compta/inscriptions/${id}`),
  getDepenses: (tid) => API.req('GET', `/api/compta/depenses?tournament_id=${tid}`),
  createDepense: (d) => API.req('POST', '/api/compta/depenses', d),
  updateDepense: (id, d) => API.req('PUT', `/api/compta/depenses/${id}`, d),
  deleteDepense: (id) => API.req('DELETE', `/api/compta/depenses/${id}`),
  getDotations: (tid) => API.req('GET', `/api/compta/dotations?tournament_id=${tid}`),
  saveDotations: (tid, list) => API.req('POST', '/api/compta/dotations/batch', { tournament_id: tid, dotations: list }),
  getBilan: (tid) => API.req('GET', `/api/compta/bilan/${tid}`),
};
