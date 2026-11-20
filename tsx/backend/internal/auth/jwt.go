package auth

import (
	"time"
	"github.com/golang-jwt/jwt/v5"
)
type Manager struct { secret []byte }
type Claims struct { UserID uint `json:"userId"`; Role string `json:"role"`; jwt.RegisteredClaims }
func New(secret string) *Manager { return &Manager{secret: []byte(secret)} }
func (m *Manager) Create(userID uint, role string) (string, error) { claims := Claims{UserID: userID, Role: role, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)), IssuedAt: jwt.NewNumericDate(time.Now()), Subject: "access"}}; return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret) }
func (m *Manager) CreateRefresh(userID uint, role string) (string, error) { claims := Claims{UserID: userID, Role: role, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), IssuedAt: jwt.NewNumericDate(time.Now()), Subject: "refresh"}}; return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret) }
func (m *Manager) Parse(token string) (*Claims, error) { parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) { return m.secret, nil }); if err != nil { return nil, err }; claims, ok := parsed.Claims.(*Claims); if !ok || !parsed.Valid { return nil, jwt.ErrTokenInvalidClaims }; return claims, nil }
