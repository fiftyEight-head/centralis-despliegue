package services

import (
	"errors"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"log/slog"
	"servicedesk/internal/models"
	"servicedesk/internal/repositories"
	"strings"
	"time"
)

type TicketService struct {
	tickets *repositories.TicketRepository
}

func NewTicketService(db *gorm.DB) *TicketService {
	return &TicketService{tickets: repositories.NewTicketRepository(db)}
}
func Seed(db *gorm.DB) error {
	categories := []string{"Hardware", "Software", "Redes", "Accesos", "Servidores", "Correo", "Infraestructura", "Otros"}
	for _, name := range categories {
		if err := db.FirstOrCreate(&models.Category{}, models.Category{Name: name, Description: "Solicitudes de " + strings.ToLower(name)}).Error; err != nil {
			return err
		}
	}
	people := []models.User{
		{FirstName: "Admin", LastName: "ServiceDesk", Email: "admin@servicedesk.local", Role: models.RoleAdmin},
		{FirstName: "Andrea", LastName: "Molina", Email: "andrea.molina@acme.local", Role: models.RoleSupervisor},
		{FirstName: "Martin", LastName: "Pereyra", Email: "martin.pereyra@acme.local", Role: models.RoleTechnician},
		{FirstName: "Elena", LastName: "Vega", Email: "elena.vega@acme.local", Role: models.RoleTechnician},
		{FirstName: "Diego", LastName: "Suarez", Email: "diego.suarez@acme.local", Role: models.RoleTechnician},
		{FirstName: "Mariana", LastName: "Rodriguez", Email: "mariana.rodriguez@acme.local", Role: models.RoleUser},
		{FirstName: "Carlos", LastName: "Mendez", Email: "carlos.mendez@acme.local", Role: models.RoleUser},
		{FirstName: "Lucia", LastName: "Fernandez", Email: "lucia.fernandez@acme.local", Role: models.RoleUser},
		{FirstName: "Valentina", LastName: "Costa", Email: "valentina.costa@acme.local", Role: models.RoleUser},
		{FirstName: "Sofia", LastName: "Alvarado", Email: "sofia.alvarado@centralis.local", Role: models.RoleUser},
		{FirstName: "Mateo", LastName: "Alvarez", Email: "mateo.alvarez@centralis.local", Role: models.RoleUser},
		{FirstName: "Camila", LastName: "Silva", Email: "camila.silva@centralis.local", Role: models.RoleUser},
		{FirstName: "Daniela", LastName: "Quispe", Email: "daniela.quispe@centralis.local", Role: models.RoleUser},
		{FirstName: "Javier", LastName: "Herrera", Email: "javier.herrera@centralis.local", Role: models.RoleUser},
		{FirstName: "Amina", LastName: "Khan", Email: "amina.khan@centralis.local", Role: models.RoleUser},
		{FirstName: "Nicolas", LastName: "Dupont", Email: "nicolas.dupont@centralis.local", Role: models.RoleUser},
		{FirstName: "Priya", LastName: "Shah", Email: "priya.shah@centralis.local", Role: models.RoleUser},
		{FirstName: "Rafael", LastName: "Santos", Email: "rafael.santos@centralis.local", Role: models.RoleTechnician},
		{FirstName: "Amelia", LastName: "Clarke", Email: "amelia.clarke@centralis.local", Role: models.RoleTechnician},
	}
	users := map[string]models.User{}
	for _, person := range people {
		var user models.User
		result := db.Where("email = ?", person.Email).First(&user)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
			person.PasswordHash, person.Active = string(hash), true
			if err := db.Create(&person).Error; err != nil {
				return err
			}
			user = person
		}
		if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return result.Error
		}
		users[user.Email] = user
	}
	var records []models.Category
	if err := db.Find(&records).Error; err != nil {
		return err
	}
	categoryIDs := map[string]uint{}
	for _, category := range records {
		categoryIDs[category.Name] = category.ID
	}
	var count int64
	db.Model(&models.Ticket{}).Count(&count)
	if count == 0 {
		historical := []struct {
			title, description, category, creator, technician string
			priority                                          models.Priority
			status                                            models.TicketStatus
			days                                              int
		}{
			{"Acceso remoto a la red bancaria", "La autenticacion MFA falla al ingresar a la red corporativa desde una sucursal.", "Accesos", "mariana.rodriguez@acme.local", "martin.pereyra@acme.local", models.PriorityCritical, models.StatusInProgress, 1},
			{"Permiso para consulta de clientes", "Se requiere acceso de solo lectura al modulo de consulta para atender reclamos.", "Accesos", "carlos.mendez@acme.local", "elena.vega@acme.local", models.PriorityHigh, models.StatusAssigned, 3},
			{"Alta de usuario en portal de tesoreria", "Solicitud de acceso con perfil operador para el equipo de Tesoreria.", "Accesos", "lucia.fernandez@acme.local", "", models.PriorityHigh, models.StatusNew, 5},
			{"Token de seguridad bloqueado", "El segundo factor se bloqueo luego de intentos fallidos y no permite operar.", "Accesos", "valentina.costa@acme.local", "diego.suarez@acme.local", models.PriorityCritical, models.StatusPending, 8},
			{"Permisos para reportes regulatorios", "No es posible abrir los reportes mensuales del area de Cumplimiento.", "Accesos", "mariana.rodriguez@acme.local", "martin.pereyra@acme.local", models.PriorityMedium, models.StatusResolved, 12},
			{"Acceso a archivos de auditoria", "El perfil de Auditoria Interna no puede consultar la evidencia historica.", "Accesos", "carlos.mendez@acme.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusClosed, 18},
			{"Cuenta corporativa bloqueada", "La cuenta de directorio quedo bloqueada y no permite iniciar sesion en aplicaciones internas.", "Accesos", "lucia.fernandez@acme.local", "elena.vega@acme.local", models.PriorityHigh, models.StatusClosed, 26},
			{"Renovacion de certificado VPN", "El certificado de acceso remoto vence esta semana y debe renovarse.", "Accesos", "valentina.costa@acme.local", "elena.vega@acme.local", models.PriorityMedium, models.StatusClosed, 38},
		}
		now := time.Now()
		for index, item := range historical {
			created := now.AddDate(0, 0, -item.days)
			var assignee *uint
			if item.technician != "" {
				id := users[item.technician].ID
				assignee = &id
			}
			ticket := models.Ticket{Number: fmt.Sprintf("INC-%04d", index+1), Title: item.title, Description: item.description, CategoryID: categoryIDs[item.category], CreatorID: users[item.creator].ID, AssigneeID: assignee, Priority: item.priority, Status: item.status, CreatedAt: created, UpdatedAt: created.Add(2 * time.Hour)}
			if err := db.Create(&ticket).Error; err != nil {
				return err
			}
		}
	}
	additional := []struct {
		number, title, description, creator, technician string
		priority                                        models.Priority
		status                                          models.TicketStatus
		days                                            int
	}{
		{"INC-0101", "Acceso a banca empresas", "El usuario no puede ingresar al portal interno de banca empresas tras el cambio de contrasena.", "mariana.rodriguez@acme.local", "martin.pereyra@acme.local", models.PriorityHigh, models.StatusInProgress, 0},
		{"INC-0102", "Asignacion de rol aprobador", "Se solicita habilitar el rol aprobador para transferencias internas del area de Finanzas.", "carlos.mendez@acme.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusAssigned, 1},
		{"INC-0103", "Restablecimiento de segundo factor", "El dispositivo de autenticacion fue reemplazado y requiere registrar un nuevo segundo factor.", "lucia.fernandez@acme.local", "elena.vega@acme.local", models.PriorityHigh, models.StatusNew, 2},
		{"INC-0104", "Acceso denegado a conciliaciones", "El equipo de Operaciones no puede consultar el modulo de conciliaciones diarias.", "valentina.costa@acme.local", "martin.pereyra@acme.local", models.PriorityMedium, models.StatusPending, 3},
		{"INC-0105", "Baja de acceso de colaborador", "Se requiere revocar los permisos de aplicaciones bancarias por cambio de sector.", "mariana.rodriguez@acme.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusResolved, 4},
		{"INC-0106", "Habilitacion de firma digital", "El nuevo analista necesita acceso a la firma digital para documentacion interna.", "carlos.mendez@acme.local", "elena.vega@acme.local", models.PriorityMedium, models.StatusAssigned, 5},
		{"INC-0107", "Acceso a tablero de riesgo", "El perfil de Riesgo no visualiza el tablero de monitoreo operativo.", "lucia.fernandez@acme.local", "martin.pereyra@acme.local", models.PriorityMedium, models.StatusNew, 6},
		{"INC-0108", "Desbloqueo de usuario de sucursal", "La cuenta de una sucursal quedo bloqueada despues de actualizar las credenciales.", "valentina.costa@acme.local", "diego.suarez@acme.local", models.PriorityCritical, models.StatusInProgress, 7},
		{"INC-0109", "Acceso a pagos internacionales", "La sede de Santiago no puede ingresar al modulo de pagos internacionales.", "sofia.alvarado@centralis.local", "rafael.santos@centralis.local", models.PriorityHigh, models.StatusInProgress, 1},
		{"INC-0110", "Perfil de consulta en Colombia", "Un analista de Bogota requiere perfil de solo lectura para verificar operaciones.", "mateo.alvarez@centralis.local", "martin.pereyra@acme.local", models.PriorityMedium, models.StatusAssigned, 2},
		{"INC-0111", "MFA para sucursal de Sao Paulo", "La aplicacion de autenticacion no valida los codigos de la nueva sucursal.", "camila.silva@centralis.local", "rafael.santos@centralis.local", models.PriorityCritical, models.StatusNew, 2},
		{"INC-0112", "Acceso a reportes de liquidez", "El equipo de Lima no puede abrir los reportes diarios de liquidez regional.", "daniela.quispe@centralis.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusPending, 3},
		{"INC-0113", "Rol de aprobacion en Mexico", "Se solicita asignar el perfil de aprobador para operaciones internas en Ciudad de Mexico.", "javier.herrera@centralis.local", "elena.vega@acme.local", models.PriorityHigh, models.StatusAssigned, 3},
		{"INC-0114", "Certificado de acceso vencido", "El certificado usado para el portal corporativo de Londres vencio esta manana.", "amina.khan@centralis.local", "amelia.clarke@centralis.local", models.PriorityCritical, models.StatusInProgress, 4},
		{"INC-0115", "Permisos para conciliacion europea", "El equipo de Paris necesita acceso al tablero de conciliaciones de la region.", "nicolas.dupont@centralis.local", "amelia.clarke@centralis.local", models.PriorityMedium, models.StatusNew, 4},
		{"INC-0116", "Cuenta bloqueada en oficina de Mumbai", "El usuario fue bloqueado luego de un reinicio de credenciales corporativas.", "priya.shah@centralis.local", "rafael.santos@centralis.local", models.PriorityHigh, models.StatusResolved, 5},
		{"INC-0117", "Alta de operador de divisas", "Se requiere habilitar un operador para el modulo de cambios y divisas de Chile.", "sofia.alvarado@centralis.local", "martin.pereyra@acme.local", models.PriorityHigh, models.StatusAssigned, 5},
		{"INC-0118", "Consulta de alertas AML", "El perfil de Cumplimiento en Colombia no visualiza las alertas pendientes.", "mateo.alvarez@centralis.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusInProgress, 6},
		{"INC-0119", "Acceso temporal para auditoria", "Auditoria externa requiere acceso temporal y de solo lectura a evidencia de Brasil.", "camila.silva@centralis.local", "elena.vega@acme.local", models.PriorityMedium, models.StatusPending, 6},
		{"INC-0120", "Firma digital para contratos", "No se habilita la firma digital de la responsable regional de Peru.", "daniela.quispe@centralis.local", "rafael.santos@centralis.local", models.PriorityHigh, models.StatusNew, 7},
		{"INC-0121", "Restablecer acceso SWIFT", "El usuario autorizado de Mexico no puede iniciar sesion en el portal de mensajeria financiera.", "javier.herrera@centralis.local", "martin.pereyra@acme.local", models.PriorityCritical, models.StatusInProgress, 7},
		{"INC-0122", "Perfil de tesoreria regional", "Falta el permiso para consultar posiciones de tesoreria en Reino Unido.", "amina.khan@centralis.local", "amelia.clarke@centralis.local", models.PriorityHigh, models.StatusAssigned, 8},
		{"INC-0123", "Acceso a tablero antifraude", "La oficina de Paris no tiene acceso al tablero de monitoreo antifraude.", "nicolas.dupont@centralis.local", "diego.suarez@acme.local", models.PriorityHigh, models.StatusPending, 8},
		{"INC-0124", "Registro de nuevo dispositivo", "Se debe registrar un dispositivo corporativo como segundo factor para India.", "priya.shah@centralis.local", "rafael.santos@centralis.local", models.PriorityMedium, models.StatusResolved, 9},
		{"INC-0125", "Permisos en expediente de credito", "El analista de Santiago no puede consultar expedientes de credito asignados.", "sofia.alvarado@centralis.local", "elena.vega@acme.local", models.PriorityMedium, models.StatusClosed, 9},
		{"INC-0126", "Acceso a plataforma de cobranzas", "La cuenta de Bogota no puede ingresar a la plataforma de cobranzas regional.", "mateo.alvarez@centralis.local", "martin.pereyra@acme.local", models.PriorityHigh, models.StatusClosed, 10},
		{"INC-0127", "Revocar perfil por transferencia", "Se requiere retirar permisos de operaciones del usuario transferido en Brasil.", "camila.silva@centralis.local", "rafael.santos@centralis.local", models.PriorityHigh, models.StatusResolved, 10},
		{"INC-0128", "Acceso a repositorio normativo", "El equipo de Lima no puede abrir la documentacion normativa actualizada.", "daniela.quispe@centralis.local", "diego.suarez@acme.local", models.PriorityLow, models.StatusClosed, 11},
		{"INC-0129", "Habilitar consulta de cuentas", "El perfil de atencion en Mexico requiere consulta de cuentas sin autorizacion de movimientos.", "javier.herrera@centralis.local", "elena.vega@acme.local", models.PriorityMedium, models.StatusAssigned, 11},
		{"INC-0130", "Error de SSO en portal corporativo", "El inicio de sesion unico falla para usuarios de la oficina de Londres.", "amina.khan@centralis.local", "amelia.clarke@centralis.local", models.PriorityCritical, models.StatusInProgress, 12},
		{"INC-0131", "Acceso de respaldo para tesoreria", "Se necesita habilitar el usuario de respaldo de Tesoreria en Paris.", "nicolas.dupont@centralis.local", "rafael.santos@centralis.local", models.PriorityHigh, models.StatusNew, 12},
		{"INC-0132", "Permiso para cierre diario", "El equipo de Mumbai no cuenta con acceso a la pantalla de cierre operativo.", "priya.shah@centralis.local", "martin.pereyra@acme.local", models.PriorityHigh, models.StatusPending, 13},
		{"INC-0133", "Acceso a informes de cartera", "La oficina de Santiago no visualiza informes de cartera comercial.", "sofia.alvarado@centralis.local", "diego.suarez@acme.local", models.PriorityMedium, models.StatusResolved, 13},
		{"INC-0134", "Bloqueo por politicas de contrasena", "La cuenta de Bogota quedo bloqueada luego de aplicar nuevas politicas de seguridad.", "mateo.alvarez@centralis.local", "elena.vega@acme.local", models.PriorityHigh, models.StatusClosed, 14},
		{"INC-0135", "Acceso a mesa de dinero", "El operador de Sao Paulo no puede ingresar a la herramienta interna de mesa de dinero.", "camila.silva@centralis.local", "rafael.santos@centralis.local", models.PriorityCritical, models.StatusInProgress, 14},
		{"INC-0136", "Consulta de limites operativos", "El perfil de Riesgo en Lima no puede consultar limites operativos regionales.", "daniela.quispe@centralis.local", "martin.pereyra@acme.local", models.PriorityMedium, models.StatusAssigned, 15},
		{"INC-0137", "Acceso a modulo de garantias", "El area de Creditos en Mexico requiere acceso al modulo de garantias.", "javier.herrera@centralis.local", "diego.suarez@acme.local", models.PriorityMedium, models.StatusNew, 15},
		{"INC-0138", "Renovacion de credenciales de servicio", "El acceso de servicio para reportes regionales debe renovarse antes del cierre mensual.", "amina.khan@centralis.local", "amelia.clarke@centralis.local", models.PriorityHigh, models.StatusPending, 16},
	}
	for _, item := range additional {
		var existing models.Ticket
		if err := db.Where("number = ?", item.number).First(&existing).Error; err == nil {
			continue
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		created := time.Now().AddDate(0, 0, -item.days)
		assigneeID := users[item.technician].ID
		ticket := models.Ticket{Number: item.number, Title: item.title, Description: item.description, CategoryID: categoryIDs["Accesos"], CreatorID: users[item.creator].ID, AssigneeID: &assigneeID, Priority: item.priority, Status: item.status, CreatedAt: created, UpdatedAt: created.Add(2 * time.Hour)}
		if err := db.Create(&ticket).Error; err != nil {
			return err
		}
	}
	var tickets []models.Ticket
	if err := db.Order("id").Find(&tickets).Error; err != nil {
		return err
	}
	legacyCreators := []string{"mariana.rodriguez@acme.local", "carlos.mendez@acme.local", "lucia.fernandez@acme.local", "valentina.costa@acme.local"}
	legacyTechnicians := []string{"martin.pereyra@acme.local", "elena.vega@acme.local", "", "diego.suarez@acme.local"}
	for index := range tickets {
		if !strings.HasPrefix(tickets[index].Number, "INC-000") {
			continue
		}
		updates := map[string]interface{}{}
		if tickets[index].CreatorID == users["admin@servicedesk.local"].ID {
			updates["creator_id"] = users[legacyCreators[index%len(legacyCreators)]].ID
		}
		if tickets[index].AssigneeID == nil && legacyTechnicians[index%len(legacyTechnicians)] != "" {
			updates["assignee_id"] = users[legacyTechnicians[index%len(legacyTechnicians)]].ID
		}
		if len(updates) > 0 {
			if err := db.Model(&tickets[index]).Updates(updates).Error; err != nil {
				return err
			}
		}
	}
	commentAuthors := []string{"martin.pereyra@acme.local", "elena.vega@acme.local", "diego.suarez@acme.local"}
	comments := []string{"Revisamos el incidente y comenzamos el diagnostico.", "Se aplico una actualizacion. Por favor confirme si el servicio funciona correctamente.", "El caso fue validado con el solicitante y queda documentado para seguimiento."}
	for index, ticket := range tickets {
		var commentCount int64
		db.Model(&models.Comment{}).Where("ticket_id = ?", ticket.ID).Count(&commentCount)
		if commentCount > 0 {
			continue
		}
		author := users[commentAuthors[index%len(commentAuthors)]]
		created := ticket.CreatedAt.Add(time.Duration(index%3+1) * time.Hour)
		comment := models.Comment{TicketID: ticket.ID, UserID: author.ID, Message: comments[index%len(comments)], CreatedAt: created}
		if err := db.Create(&comment).Error; err != nil {
			return err
		}
	}
	return nil
}
func (s *TicketService) Create(creatorID uint, title, description string, categoryID uint, priority models.Priority) (*models.Ticket, error) {
	if !s.tickets.CategoryExists(categoryID) {
		return nil, fmt.Errorf("category not found")
	}
	count, err := s.tickets.Count()
	if err != nil {
		return nil, err
	}
	ticket := models.Ticket{Number: fmt.Sprintf("INC-%04d", count+1), Title: strings.TrimSpace(title), Description: strings.TrimSpace(description), CategoryID: categoryID, CreatorID: creatorID, Priority: priority, Status: models.StatusNew}
	if err := s.tickets.Create(&ticket); err != nil {
		return nil, err
	}
	_ = s.tickets.CreateAudit(&models.AuditLog{TicketID: ticket.ID, UserID: creatorID, Action: "ticket_created", Details: "Ticket creado"})
	slog.Info("ticket_created", "ticket_id", ticket.ID, "number", ticket.Number, "creator_id", creatorID)
	return s.Get(ticket.ID)
}
func (s *TicketService) Get(id uint) (*models.Ticket, error) { return s.tickets.Get(id) }
func (s *TicketService) List(userID uint, role string, query, status, sort string, page, pageSize int) ([]models.Ticket, int64, error) {
	return s.tickets.List(userID, role, query, status, sort, page, pageSize)
}
func (s *TicketService) Update(ticket *models.Ticket, actorID uint, role string, title, description *string, categoryID *uint, status *models.TicketStatus, priority *models.Priority, assigneeID *uint) error {
	isManager := role == string(models.RoleAdmin) || role == string(models.RoleSupervisor)
	isTech := role == string(models.RoleTechnician)
	isCreator := ticket.CreatorID == actorID
	if !isManager && !isTech && !isCreator {
		return fmt.Errorf("forbidden")
	}
	if (title != nil || description != nil || categoryID != nil) && !isManager && !isCreator {
		return fmt.Errorf("only the creator can edit ticket content")
	}
	if !isManager && (priority != nil || assigneeID != nil) {
		return fmt.Errorf("only supervisors can change priority or assignment")
	}
	if status != nil {
		if !isManager && !isTech && *status != models.StatusClosed {
			return fmt.Errorf("users can only close tickets")
		}
		if !validTransition(ticket.Status, *status) {
			return fmt.Errorf("invalid status transition from %s to %s", ticket.Status, *status)
		}
	}
	if title != nil {
		ticket.Title = strings.TrimSpace(*title)
	}
	if description != nil {
		ticket.Description = strings.TrimSpace(*description)
	}
	if categoryID != nil {
		if !s.tickets.CategoryExists(*categoryID) {
			return fmt.Errorf("category not found")
		}
		ticket.CategoryID = *categoryID
	}
	previousStatus := ticket.Status
	if status != nil {
		ticket.Status = *status
	}
	if priority != nil {
		ticket.Priority = *priority
	}
	if assigneeID != nil {
		ticket.AssigneeID = assigneeID
		if ticket.Status == models.StatusNew {
			ticket.Status = models.StatusAssigned
		}
	}
	if err := s.tickets.Save(ticket); err != nil {
		return err
	}
	if previousStatus != ticket.Status {
		_ = s.tickets.CreateAudit(&models.AuditLog{TicketID: ticket.ID, UserID: actorID, Action: "status_changed", Details: fmt.Sprintf("Estado: %s a %s", previousStatus, ticket.Status)})
		slog.Info("ticket_status_changed", "ticket_id", ticket.ID, "actor_id", actorID, "from", previousStatus, "to", ticket.Status)
	}
	return nil
}
func validTransition(from, to models.TicketStatus) bool {
	if from == to {
		return true
	}
	allowed := map[models.TicketStatus][]models.TicketStatus{models.StatusNew: {models.StatusAssigned, models.StatusCancelled}, models.StatusAssigned: {models.StatusInProgress, models.StatusPending, models.StatusCancelled}, models.StatusInProgress: {models.StatusPending, models.StatusResolved, models.StatusCancelled}, models.StatusPending: {models.StatusInProgress, models.StatusResolved, models.StatusCancelled}, models.StatusResolved: {models.StatusClosed, models.StatusInProgress}, models.StatusClosed: {}, models.StatusCancelled: {}}
	for _, candidate := range allowed[from] {
		if candidate == to {
			return true
		}
	}
	return false
}
func (s *TicketService) AddComment(ticketID, userID uint, message string) (*models.Comment, error) {
	comment := models.Comment{TicketID: ticketID, UserID: userID, Message: strings.TrimSpace(message)}
	if err := s.tickets.CreateComment(&comment); err != nil {
		return nil, err
	}
	_ = s.tickets.CreateAudit(&models.AuditLog{TicketID: ticketID, UserID: userID, Action: "comment_added", Details: "Comentario agregado"})
	slog.Info("ticket_comment_created", "ticket_id", ticketID, "user_id", userID)
	return s.tickets.GetComment(comment.ID)
}
