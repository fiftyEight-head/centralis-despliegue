package middleware

import (
	"strings"
	"servicedesk/internal/auth"
	"github.com/gofiber/fiber/v2"
)
func RequireAuth(jwt *auth.Manager) fiber.Handler { return func(c *fiber.Ctx) error { token := strings.TrimPrefix(c.Get("Authorization"), "Bearer "); if token == "" { return fiber.NewError(fiber.StatusUnauthorized, "missing access token") }; claims, err := jwt.Parse(token); if err != nil { return fiber.NewError(fiber.StatusUnauthorized, "invalid access token") }; c.Locals("userID", claims.UserID); c.Locals("role", claims.Role); return c.Next() } }
