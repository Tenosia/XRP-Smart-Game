import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('predixo_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Normalise backend errors to a thrown Error with a friendly message.
function unwrap(promise) {
  return promise.then((r) => r.data).catch((e) => {
    const msg = e?.response?.data?.error || e.message || 'Something went wrong';
    throw new Error(msg);
  });
}

export const api = {
  config: () => unwrap(client.get('/config')),
  verifyHuman: (turnstileToken) => unwrap(client.post('/human/verify', { turnstileToken })),

  // auth
  register: (body) => unwrap(client.post('/auth/register', body)),
  login: (body) => unwrap(client.post('/auth/login', body)),
  me: () => unwrap(client.get('/auth/me')),

  // wallet
  wallet: () => unwrap(client.get('/wallet')),
  transactions: () => unwrap(client.get('/wallet/transactions')),
  refreshDeposits: () => unwrap(client.post('/wallet/refresh')),
  withdraw: (body) => unwrap(client.post('/wallet/withdraw', body)),

  // ideas
  ideas: (params) =>
    unwrap(
      client.get('/ideas', {
        params: typeof params === 'string' ? { status: params } : params || {},
      })
    ),
  hotIdeas: () => unwrap(client.get('/ideas/hot')),
  rankings: () => unwrap(client.get('/rankings')),
  feedWins: () => unwrap(client.get('/feed/wins')),
  idea: (id) => unwrap(client.get(`/ideas/${id}`)),
  myIdeas: () => unwrap(client.get('/ideas/mine')),
  createIdea: (body) => unwrap(client.post('/ideas', body)),
  contribute: (id, body) => unwrap(client.post(`/ideas/${id}/contribute`, body)),
  proposeResult: (id, winningOption) =>
    unwrap(client.post(`/ideas/${id}/propose-result`, { winningOption })),

  // admin
  adminIdeas: (status) =>
    unwrap(client.get('/admin/ideas', { params: status ? { status } : {} })),
  adminStats: () => unwrap(client.get('/admin/stats')),
  adminUsers: () => unwrap(client.get('/admin/users')),
  adminLedger: (limit) => unwrap(client.get('/admin/ledger', { params: limit ? { limit } : {} })),
  approveIdea: (id) => unwrap(client.post(`/admin/ideas/${id}/approve`)),
  rejectIdea: (id, reason) => unwrap(client.post(`/admin/ideas/${id}/reject`, { reason })),
  resolveIdea: (id, winningOption) =>
    unwrap(client.post(`/admin/ideas/${id}/resolve`, { winningOption })),
  approveResult: (id) => unwrap(client.post(`/admin/ideas/${id}/approve-result`)),
  rejectResult: (id, reason) => unwrap(client.post(`/admin/ideas/${id}/reject-result`, { reason })),
  adminWithdraw: (body) => unwrap(client.post('/admin/withdraw', body)),
};
