const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

export type User = { id: number; firstName: string; lastName: string; email: string; role: string; active: boolean }
export type Category = { id: number; name: string; description: string }
export type Comment = { id: number; message: string; createdAt: string; user: User }
export type Attachment = { id: number; name: string; path: string; size: number; type: string; createdAt: string }
export type AuditLog = { id: number; action: string; details: string; createdAt: string; user: User }
export type Ticket = { id: number; number: string; title: string; description: string; status: string; priority: string; category: Category; creator: User; assignee?: User; comments?: Comment[]; attachments?: Attachment[]; auditLogs?: AuditLog[]; createdAt: string; updatedAt: string }
export type Dashboard = { openTickets: number; closedTickets: number; createdThisMonth: number; byStatus: { status: string; count: number }[]; byPriority: { priority: string; count: number }[] }
type ApiResponse<T> = { data: T }
export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
let tokenRefresher: (() => Promise<string | null>) | null = null
const requestTimeout = 15_000

function userMessage(status: number, message?: string) {
  if (status === 0) return 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.'
  if (status === 403) return 'No tienes permisos para realizar esta acción.'
  if (status === 404) return 'El recurso solicitado ya no está disponible.'
  if (status === 429) return 'Se alcanzó el límite de solicitudes. Espera un momento e inténtalo de nuevo.'
  if (status >= 500) return 'El servicio tuvo un problema. Inténtalo de nuevo en unos minutos.'
  return message || 'No fue posible completar la solicitud. Inténtalo de nuevo.'
}

async function request<T>(path: string, options: RequestInit = {}, token?: string, retried = false): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), requestTimeout)
  let response: Response
  try {
    response = await fetch(`${baseURL}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  } catch {
    throw new ApiError(0, userMessage(0))
  } finally {
    window.clearTimeout(timeout)
  }
  const body = await response.json().catch(() => ({}))
  if (response.status === 401 && token && !retried && tokenRefresher) { const renewedToken = await tokenRefresher(); if (renewedToken) return request<T>(path, options, renewedToken, true) }
  if (!response.ok) throw new ApiError(response.status, userMessage(response.status, body.error?.message))
  return body as T
}

async function upload<T>(path: string, file: File, token: string): Promise<T> { const body = new FormData(); body.append('file', file); const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), requestTimeout); let response: Response; try { response = await fetch(`${baseURL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body, signal: controller.signal }) } catch { throw new ApiError(0, userMessage(0)) } finally { window.clearTimeout(timeout) }; const payload = await response.json().catch(() => ({})); if (!response.ok) throw new ApiError(response.status, userMessage(response.status, payload.error?.message)); return payload as T }
async function download(path: string, token: string): Promise<Blob> { const response = await fetch(`${baseURL}${path}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('No fue posible descargar el archivo. Inténtalo de nuevo.'); return response.blob() }

export const api = {
  setTokenRefresher: (refresher: (() => Promise<string | null>) | null) => { tokenRefresher = refresher },
  login: (email: string, password: string) => request<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (refreshToken: string) => request<ApiResponse<{ accessToken: string; user: User }>>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  categories: () => request<ApiResponse<Category[]>>('/categories'),
  dashboard: (token: string) => request<ApiResponse<Dashboard>>('/dashboard', {}, token),
  tickets: (token: string, query = '', status = '', mine = false, page = 1, sort = 'newest') => request<ApiResponse<Ticket[]> & { meta: { total: number; page: number; pageSize: number } }>(`/tickets?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&mine=${mine}&page=${page}&pageSize=10&sort=${sort}`, {}, token),
  users: (token: string) => request<ApiResponse<User[]>>('/users', {}, token),
  createUser: (token: string, data: { firstName: string; lastName: string; email: string; password: string; role: string }) => request<ApiResponse<User>>('/users', { method: 'POST', body: JSON.stringify(data) }, token),
  updateUser: (token: string, id: number, data: Partial<Pick<User, 'firstName' | 'lastName' | 'role' | 'active'>>) => request<ApiResponse<User>>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  createCategory: (token: string, data: { name: string; description: string }) => request<ApiResponse<Category>>('/categories', { method: 'POST', body: JSON.stringify(data) }, token),
  createTicket: (token: string, data: { title: string; description: string; categoryId: number; priority: string }) => request<ApiResponse<Ticket>>('/tickets', { method: 'POST', body: JSON.stringify(data) }, token),
  ticket: (token: string, id: number) => request<ApiResponse<Ticket>>(`/tickets/${id}`, {}, token),
  updateTicket: (token: string, id: number, data: { status?: string; priority?: string; assigneeId?: number }) => request<ApiResponse<Ticket>>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  addComment: (token: string, id: number, message: string) => request<ApiResponse<Comment>>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ message }) }, token),
  uploadAttachment: (token: string, id: number, file: File) => upload<ApiResponse<Attachment>>(`/tickets/${id}/attachments`, file, token),
  downloadAttachment: (token: string, ticketID: number, attachmentID: number) => download(`/tickets/${ticketID}/attachments/${attachmentID}`, token),
  deleteAttachment: (token: string, ticketID: number, attachmentID: number) => request<void>(`/tickets/${ticketID}/attachments/${attachmentID}`, { method: 'DELETE' }, token),
}
