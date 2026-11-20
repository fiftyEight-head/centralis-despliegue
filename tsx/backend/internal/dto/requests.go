package dto

import "servicedesk/internal/models"

type LoginRequest struct { Email string `json:"email"`; Password string `json:"password"` }
type RefreshRequest struct { RefreshToken string `json:"refreshToken"` }
type CreateTicketRequest struct { Title string `json:"title"`; Description string `json:"description"`; CategoryID uint `json:"categoryId"`; Priority models.Priority `json:"priority"` }
type UpdateTicketRequest struct { Title *string `json:"title"`; Description *string `json:"description"`; CategoryID *uint `json:"categoryId"`; Status *models.TicketStatus `json:"status"`; Priority *models.Priority `json:"priority"`; AssigneeID *uint `json:"assigneeId"` }
type CreateCommentRequest struct { Message string `json:"message"` }
type CreateCategoryRequest struct { Name string `json:"name"`; Description string `json:"description"` }
type CreateUserRequest struct { FirstName string `json:"firstName"`; LastName string `json:"lastName"`; Email string `json:"email"`; Password string `json:"password"`; Role models.Role `json:"role"` }
type UpdateUserRequest struct { FirstName *string `json:"firstName"`; LastName *string `json:"lastName"`; Role *models.Role `json:"role"`; Active *bool `json:"active"` }
