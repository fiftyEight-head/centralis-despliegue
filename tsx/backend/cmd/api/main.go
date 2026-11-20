package main

import (
	"log"
	"log/slog"
	"os"

	"servicedesk/internal/auth"
	"servicedesk/internal/config"
	"servicedesk/internal/handlers"
	"servicedesk/internal/middleware"
	"servicedesk/internal/models"
	"servicedesk/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil { log.Fatal("database connection failed: ", err) }
	if err := os.MkdirAll("uploads", 0750); err != nil { log.Fatal("uploads directory failed: ", err) }
	if err := db.AutoMigrate(&models.User{}, &models.Category{}, &models.Ticket{}, &models.Comment{}, &models.Attachment{}, &models.AuditLog{}); err != nil { log.Fatal("migration failed: ", err) }
	if err := services.Seed(db); err != nil { log.Fatal("seed failed: ", err) }

	jwt := auth.New(cfg.JWTSecret)
	service := services.NewTicketService(db)
	api := handlers.New(db, service, jwt)

	app := fiber.New(fiber.Config{ErrorHandler: handlers.ErrorHandler})
	app.Use(middleware.StructuredLogger(logger))
	app.Use(helmet.New())
	app.Use(cors.New(cors.Config{AllowOrigins: cfg.FrontendOrigin, AllowHeaders: "Origin, Content-Type, Accept, Authorization"}))
	app.Use(limiter.New(limiter.Config{Max: 120}))
	app.Get("/health", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	app.Get("/docs", func(c *fiber.Ctx) error { return c.SendFile("docs/index.html") })
	app.Get("/docs/openapi.yaml", func(c *fiber.Ctx) error { return c.SendFile("docs/openapi.yaml") })
	v1 := app.Group("/api/v1")
	v1.Post("/auth/login", api.Login)
	v1.Post("/auth/refresh", api.Refresh)
	v1.Get("/categories", api.ListCategories)
	protected := v1.Group("", middleware.RequireAuth(jwt))
	protected.Get("/auth/me", api.Me)
	protected.Get("/users", api.ListUsers)
	protected.Post("/users", api.CreateUser)
	protected.Patch("/users/:id", api.UpdateUser)
	protected.Get("/dashboard", api.Dashboard)
	protected.Get("/tickets", api.ListTickets)
	protected.Post("/tickets", api.CreateTicket)
	protected.Get("/tickets/:id", api.GetTicket)
	protected.Patch("/tickets/:id", api.UpdateTicket)
	protected.Post("/tickets/:id/comments", api.AddComment)
	protected.Get("/tickets/:id/audit", api.ListAudit)
	protected.Post("/tickets/:id/attachments", api.UploadAttachment)
	protected.Get("/tickets/:id/attachments/:attachmentId", api.DownloadAttachment)
	protected.Delete("/tickets/:id/attachments/:attachmentId", api.DeleteAttachment)
	protected.Post("/categories", api.CreateCategory)

	log.Fatal(app.Listen(":" + cfg.Port))
}
