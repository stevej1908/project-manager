const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Helper function to get auth token
function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('authToken');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'An error occurred');
  }

  return data;
}

// Auth API
export const authAPI = {
  getAuthUrl: () => apiRequest('/auth/google'),
  getCurrentUser: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
};

// Projects API
export const projectsAPI = {
  getAll: (archived = false) => apiRequest(`/projects?archived=${archived}`),
  getById: (id) => apiRequest(`/projects/${id}`),
  create: (data) => apiRequest('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
  share: (id, email, role) =>
    apiRequest(`/projects/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (projectId, memberId) =>
    apiRequest(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
};

// Tasks API
export const tasksAPI = {
  getAll: (projectId) => apiRequest(`/tasks?projectId=${projectId}`),
  getById: (id) => apiRequest(`/tasks/${id}`),
  create: (data) => apiRequest('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
  addComment: (id, comment) =>
    apiRequest(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  deleteAttachment: (attachmentId) =>
    apiRequest(`/tasks/attachments/${attachmentId}`, { method: 'DELETE' }),
};

// Google API
export const googleAPI = {
  getContacts: (pageSize = 50, pageToken = null) => {
    const params = new URLSearchParams({ pageSize });
    if (pageToken) params.append('pageToken', pageToken);
    return apiRequest(`/google/contacts?${params}`);
  },
  searchContacts: (query) => apiRequest(`/google/contacts/search?query=${encodeURIComponent(query)}`),
  getGmailMessages: (maxResults = 20, pageToken = null, q = null) => {
    const params = new URLSearchParams({ maxResults });
    if (pageToken) params.append('pageToken', pageToken);
    if (q) params.append('q', q);
    return apiRequest(`/google/gmail/messages?${params}`);
  },
  getGmailMessage: (messageId) => apiRequest(`/google/gmail/messages/${messageId}`),
  listDriveFiles: (pageSize = 20, pageToken = null, q = null) => {
    const params = new URLSearchParams({ pageSize });
    if (pageToken) params.append('pageToken', pageToken);
    if (q) params.append('q', q);
    return apiRequest(`/google/drive/files?${params}`);
  },
  attachDriveFile: (taskId, fileId) =>
    apiRequest('/google/drive/attach', {
      method: 'POST',
      body: JSON.stringify({ taskId, fileId }),
    }),
  attachEmailToTask: (taskId, messageIds) =>
    apiRequest('/google/gmail/attach', {
      method: 'POST',
      body: JSON.stringify({ taskId, messageIds }),
    }),
  getTaskEmails: (taskId) => apiRequest(`/google/gmail/task/${taskId}/emails`),
  deleteTaskEmail: (emailId) =>
    apiRequest(`/google/gmail/emails/${emailId}`, { method: 'DELETE' }),
};

// Users API
export const usersAPI = {
  search: (email) => apiRequest(`/users/search?email=${encodeURIComponent(email)}`),
};

// Dependencies API
export const dependenciesAPI = {
  getAll: (projectId) => apiRequest(`/dependencies?projectId=${projectId}`),
  getForTask: (taskId) => apiRequest(`/dependencies/task/${taskId}`),
  create: (data) => apiRequest('/dependencies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/dependencies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/dependencies/${id}`, { method: 'DELETE' }),
};
