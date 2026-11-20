package models

import "time"

type Role string
const ( RoleUser Role = "usuario"; RoleTechnician Role = "tecnico"; RoleSupervisor Role = "supervisor"; RoleAdmin Role = "administrador" )
type TicketStatus string
const ( StatusNew TicketStatus = "nuevo"; StatusAssigned TicketStatus = "asignado"; StatusInProgress TicketStatus = "en_progreso"; StatusPending TicketStatus = "pendiente"; StatusResolved TicketStatus = "resuelto"; StatusClosed TicketStatus = "cerrado"; StatusCancelled TicketStatus = "cancelado" )
type Priority string
const ( PriorityLow Priority = "baja"; PriorityMedium Priority = "media"; PriorityHigh Priority = "alta"; PriorityCritical Priority = "critica" )

type User struct { ID uint `gorm:"primaryKey" json:"id"`; FirstName string `json:"firstName"`; LastName string `json:"lastName"`; Email string `gorm:"uniqueIndex" json:"email"`; PasswordHash string `json:"-"`; Role Role `json:"role"`; Active bool `json:"active"`; CreatedAt time.Time `json:"createdAt"`; UpdatedAt time.Time `json:"updatedAt"` }
type Category struct { ID uint `gorm:"primaryKey" json:"id"`; Name string `gorm:"uniqueIndex" json:"name"`; Description string `json:"description"` }
type Ticket struct { ID uint `gorm:"primaryKey" json:"id"`; Number string `gorm:"uniqueIndex" json:"number"`; Title string `json:"title"`; Description string `json:"description"`; Status TicketStatus `json:"status"`; Priority Priority `json:"priority"`; CategoryID uint `json:"categoryId"`; Category Category `json:"category"`; CreatorID uint `json:"creatorId"`; Creator User `json:"creator"`; AssigneeID *uint `json:"assigneeId"`; Assignee *User `json:"assignee"`; Comments []Comment `json:"comments"`; Attachments []Attachment `json:"attachments"`; AuditLogs []AuditLog `json:"auditLogs"`; CreatedAt time.Time `json:"createdAt"`; UpdatedAt time.Time `json:"updatedAt"` }
type Comment struct { ID uint `gorm:"primaryKey" json:"id"`; TicketID uint `json:"ticketId"`; UserID uint `json:"userId"`; User User `json:"user"`; Message string `json:"message"`; CreatedAt time.Time `json:"createdAt"` }
type Attachment struct { ID uint `gorm:"primaryKey" json:"id"`; TicketID uint `json:"ticketId"`; Name string `json:"name"`; Path string `json:"path"`; Size int64 `json:"size"`; Type string `json:"type"`; CreatedAt time.Time `json:"createdAt"` }
type AuditLog struct { ID uint `gorm:"primaryKey" json:"id"`; TicketID uint `json:"ticketId"`; UserID uint `json:"userId"`; User User `json:"user"`; Action string `json:"action"`; Details string `json:"details"`; CreatedAt time.Time `json:"createdAt"` }
