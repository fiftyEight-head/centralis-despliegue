package middleware

import (
	"log/slog"
	"time"
	"github.com/gofiber/fiber/v2"
)

func StructuredLogger(logger *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error { started := time.Now(); err := c.Next(); logger.Info("http_request", "method", c.Method(), "path", c.Path(), "status", c.Response().StatusCode(), "duration_ms", time.Since(started).Milliseconds()); return err }
}
