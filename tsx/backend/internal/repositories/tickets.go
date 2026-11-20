package repositories

import (
	"servicedesk/internal/models"
	"gorm.io/gorm"
)

type TicketRepository struct { db *gorm.DB }
func NewTicketRepository(db *gorm.DB) *TicketRepository { return &TicketRepository{db: db} }
func (r *TicketRepository) CategoryExists(id uint) bool { var count int64; r.db.Model(&models.Category{}).Where("id = ?", id).Count(&count); return count > 0 }
func (r *TicketRepository) Count() (int64, error) { var count int64; return count, r.db.Model(&models.Ticket{}).Count(&count).Error }
func (r *TicketRepository) Create(ticket *models.Ticket) error { return r.db.Create(ticket).Error }
func (r *TicketRepository) Get(id uint) (*models.Ticket, error) { var ticket models.Ticket; err := r.db.Preload("Category").Preload("Creator").Preload("Assignee").Preload("Comments.User").Preload("Attachments").Preload("AuditLogs.User").First(&ticket, id).Error; return &ticket, err }
func (r *TicketRepository) List(userID uint, role, query, status, sort string, page, pageSize int) ([]models.Ticket, int64, error) { db := r.db.Model(&models.Ticket{}); if role == string(models.RoleUser) { db = db.Where("creator_id = ?", userID) } else if role == string(models.RoleTechnician) { db = db.Where("assignee_id = ?", userID) }; if query != "" { db = db.Where("number ILIKE ? OR title ILIKE ?", "%"+query+"%", "%"+query+"%") }; if status != "" { db = db.Where("status = ?", status) }; var total int64; if err := db.Count(&total).Error; err != nil { return nil, 0, err }; order := "tickets.created_at desc"; if sort == "oldest" { order = "tickets.created_at asc" } else if sort == "priority" { order = "CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END" }; var tickets []models.Ticket; err := db.Preload("Category").Preload("Creator").Preload("Assignee").Order(order).Offset((page - 1) * pageSize).Limit(pageSize).Find(&tickets).Error; return tickets, total, err }
func (r *TicketRepository) Save(ticket *models.Ticket) error { return r.db.Save(ticket).Error }
func (r *TicketRepository) CreateComment(comment *models.Comment) error { return r.db.Create(comment).Error }
func (r *TicketRepository) GetComment(id uint) (*models.Comment, error) { var comment models.Comment; err := r.db.Preload("User").First(&comment, id).Error; return &comment, err }
func (r *TicketRepository) CreateAudit(log *models.AuditLog) error { return r.db.Create(log).Error }
