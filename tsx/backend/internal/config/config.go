package config

import "os"

type Config struct {
	DatabaseURL    string
	JWTSecret      string
	Port           string
	FrontendOrigin string
}

func Load() Config {
	return Config{
		DatabaseURL: env("DATABASE_URL", "host=localhost user=servicedesk password=servicedesk dbname=servicedesk port=5432 sslmode=disable"),
		JWTSecret: env("JWT_SECRET", "change-me-in-production"),
		Port: env("PORT", "8080"),
		FrontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:5173"),
	}
}

func env(key, fallback string) string { if value := os.Getenv(key); value != "" { return value }; return fallback }
