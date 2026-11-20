import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  Menu,
  Ticket as TicketIcon,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  ApiError,
  Category,
  Dashboard,
  Ticket,
  User,
} from "./services/api";
import "./styles.css";

const nav = [
  "Resumen",
  "Tickets",
  "Mis tickets",
  "Equipo",
  "Categorias",
  "Reportes",
];
const pathByPage: Record<string, string> = {
  Resumen: "/",
  Tickets: "/tickets",
  "Mis tickets": "/mis-tickets",
  Equipo: "/equipo",
  Categorias: "/categorias",
  Reportes: "/reportes",
};
const pageByPath: Record<string, string> = {
  "/": "Resumen",
  "/tickets": "Tickets",
  "/mis-tickets": "Mis tickets",
  "/equipo": "Equipo",
  "/categorias": "Categorias",
  "/reportes": "Reportes",
};
const statuses = [
  "Todos",
  "nuevo",
  "asignado",
  "en_progreso",
  "pendiente",
  "resuelto",
  "cerrado",
];
const statusLabel = (value: string) =>
  ({
    nuevo: "Nuevo",
    asignado: "Asignado",
    en_progreso: "En progreso",
    pendiente: "Pendiente",
    resuelto: "Resuelto",
    cerrado: "Cerrado",
    cancelado: "Cancelado",
  })[value] || value;
const priorityLabel = (value: string) =>
  ({ baja: "Baja", media: "Media", alta: "Alta", critica: "Crítica" })[value] ||
  value;
const initials = (user: User) => `${user.firstName[0]}${user.lastName[0]}`;

function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    focusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, []);
  return ref;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<{
    token: string;
    refreshToken?: string;
    user: User;
  } | null>(() => {
    const saved = localStorage.getItem("servicedesk-session");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem("servicedesk-session");
      return null;
    }
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const activeNav = pageByPath[location.pathname] || "Resumen";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  async function renewSession() {
    if (!session?.refreshToken) {
      signOut();
      return null;
    }
    try {
      const result = await api.refresh(session.refreshToken);
      const next = {
        ...session,
        token: result.data.accessToken,
        user: result.data.user,
      };
      localStorage.setItem("servicedesk-session", JSON.stringify(next));
      setSession(next);
      return next;
    } catch {
      signOut();
      return null;
    }
  }
  async function loadData(
    token: string,
    ticketQuery = query,
    ticketStatus = status,
    retried = false,
  ) {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [dashboardResult, ticketResult, categoryResult] = await Promise.all(
        [
          api.dashboard(token),
          api.tickets(
            token,
            ticketQuery,
            ticketStatus === "Todos" ? "" : ticketStatus,
            activeNav === "Mis tickets",
            page,
            sort,
          ),
          api.categories(),
        ],
      );
      if (currentRequest !== requestId.current) return;
      setDashboard(dashboardResult.data);
      setTickets(ticketResult.data);
      setTotalTickets(ticketResult.meta.total);
      setCategories(categoryResult.data);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401 && !retried) {
        const next = await renewSession();
        if (next) return loadData(next.token, ticketQuery, ticketStatus, true);
        return;
      }
      if (currentRequest === requestId.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "No pudimos cargar los datos. Inténtalo de nuevo.",
        );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => void loadData(session.token, query, status),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [session, query, status, sort, page, activeNav]);
  useEffect(() => {
    api.setTokenRefresher(
      session
        ? async () => {
            const next = await renewSession();
            return next?.token ?? null;
          }
        : null,
    );
    return () => api.setTokenRefresher(null);
  }, [session]);
  useEffect(() => {
    if (session && activeNav === "Equipo")
      api
        .users(session.token)
        .then((result) => setUsers(result.data))
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
                : "No pudimos cargar el equipo. Inténtalo de nuevo.",
          ),
        );
  }, [session, activeNav]);
  useEffect(() => {
    if (
      !showForm &&
      !selectedTicket &&
      !showMobileNav &&
      !showNotifications &&
      !showProfile
    )
      return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowMobileNav(false);
      setShowForm(false);
      setSelectedTicket(null);
      setShowNotifications(false);
      setShowProfile(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showForm, selectedTicket, showMobileNav, showNotifications, showProfile]);

  function signOut() {
    localStorage.removeItem("servicedesk-session");
    setSession(null);
    setTickets([]);
    setDashboard(null);
  }
  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      await api.createTicket(session.token, {
        title: String(data.get("title")),
        description: String(data.get("description")),
        categoryId: Number(data.get("categoryId")),
        priority: String(data.get("priority")),
      });
      setShowForm(false);
      navigate("/tickets");
      await loadData(session.token);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos crear el ticket. Revisa los datos e inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  async function openTicket(id: number) {
    if (!session) return;
    setError("");
    try {
      const canManage =
        session.user.role === "administrador" ||
        session.user.role === "supervisor";
      const [ticketResult, usersResult] = await Promise.all([
        api.ticket(session.token, id),
        users.length || !canManage
          ? Promise.resolve(null)
          : api.users(session.token),
      ]);
      setSelectedTicket(ticketResult.data);
      if (usersResult) setUsers(usersResult.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos abrir el ticket. Inténtalo de nuevo.",
      );
    }
  }
  async function refreshTicket(id: number) {
    if (!session) return;
    const result = await api.ticket(session.token, id);
    setSelectedTicket(result.data);
    await loadData(session.token);
  }

  if (!session)
    return (
      <Login
        onLogin={(next) => {
          localStorage.setItem("servicedesk-session", JSON.stringify(next));
          setSession(next);
          navigate("/");
        }}
      />
    );
  const user = session.user;
  return (
    <div
      className={`app ${dark ? "dark" : ""} page-${activeNav.replace(" ", "-")}`}
    >
      <aside className={`sidebar ${showMobileNav ? "mobile-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>
            Banco <span>Centralis</span>
          </span>
        </div>
        <div className="workspace">
          <span className="workspace-icon">A</span>
          <div>
            <strong>Banco Centralis</strong>
            <small>Espacio de trabajo</small>
          </div>
          <b aria-label="Más opciones">...</b>
        </div>
        <nav>
          {nav.map((item, index) => (
            <button
              key={item}
              className={activeNav === item ? "nav-item active" : "nav-item"}
              aria-current={activeNav === item ? "page" : undefined}
              onClick={() => {
                navigate(pathByPage[item]);
                setShowMobileNav(false);
              }}
            >
              <span className="nav-symbol">
                {["#", "[]", "@", "++", "*", "="][index]}
              </span>
              {item}
              {item === "Tickets" && <em>{tickets.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user">
            <span className="avatar violet">{initials(user)}</span>
            <div>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <small>{user.role}</small>
            </div>
          </div>
        </div>
      </aside>
      {showMobileNav && (
        <button
          className="mobile-nav-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setShowMobileNav(false)}
        />
      )}
      <main>
        <header>
          <button
            className="mobile-menu"
            aria-label="Abrir navegación"
            aria-expanded={showMobileNav}
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            Banco Centralis <span>/</span> <b>{activeNav}</b>
          </div>
          <div className="top-actions">
            <button className="theme" onClick={() => setDark(!dark)}>
                {dark ? "Claro" : "Oscuro"}
            </button>
            <div className="notification-wrap">
              <button
                className="notification"
                aria-label="Ver notificaciones"
                aria-expanded={showNotifications}
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfile(false);
                }}
              >
                o<i></i>
              </button>
              {showNotifications && (
                <div className="notifications">
                  <div className="notification-title">
                    <strong>Notificaciones</strong>
                      <button aria-label="Cerrar notificaciones" onClick={() => setShowNotifications(false)}>
                      x
                    </button>
                  </div>
                  <div className="notification-item">
                    <span className="avatar small orange">!</span>
                    <div>
                      <strong>Tickets abiertos</strong>
                      <p>
                        {dashboard?.openTickets ?? 0} tickets requieren
                        seguimiento.
                      </p>
                    </div>
                  </div>
                  <div className="notification-item">
                    <span className="avatar small blue">i</span>
                    <div>
                      <strong>Servicio de soporte disponible</strong>
                      <p>La conexión con el servicio está activa.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="profile-wrap">
              <button
                className="profile-trigger"
                aria-label="Abrir menu de usuario"
                aria-expanded={showProfile}
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                }}
              >
                <span className="avatar violet">{initials(user)}</span>
              </button>
              {showProfile && (
                <div className="profile-menu">
                  <div className="profile-summary">
                    <span className="avatar violet">{initials(user)}</span>
                    <div>
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                      <small>{user.email}</small>
                      <small>{user.role}</small>
                    </div>
                  </div>
                  <button className="signout" onClick={signOut}>
                    <span>o</span>Cerrar sesion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className="content">
          <div className="page-title">
            <div>
              <p className="eyebrow">PANEL DE CONTROL</p>
              <h1>Bienvenida, {user.firstName}</h1>
              <p className="subtitle">Consulta las solicitudes y su estado actual.</p>
            </div>
            {activeNav === "Resumen" && (
              <button className="primary" onClick={() => setShowForm(true)}>
                <b>+</b> Nuevo ticket
              </button>
            )}
          </div>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button aria-label="Cerrar mensaje" onClick={() => setError("")}>x</button>
            </div>
          )}
          {["Resumen", "Tickets", "Mis tickets"].includes(activeNav) ? (
            <>
              {activeNav === "Resumen" && (
                <>
                  <section className="metrics">
                    <Metric
                      label="Tickets abiertos"
                      value={dashboard?.openTickets ?? "-"}
                      note="Requieren atención"
                      icon={<TicketIcon size={20} />}
                      color="blue"
                    />
                    <Metric
                      label="Creados este mes"
                      value={dashboard?.createdThisMonth ?? "-"}
                      note="Solicitudes nuevas"
                      icon={<TriangleAlert size={20} />}
                      color="orange"
                    />
                    <Metric
                      label="Tickets cerrados"
                      value={dashboard?.closedTickets ?? "-"}
                      note="Casos finalizados"
                      icon={<CheckCircle2 size={20} />}
                      color="green"
                    />
                    <Metric
                      label="Servicio de soporte"
                      value={loading ? "..." : "Activo"}
                      note="Conexión activa"
                      icon={<ActivityIcon size={20} />}
                      color="purple"
                    />
                  </section>
                  <section className="dashboard-grid">
                    <div className="card overview">
                      <div className="card-heading">
                        <div>
                          <h2>Vista general</h2>
                          <p>Distribución de tickets abiertos por estado</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => void loadData(session.token)}
                        >
                          Actualizar resumen
                        </button>
                      </div>
                      <div className="chart-area">
                        <div className="donut">
                          <div>
                            <strong>{dashboard?.openTickets ?? 0}</strong>
                            <span>abiertos</span>
                          </div>
                        </div>
                        <div className="legend">
                          {(dashboard?.byStatus ?? []).length ? (
                            (dashboard?.byStatus ?? [])
                              .slice(0, 4)
                              .map((item, index) => (
                              <Legend
                                key={item.status}
                                color={
                                  [
                                    "blue-dot",
                                    "orange-dot",
                                    "purple-dot",
                                    "gray-dot",
                                  ][index]
                                }
                                title={statusLabel(item.status)}
                                value={String(item.count)}
                              />
                              ))
                          ) : (
                            <span className="muted">Cargando resumen...</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="card activity">
                      <div className="card-heading">
                        <div>
                          <h2>Prioridades</h2>
                          <p>Tickets por nivel de impacto</p>
                        </div>
                      </div>
                      {(dashboard?.byPriority ?? []).length ? (
                        (dashboard?.byPriority ?? []).map((item, index) => (
                          <Activity
                            key={item.priority}
                            initials={String(item.count)}
                            text={priorityLabel(item.priority)}
                            bold=" tickets"
                            time="registrados"
                            color={["blue", "orange", "violet"][index % 3]}
                          />
                        ))
                      ) : (
                        <div className="activity-row">
                          <small>Cargando prioridades...</small>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
              <section className="card tickets-card">
                <div className="card-heading">
                  <div>
                    <h2>
                      {activeNav === "Mis tickets"
                        ? "Mis tickets"
                        : "Tickets recientes"}
                    </h2>
                    <p>
                      {activeNav === "Mis tickets"
                        ? "Solicitudes creadas por tu usuario"
                        : "Gestiona y da seguimiento a las solicitudes"}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setQuery("");
                      setStatus("Todos");
                    }}
                  >
                    Limpiar filtros
                  </button>
                </div>
                <div className="toolbar">
                  <label className="search">
                    <span>o</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por número o título"
                    />
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item === "Todos" ? item : statusLabel(item)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="filter"
                    onClick={() => void loadData(session.token)}
                  >
                    Actualizar lista
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Solicitante</th>
                        <th>Categoria</th>
                        <th>Prioridad</th>
                        <th>Estado</th>
                        <th>Actualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr
                          className="ticket-row"
                          key={ticket.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Abrir ${ticket.number}: ${ticket.title}`}
                          onClick={() => void openTicket(ticket.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void openTicket(ticket.id);
                            }
                          }}
                        >
                          <td>
                            <strong>{ticket.number}</strong>
                            <span className="ticket-title">{ticket.title}</span>
                          </td>
                          <td>
                            <span className="person">
                              <span className="avatar small">
                                {initials(ticket.creator)}
                              </span>
                              {ticket.creator.firstName}{" "}
                              {ticket.creator.lastName}
                            </span>
                          </td>
                          <td>{ticket.category.name}</td>
                          <td>
                            <Badge
                              type="priority"
                              value={ticket.priority}
                              label={priorityLabel(ticket.priority)}
                            />
                          </td>
                          <td>
                            <Badge
                              type="status"
                              value={ticket.status}
                              label={statusLabel(ticket.status)}
                            />
                          </td>
                          <td className="muted">
                            {new Intl.DateTimeFormat("es-UY", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(ticket.updatedAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loading && tickets.length === 0 && (
                    <div className="empty">
                      No encontramos tickets con los filtros aplicados. Ajusta los filtros o límpialos para ver todos los tickets.
                    </div>
                  )}
                  {loading && <div className="empty">Cargando tickets...</div>}
                </div>
                <footer className="table-footer">
                  <span>Mostrando {tickets.length} tickets</span>
                </footer>
                {["Tickets", "Mis tickets"].includes(activeNav) && (
                  <div className="ticket-pager">
                    <label>
                      Ordenar
                      <select
                        value={sort}
                        onChange={(event) => {
                          setSort(event.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="newest">Mas recientes</option>
                        <option value="oldest">Mas antiguos</option>
                        <option value="priority">Mayor prioridad</option>
                      </select>
                    </label>
                    <span>
                      Pagina {page} de {Math.max(1, Math.ceil(totalTickets / 10))}
                    </span>
                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                      Anterior
                    </button>
                    <button
                      disabled={page >= Math.ceil(totalTickets / 10)}
                      onClick={() => setPage(page + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : (
            <ModulePage
              page={activeNav}
              users={users}
              categories={categories}
              dashboard={dashboard}
              token={session.token}
              onCategoryCreated={(category) =>
                setCategories([...categories, category])
              }
              onUserCreated={(newUser) => setUsers([...users, newUser])}
            />
          )}
        </section>
      </main>
      {showForm && (
        <TicketForm
          categories={categories}
          onClose={() => setShowForm(false)}
          onSubmit={createTicket}
          submitting={submitting}
        />
      )}
      {selectedTicket && (
        <TicketDetailV2
          ticket={selectedTicket}
          user={user}
          users={users}
          categories={categories}
          token={session.token}
          onClose={() => setSelectedTicket(null)}
          onRefresh={refreshTicket}
        />
      )}
    </div>
  );
}

function ModulePage({
  page,
  users,
  categories,
  dashboard,
  token,
  onCategoryCreated,
  onUserCreated,
}: {
  page: string;
  users: User[];
  categories: Category[];
  dashboard: Dashboard | null;
  token: string;
  onCategoryCreated: (category: Category) => void;
  onUserCreated: (user: User) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.createCategory(token, {
        name: String(form.get("name")),
        description: String(form.get("description")),
      });
      onCategoryCreated(result.data);
      setShowForm(false);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No pudimos crear la categoría. Revisa los datos e inténtalo de nuevo.",
      );
    }
  }
  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.createUser(token, {
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        role: String(form.get("role")),
      });
      onUserCreated(result.data);
      setShowForm(false);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No pudimos crear el usuario. Revisa los datos e inténtalo de nuevo.",
      );
    }
  }
  if (page === "Equipo") return <TeamEditor users={users} token={token} />;
  if (page === "Equipo")
    return (
      <section className="module-page card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">DIRECTORIO</p>
            <h2>Equipo de soporte</h2>
            <p>Usuarios con acceso a la plataforma.</p>
          </div>
          <button className="primary" onClick={() => setShowForm(!showForm)}>
            <b>+</b> Usuario
          </button>
        </div>
        {message && (
          <div className="alert" role="alert">
            <span>{message}</span>
          </div>
        )}
        {showForm && (
          <form className="inline-form user-form" onSubmit={addUser}>
            <input name="firstName" placeholder="Nombre" required />
            <input name="lastName" placeholder="Apellido" required />
            <input name="email" type="email" placeholder="Correo" required />
            <input
              name="password"
              type="password"
              placeholder="Contrasena"
              minLength={8}
              required
            />
            <select name="role">
              <option value="usuario">Usuario</option>
              <option value="tecnico">Tecnico</option>
              <option value="supervisor">Supervisor</option>
              <option value="administrador">Administrador</option>
            </select>
            <button className="primary">Crear</button>
          </form>
        )}
        <div className="user-grid">
          {users.map((member) => (
            <div className="team-member" key={member.id}>
              <span className="avatar violet">{initials(member)}</span>
              <div>
                <strong>
                  {member.firstName} {member.lastName}
                </strong>
                <small>{member.email}</small>
              </div>
              <span className={`role role-${member.role}`}>{member.role}</span>
            </div>
          ))}
          {!users.length && (
            <div className="empty">
              Cargando equipo o no tienes permisos para consultarlo.
            </div>
          )}
        </div>
      </section>
    );
  if (page === "Categorias")
    return (
      <section className="module-page card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">CONFIGURACION</p>
            <h2>Categorias</h2>
            <p>Organiza las solicitudes para dirigirlas al equipo adecuado.</p>
          </div>
          <button className="primary" onClick={() => setShowForm(!showForm)}>
            <b>+</b> Categoria
          </button>
        </div>
        {message && (
          <div className="alert" role="alert">
            <span>{message}</span>
          </div>
        )}
        {showForm && (
          <form className="inline-form" onSubmit={addCategory}>
            <label>Nombre de la categoría<input name="name" placeholder="Ej.: Redes" required /></label>
            <label>Descripción (opcional)<input name="description" placeholder="Indica qué solicitudes incluye" /></label>
            <button className="primary">Crear categoría</button>
          </form>
        )}
        <div className="category-grid">
          {categories.map((category) => (
            <div className="category-item" key={category.id}>
              <strong>{category.name}</strong>
              <p>{category.description || "Sin descripción"}</p>
            </div>
          ))}
        </div>
      </section>
    );
  const states = dashboard?.byStatus ?? [];
  const maximum = Math.max(1, ...states.map((item) => item.count));
  return (
    <section className="module-page card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ANALITICA</p>
          <h2>Reportes</h2>
          <p>Resumen operacional de los tickets registrados.</p>
        </div>
      </div>
      <div className="report-grid">
        <div>
          <span>Abiertos</span>
          <strong>{dashboard?.openTickets ?? 0}</strong>
        </div>
        <div>
          <span>Cerrados</span>
          <strong>{dashboard?.closedTickets ?? 0}</strong>
        </div>
        <div>
          <span>Creados este mes</span>
          <strong>{dashboard?.createdThisMonth ?? 0}</strong>
        </div>
      </div>
      <h3>Tickets por estado</h3>
      {states.length ? (
        <div className="status-chart">
          {states.map((item) => (
            <div className="chart-column" key={item.status}>
              <strong>{item.count}</strong>
              <div className="chart-track">
                <i
                  style={{
                    height: `${Math.max(8, (item.count / maximum) * 100)}%`,
                  }}
                ></i>
              </div>
              <span>{statusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Aún no hay tickets para incluir en este reporte.</div>
      )}
    </section>
  );
}
function TeamEditor({ users, token }: { users: User[]; token: string }) {
  const [members, setMembers] = useState(users);
  const [selected, setSelected] = useState<User | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setMembers(users), [users]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.updateUser(token, selected.id, {
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
        role: String(form.get("role")),
      });
      setMembers(
        members.map((member) =>
          member.id === selected.id ? result.data : member,
        ),
      );
      setSelected(result.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos actualizar el usuario. Inténtalo de nuevo.",
      );
    }
  }
  async function toggle(member: User) {
    try {
      const result = await api.updateUser(token, member.id, {
        active: !member.active,
      });
      setMembers(
        members.map((current) =>
          current.id === member.id ? result.data : current,
        ),
      );
      if (selected?.id === member.id) setSelected(result.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos actualizar el usuario. Inténtalo de nuevo.",
      );
    }
  }
  return (
    <section className="module-page card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ADMINISTRACION</p>
          <h2>Usuarios y equipo</h2>
          <p>
            Selecciona un usuario para editar sus permisos o disponibilidad.
          </p>
        </div>
      </div>
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      )}
      <div className="team-admin">
        <div className="team-list">
          {members.map((member) => (
            <button
              className={`team-member team-button ${selected?.id === member.id ? "selected" : ""}`}
              key={member.id}
              onClick={() => setSelected(member)}
            >
              <span className="avatar violet">{initials(member)}</span>
              <div>
                <strong>
                  {member.firstName} {member.lastName}
                </strong>
                <small>{member.email}</small>
              </div>
              <span className={`role role-${member.role}`}>{member.role}</span>
              <i className={member.active ? "user-active" : "user-inactive"}>
                {member.active ? "Activo" : "Inactivo"}
              </i>
            </button>
          ))}
        </div>
        <div className="user-editor">
          {selected ? (
            <form onSubmit={save}>
              <p className="eyebrow">EDITAR USUARIO</p>
              <h3>
                {selected.firstName} {selected.lastName}
              </h3>
              <label>
                Nombre
                <input
                  name="firstName"
                  defaultValue={selected.firstName}
                  required
                />
              </label>
              <label>
                Apellido
                <input
                  name="lastName"
                  defaultValue={selected.lastName}
                  required
                />
              </label>
              <label>
                Correo
                <input value={selected.email} disabled />
              </label>
              <label>
                Rol
                <select name="role" defaultValue={selected.role}>
                  <option value="usuario">Usuario</option>
                  <option value="tecnico">Tecnico</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </label>
              <div className="editor-actions">
                <button className="primary">Guardar cambios</button>
                <button
                  type="button"
                  className={selected.active ? "danger-button" : "secondary"}
                  onClick={() => void toggle(selected)}
                >
                  {selected.active ? "Desactivar usuario" : "Activar usuario"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty">
              Selecciona un usuario para administrarlo.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function TicketAuditTimeline({
  logs,
}: {
  logs: import("./services/api").AuditLog[];
}) {
  return (
    <aside className="audit-timeline">
      <p className="eyebrow">HISTORIAL</p>
      <h3>Actividad</h3>
      {logs.length ? (
        logs.map((log) => (
          <div className="audit-entry" key={log.id}>
            <i></i>
            <div>
              <strong>{log.details}</strong>
              <small>
                {log.user.firstName} {log.user.lastName} -{" "}
                {new Intl.DateTimeFormat("es-UY", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(log.createdAt))}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">No hay actividad registrada.</p>
      )}
    </aside>
  );
}
function TicketDetailV2({
  ticket,
  user,
  users,
  categories,
  token,
  onClose,
  onRefresh,
}: {
  ticket: Ticket;
  user: User;
  users: User[];
  categories: Category[];
  token: string;
  onClose: () => void;
  onRefresh: (id: number) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useFocusTrap<HTMLElement>();
  const canManage = user.role === "administrador" || user.role === "supervisor";
  const canEditContent = canManage || ticket.creator.id === user.id;
  const canChangeStatus =
    canManage || user.role === "tecnico" || ticket.creator.id === user.id;
  const update = async (data: {
    title?: string;
    description?: string;
    categoryId?: number;
    status?: string;
    priority?: string;
    assigneeId?: number;
  }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.updateTicket(token, ticket.id, data);
      await onRefresh(ticket.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos actualizar el ticket. Inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const download = async (id: number, name: string) => {
    try {
      const blob = await api.downloadAttachment(token, ticket.id, id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
            : "No pudimos descargar el archivo. Inténtalo de nuevo.",
      );
    }
  };
  const remove = async (attachment: { id: number; name: string }) => {
    if (submitting) return;
    if (!window.confirm(`¿Eliminar el archivo «${attachment.name}»? Esta acción no se puede deshacer.`)) return;
    try {
      setSubmitting(true);
      await api.deleteAttachment(token, ticket.id, attachment.id);
      await onRefresh(ticket.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos eliminar el archivo. Inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside
        className="ticket-detail"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="detail-head">
          <div>
            <p className="eyebrow">{ticket.number}</p>
            <h2 id="ticket-detail-title">{ticket.title}</h2>
          </div>
          <button aria-label="Cerrar detalle del ticket" onClick={onClose}>
            x
          </button>
        </div>
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
          </div>
        )}
        <div className="detail-meta">
          <Badge
            type="status"
            value={ticket.status}
            label={statusLabel(ticket.status)}
          />
          <Badge
            type="priority"
            value={ticket.priority}
            label={priorityLabel(ticket.priority)}
          />
          <span>{ticket.category.name}</span>
          {canEditContent && (
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancelar" : "Editar solicitud"}
            </button>
          )}
        </div>
        {editing ? (
          <form
            className="ticket-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void update({
                title: String(form.get("title")),
                description: String(form.get("description")),
                categoryId: Number(form.get("categoryId")),
              }).then(() => setEditing(false));
            }}
          >
            <label>
              Título
              <input
                name="title"
                defaultValue={ticket.title}
                minLength={5}
                required
              />
            </label>
            <label>
              Categoría
              <select name="categoryId" defaultValue={ticket.category.id}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descripción
              <textarea name="description" defaultValue={ticket.description} />
            </label>
            <button className="primary" disabled={submitting}>{submitting ? "Guardando..." : "Guardar cambios"}</button>
          </form>
        ) : (
          <p className="detail-description">
            {ticket.description || "Sin descripcion adicional."}
          </p>
        )}
        <div className="detail-people">
          <div>
            <small>Solicitante</small>
            <strong>
              {ticket.creator.firstName} {ticket.creator.lastName}
            </strong>
          </div>
          <div>
            <small>Técnico asignado</small>
            <strong>
              {ticket.assignee
                ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                : "Sin asignar"}
            </strong>
          </div>
        </div>
        {canChangeStatus && (
          <section className="ticket-actions">
            <label>
              Estado
              <select
                value={ticket.status}
                disabled={submitting}
                onChange={(event) =>
                  void update({ status: event.target.value })
                }
              >
                {statuses.slice(1).map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <label>
                Prioridad
                <select
                  value={ticket.priority}
                  disabled={submitting}
                  onChange={(event) =>
                    void update({ priority: event.target.value })
                  }
                >
                  {["baja", "media", "alta", "critica"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canManage && (
              <label>
                Técnico asignado
                <select
                  value={ticket.assignee?.id || ""}
                  disabled={submitting}
                  onChange={(event) =>
                    event.target.value &&
                    void update({ assigneeId: Number(event.target.value) })
                  }
                >
                  <option value="">Sin asignar</option>
                  {users
                    .filter((member) => member.role === "tecnico")
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </section>
        )}
        <section className="attachments">
          <h3>Adjuntos</h3>
          {(ticket.attachments ?? []).map((attachment) => (
            <div className="attachment-row" key={attachment.id}>
              <button
                onClick={() => void download(attachment.id, attachment.name)}
              >
                {attachment.name}
              </button>
              <small>{Math.ceil(attachment.size / 1024)} KB</small>
              {canManage && (
                <button
                  className="attachment-delete"
                  onClick={() => void remove(attachment)}
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
          {!ticket.attachments?.length && (
            <p className="muted">No hay archivos adjuntos.</p>
          )}
          <form
            className="upload-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const file = new FormData(event.currentTarget).get("file");
                  if (!(file instanceof File) || !file.size) {
                    setError("Selecciona un archivo antes de subirlo.");
                    return;
                  }
                  const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
                  if (file.size > 10 * 1024 * 1024 || !allowedTypes.includes(file.type)) {
                    setError("El adjunto debe ser PDF, PNG, JPG, DOCX o XLSX y no superar los 10 MB.");
                    return;
                  }
                  try {
                    setSubmitting(true);
                    await api.uploadAttachment(token, ticket.id, file);
                event.currentTarget.reset();
                await onRefresh(ticket.id);
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                      : "No se pudo subir el archivo.",
                  );
                  } finally {
                    setSubmitting(false);
                  }
            }}
          >
            <label>Archivo (PDF, PNG, JPG, DOCX o XLSX; hasta 10 MB)<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" /></label>
            <button className="secondary" disabled={submitting}>{submitting ? "Subiendo..." : "Subir archivo"}</button>
          </form>
        </section>
        <TicketAuditTimeline logs={ticket.auditLogs ?? []} />
        <section className="conversation">
          <h3>Conversación</h3>
          {(ticket.comments ?? []).map((comment) => (
            <div className="comment" key={comment.id}>
              <span className="avatar small">{initials(comment.user)}</span>
              <div>
                <strong>
                  {comment.user.firstName} {comment.user.lastName}
                </strong>
                <small>
                  {new Intl.DateTimeFormat("es-UY", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(comment.createdAt))}
                </small>
                <p>{comment.message}</p>
              </div>
            </div>
          ))}
          {!ticket.comments?.length && <p className="muted">Aún no hay comentarios. Agrega una actualización para iniciar la conversación.</p>}
          <form
            className="comment-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!message.trim()) return;
              try {
                if (submitting) return;
                setSubmitting(true);
                await api.addComment(token, ticket.id, message);
                setMessage("");
                await onRefresh(ticket.id);
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                      : "No pudimos enviar el comentario. Inténtalo de nuevo.",
                  );
                } finally {
                  setSubmitting(false);
                }
            }}
          >
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe una actualización para el equipo"
              maxLength={4000}
              disabled={submitting}
            />
            <button className="primary" disabled={submitting || !message.trim()}>{submitting ? "Enviando..." : "Enviar comentario"}</button>
          </form>
        </section>
      </aside>
    </div>
  );
}
function TicketDetail({
  ticket,
  user,
  users,
  categories,
  token,
  onClose,
  onRefresh,
}: {
  ticket: Ticket;
  user: User;
  users: User[];
  categories: Category[];
  token: string;
  onClose: () => void;
  onRefresh: (id: number) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const canManage = user.role === "administrador" || user.role === "supervisor";
  const canEditContent = canManage || ticket.creator.id === user.id;
  const canChangeStatus =
    canManage || user.role === "tecnico" || ticket.creator.id === user.id;
  async function update(data: {
    title?: string;
    description?: string;
    categoryId?: number;
    status?: string;
    priority?: string;
    assigneeId?: number;
  }) {
    try {
      await api.updateTicket(token, ticket.id, data);
      await onRefresh(ticket.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo actualizar el ticket.",
      );
    }
  }
  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      await api.addComment(token, ticket.id, message);
      setMessage("");
      await onRefresh(ticket.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo enviar el comentario.",
      );
    }
  }
  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) return;
    try {
      await api.uploadAttachment(token, ticket.id, file);
      await onRefresh(ticket.id);
      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo subir el archivo.",
      );
    }
  }
  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside
        className="ticket-detail"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="detail-head">
          <div>
            <p className="eyebrow">{ticket.number}</p>
            <h2>{ticket.title}</h2>
          </div>
          <button onClick={onClose}>x</button>
        </div>
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
          </div>
        )}
        <div className="detail-meta">
          <Badge
            type="status"
            value={ticket.status}
            label={statusLabel(ticket.status)}
          />
          <Badge
            type="priority"
            value={ticket.priority}
            label={priorityLabel(ticket.priority)}
          />
          <span>{ticket.category.name}</span>
          {canEditContent && (
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancelar" : "Editar solicitud"}
            </button>
          )}
        </div>
        {editing ? (
          <form
            className="ticket-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void update({
                title: String(data.get("title")),
                description: String(data.get("description")),
                categoryId: Number(data.get("categoryId")),
              }).then(() => setEditing(false));
            }}
          >
            <label>
              Titulo
              <input
                name="title"
                defaultValue={ticket.title}
                required
                minLength={5}
              />
            </label>
            <label>
              Categoria
              <select name="categoryId" defaultValue={ticket.category.id}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descripcion
              <textarea name="description" defaultValue={ticket.description} />
            </label>
            <button className="primary">Guardar cambios</button>
          </form>
        ) : (
          <p className="detail-description">
            {ticket.description || "Sin descripcion adicional."}
          </p>
        )}
        <div className="detail-people">
          <div>
            <small>Solicitante</small>
            <strong>
              {ticket.creator.firstName} {ticket.creator.lastName}
            </strong>
          </div>
          <div>
            <small>Tecnico asignado</small>
            <strong>
              {ticket.assignee
                ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                : "Sin asignar"}
            </strong>
          </div>
        </div>
        {canChangeStatus && (
          <section className="ticket-actions">
            <label>
              Estado
              <select
                value={ticket.status}
                onChange={(event) =>
                  void update({ status: event.target.value })
                }
              >
                {statuses.slice(1).map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <label>
                Prioridad
                <select
                  value={ticket.priority}
                  onChange={(event) =>
                    void update({ priority: event.target.value })
                  }
                >
                  {["baja", "media", "alta", "critica"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canManage && (
              <label>
                Tecnico
                <select
                  value={ticket.assignee?.id || ""}
                  onChange={(event) =>
                    void update({ assigneeId: Number(event.target.value) })
                  }
                >
                  <option value="" disabled>
                    Seleccionar tecnico
                  </option>
                  {users
                    .filter((member) => member.role === "tecnico")
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </section>
        )}
        <section className="attachments">
          <h3>Adjuntos</h3>
          {(ticket.attachments ?? []).map((attachment) => (
            <a
              key={attachment.id}
              href={`http://localhost:8080/api/v1/tickets/${ticket.id}/attachments/${attachment.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {attachment.name}{" "}
              <small>{Math.ceil(attachment.size / 1024)} KB</small>
            </a>
          ))}
          {!ticket.attachments?.length && (
            <p className="muted">Sin archivos adjuntos.</p>
          )}
          <form className="upload-form" onSubmit={uploadFile}>
            <input
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
            />
            <button className="secondary">Subir archivo</button>
          </form>
        </section>
        <section className="conversation">
          <h3>Conversacion</h3>
          {(ticket.comments ?? []).map((comment) => (
            <div className="comment" key={comment.id}>
              <span className="avatar small">{initials(comment.user)}</span>
              <div>
                <strong>
                  {comment.user.firstName} {comment.user.lastName}
                </strong>
                <small>
                  {new Intl.DateTimeFormat("es-UY", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(comment.createdAt))}
                </small>
                <p>{comment.message}</p>
              </div>
            </div>
          ))}
          {!ticket.comments?.length && (
            <p className="muted">Todavia no hay comentarios.</p>
          )}
          <form className="comment-form" onSubmit={comment}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe una actualizacion..."
            />
            <button className="primary">Enviar comentario</button>
          </form>
        </section>
      </aside>
    </div>
  );
}
function Login({
  onLogin,
}: {
  onLogin: (session: {
    token: string;
    refreshToken: string;
    user: User;
  }) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const result = await api.login(
        String(form.get("email")),
        String(form.get("password")),
      );
      onLogin({
        token: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No pudimos iniciar sesión. Verifica tu correo y contraseña e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>
            service<span>desk</span>
          </span>
        </div>
        <p className="eyebrow">PLATAFORMA DE SOPORTE</p>
        <h1>Inicia sesión</h1>
        <p className="subtitle">
          Accede al centro de soporte de tu organización.
        </p>
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
          </div>
        )}
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            defaultValue="admin@servicedesk.local"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            defaultValue="admin123"
            required
          />
        </label>
        <button className="primary login-submit" disabled={loading}>
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
        <small className="login-help">
          Usuario de desarrollo: admin@servicedesk.local
        </small>
      </form>
    </div>
  );
}
function TicketForm({
  categories,
  onClose,
  onSubmit,
  submitting,
}: {
  categories: Category[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  const dialogRef = useFocusTrap<HTMLFormElement>();
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-form-title"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">NUEVA SOLICITUD</p>
            <h2 id="ticket-form-title">Crear ticket</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar formulario"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <label>
          Título
          <input
            name="title"
            required
            minLength={5}
            maxLength={160}
            placeholder="Resume el problema en al menos 5 caracteres"
          />
        </label>
        <label>
          Categoría
          <select name="categoryId" required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {!categories.length && (
          <p className="muted">
            No hay categorías disponibles. Solicita a un administrador que cree una
            antes de registrar un ticket.
          </p>
        )}
        <label>
          Prioridad
          <select name="priority">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </label>
        <label>
          Descripción
          <textarea
            name="description"
            maxLength={4000}
            placeholder="Incluye el equipo afectado, qué ocurrió y cuándo comenzó"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className="primary" disabled={!categories.length || submitting}>
            {submitting ? "Creando..." : "Crear ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="metric card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small className="positive">{note}</small>
      </div>
    </div>
  );
}
function Legend({
  color,
  title,
  value,
}: {
  color: string;
  title: string;
  value: string;
}) {
  return (
    <div>
      <i className={color}></i>
      <span>{title}</span>
      <b>{value}</b>
    </div>
  );
}
function Activity({
  initials,
  text,
  bold,
  time,
  color,
}: {
  initials: string;
  text: string;
  bold: string;
  time: string;
  color: string;
}) {
  return (
    <div className="activity-row">
      <span className={`avatar small ${color}`}>{initials}</span>
      <div>
        <p>
          {text}
          <b>{bold}</b>
        </p>
        <small>{time}</small>
      </div>
    </div>
  );
}
function Badge({
  type,
  value,
  label,
}: {
  type: string;
  value: string;
  label: string;
}) {
  return <span className={`badge ${type}-${value}`}>{label}</span>;
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
