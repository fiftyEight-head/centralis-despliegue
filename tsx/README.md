# ServiceDesk

Aplicacion web de gestion de tickets de soporte tecnico. Se compone de un frontend React y una API REST en Go, con persistencia en PostgreSQL.

Incluye:

- autenticacion con JWT y refresh token;
- gestion de tickets, categorias, comentarios y adjuntos;
- busqueda, filtros, ordenamiento y paginacion de tickets;
- dashboard con indicadores por estado y prioridad;
- roles de usuario, tecnico, supervisor y administrador;
- administracion de usuarios y categorias para administradores;
- registro de auditoria de cambios de estado.

## Stack

- React, TypeScript y Vite
- Go 1.26 y Fiber
- GORM
- PostgreSQL 16
- JWT y bcrypt

## Direcciones del despliegue

Reemplaza los marcadores por los valores de tu infraestructura:

- Frontend: `http://IP_FRONTEND`
- API privada: `http://IP_BACKEND:8080`
- Documentacion OpenAPI: `http://IP_FRONTEND/docs`
- Especificacion OpenAPI: `http://IP_FRONTEND/docs/openapi.yaml`
- Health check: `http://IP_FRONTEND/health`
- Base de datos PostgreSQL: `ENDPOINT_RDS:5432`

## Credenciales demo

- Administrador: `admin@servicedesk.local` / `admin123`

El proceso de inicializacion tambien crea usuarios demo de los roles supervisor, tecnico y usuario. Todos utilizan la contrasena `admin123`.

## Configuracion de la API

La API requiere estas variables de entorno:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT=8080`
- `FRONTEND_ORIGIN=http://IP_FRONTEND`

Usa una conexion TLS hacia RDS en `DATABASE_URL`:

```text
host=ENDPOINT_RDS user=RDS_USER password=RDS_PASSWORD dbname=RDS_DATABASE port=5432 sslmode=require
```

## Endpoints principales

Todos los endpoints de la API, excepto `/health` y `/docs`, usan el prefijo `/api/v1`.

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me` protegido
- `GET /api/v1/categories`
- `POST /api/v1/categories` protegido, solo administrador
- `GET /api/v1/users` protegido, supervisor o administrador
- `POST /api/v1/users` protegido, solo administrador
- `PATCH /api/v1/users/:id` protegido, solo administrador
- `GET /api/v1/dashboard` protegido
- `GET /api/v1/tickets` protegido
- `POST /api/v1/tickets` protegido
- `GET /api/v1/tickets/:id` protegido
- `PATCH /api/v1/tickets/:id` protegido
- `POST /api/v1/tickets/:id/comments` protegido
- `GET /api/v1/tickets/:id/audit` protegido
- `POST /api/v1/tickets/:id/attachments` protegido
- `GET /api/v1/tickets/:id/attachments/:attachmentId` protegido
- `DELETE /api/v1/tickets/:id/attachments/:attachmentId` protegido, supervisor o administrador

Los adjuntos aceptan PDF, PNG, JPG/JPEG, DOCX y XLSX, con un tamano maximo de 10 MB.

## Ejemplos curl

Iniciar sesion para obtener los tokens:

```bash
curl -X POST http://IP_FRONTEND/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@servicedesk.local","password":"admin123"}'
```

Guarda el valor `accessToken` de la respuesta:

```bash
export ACCESS_TOKEN="TOKEN_DEVUELTO_POR_LOGIN"
```

Consultar el usuario autenticado:

```bash
curl http://IP_FRONTEND/api/v1/auth/me \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Crear un ticket:

```bash
curl -X POST http://IP_FRONTEND/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{
    "title":"No puedo acceder al correo",
    "description":"El cliente de correo rechaza mis credenciales.",
    "categoryId":1,
    "priority":"alta"
  }'
```

## Rutas web

- `/` resumen y dashboard
- `/tickets` tickets visibles para el rol autenticado
- `/mis-tickets` tickets creados por el usuario autenticado
- `/equipo` administracion del equipo
- `/categorias` listado y alta de categorias
- `/reportes` indicadores operativos

## Despliegue en Amazon Linux

Los siguientes artefactos ya estan incluidos en `artifacts/`; no es necesario compilarlos.

| Artefacto | Capa | Destino en EC2 | Funcion |
| --- | --- | --- | --- |
| `servicedesk` | Backend | `/opt/servicedesk/servicedesk` | Binario compilado de la API Go. Se ejecuta mediante `systemd` en la instancia backend. |
| `web.tar.gz` | Frontend | `/var/www/servicedesk` | Archivos estaticos compilados de React. Nginx los sirve desde la instancia frontend. |

### Puertos

| Capa | Puerto |
| --- | --- |
| Frontend (Nginx) | `80/TCP` |
| Backend (API Go) | `8080/TCP` |
| RDS PostgreSQL | `5432/TCP` |

## Variables y secretos

Define los valores del backend en `/opt/servicedesk/.env` de la instancia backend. El bloque de *user data* de backend crea ese archivo; completa sus marcadores antes de crear la EC2.

| Valor | Donde se configura | Uso |
| --- | --- | --- |
| `ENDPOINT_RDS` | Marcador de `DATABASE_URL` en el *user data* del backend | Endpoint de la instancia RDS. |
| `RDS_DATABASE` | Marcador de `DATABASE_URL` en el *user data* del backend | Nombre de la base de datos creada en RDS. |
| `RDS_USER` | Marcador de `DATABASE_URL` en el *user data* del backend | Usuario maestro o usuario de aplicacion de RDS. |
| `RDS_PASSWORD` | Marcador de `DATABASE_URL` en el *user data* del backend | Contrasena de `RDS_USER`; es un secreto. |
| `JWT_SECRET` | Se genera en el *user data* del backend y se guarda en `/opt/servicedesk/.env` | Firma y valida los tokens JWT. No lo incluyas como texto fijo en el README ni en el repositorio. |
| `IP_FRONTEND` | Marcador de `FRONTEND_ORIGIN` en el *user data* del backend | IP publica o dominio desde el que se permitiran solicitudes CORS. |
| `IP_BACKEND` | Marcador de `proxy_pass` en el *user data* del frontend | IP privada de la EC2 backend a la que Nginx redirige las solicitudes de la API. |

## Comandos para Instalación en Amazon Linux

Configura los siguientes bloques como *user data*. Amazon Linux los ejecuta una vez, durante el primer arranque de cada instancia. Reemplaza los marcadores disponibles antes de crear la instancia; `IP_FRONTEND` puede actualizarse despues mediante SSM.

### Backend

```bash
set -euo pipefail
useradd --system --home /opt/servicedesk --shell /sbin/nologin servicedesk || true
install -d -o servicedesk -g servicedesk -m 0750 /opt/servicedesk/uploads
install -o servicedesk -g servicedesk -m 0755 /tmp/servicedesk /opt/servicedesk/servicedesk
jwt_secret=$(openssl rand -hex 32)
printf '%s\n' 'DATABASE_URL=host=<ENDPOINT_RDS> user=<RDS_USER> password=<RDS_PASSWORD> dbname=<RDS_DATABASE> port=5432 sslmode=require' "JWT_SECRET=$jwt_secret" 'PORT=8080' 'FRONTEND_ORIGIN=http://<IP_FRONTEND>' > /opt/servicedesk/.env
chown servicedesk:servicedesk /opt/servicedesk/.env
chmod 0600 /opt/servicedesk/.env
cat > /etc/systemd/system/servicedesk.service <<'EOF'
[Unit]
Description=ServiceDesk API
After=network-online.target

[Service]
User=servicedesk
Group=servicedesk
WorkingDirectory=/opt/servicedesk
EnvironmentFile=/opt/servicedesk/.env
ExecStart=/opt/servicedesk/servicedesk
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/servicedesk/uploads

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now servicedesk
```

- `set -euo pipefail` detiene el aprovisionamiento ante errores, variables no definidas o fallos en tuberias.
- `useradd` y `install -d` crean una cuenta sin inicio de sesion y un directorio de adjuntos con permisos restringidos; la API no se ejecuta como `root`.
- `openssl rand`, `printf`, `chown` y `chmod` crean el archivo de configuracion con un JWT unico y restringen su lectura al usuario del servicio. La conexion a RDS usa TLS con `sslmode=require`.
- Antes de `systemctl`, el user data escribe `/etc/systemd/system/servicedesk.service`. Esa unidad carga `/opt/servicedesk/.env`, ejecuta la API como `servicedesk` y solo habilita escritura en `uploads/`.
- `systemctl daemon-reload` registra la unidad y `enable --now` la habilita para futuros reinicios y la inicia de inmediato.
- El bucle con `curl` espera el health check de la API. El archivo `servicedesk-backend-ready` marca que el arranque inicial finalizo.

### Frontend

```bash
set -euo pipefail
dnf install -y nginx
install -d -m 0755 /var/www/servicedesk
tar -xzf /tmp/web.tar.gz -C /var/www/servicedesk
rm -f /etc/nginx/conf.d/*.conf
cat > /etc/nginx/conf.d/servicedesk.conf <<'EOF'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/servicedesk;
    index index.html;
    client_max_body_size 12m;

    location /api/ {
        proxy_pass http://<IP_BACKEND>:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location = /health { proxy_pass http://<IP_BACKEND>:8080; }
    location /docs { proxy_pass http://<IP_BACKEND>:8080; }
    location / { try_files $uri $uri/ /index.html; }
}
EOF
nginx -t
systemctl enable --now nginx
touch /var/lib/servicedesk-frontend-ready
```

- `dnf install -y nginx` instala el servidor web sin requerir intervencion durante el arranque.
- `install -d` y `tar` crean el directorio publico y publican el build estatico descargado.
- Antes de `nginx -t`, el user data escribe `/etc/nginx/conf.d/servicedesk.conf`. La configuracion sirve los estaticos, devuelve `index.html` para las rutas de React y dirige `/api/`, `/health` y `/docs` al backend privado en el puerto `8080`.
- `rm -f /etc/nginx/conf.d/*.conf` evita que una configuracion de ejemplo u otra configuracion de Nginx compita con el virtual host de ServiceDesk.
- `nginx -t` valida la sintaxis antes de iniciar el servicio; `enable --now` lo inicia y lo deja habilitado luego de reinicios.
- El archivo `servicedesk-frontend-ready` marca que los estaticos y Nginx ya fueron configurados.

## Comandos para HealthCheck

Con estos comandos una vez finalizados los *user data* para ver que las conexiones entre front y back estan siendo respondidas correctamente.

### Backend

```bash
while [ ! -f /var/lib/servicedesk-backend-ready ]; do sleep 2; done
sudo systemctl restart servicedesk
for attempt in $(seq 1 30); do curl --fail --silent http://127.0.0.1:8080/health && exit 0; sleep 2; done; exit 1
```

### Frontend

```bash
while [ ! -f /var/lib/servicedesk-frontend-ready ]; do sleep 2; done
curl --fail --silent http://127.0.0.1/health
```

La comprobacion verifica la cadena Nginx -> backend, no solo que Nginx este escuchando en el puerto 80.
