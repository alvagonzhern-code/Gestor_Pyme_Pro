# Despliegue

## Opción recomendada: Docker y proxy HTTPS

1. Configure las variables privadas en `.env`.
2. Ejecute `docker compose up -d --build`.
3. Publique el puerto 4000 detrás de Caddy, Nginx, Traefik o un túnel privado.
4. Monte y supervise el volumen de datos.

Ejemplo de proxy Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name gestion.example.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## Variables

| Variable         | Descripción                                 |
| ---------------- | ------------------------------------------- |
| `PORT`           | Puerto de la API                            |
| `WEB_ORIGIN`     | Orígenes web permitidos, separados por coma |
| `JWT_SECRET`     | Firma de sesiones; debe ser privada         |
| `ADMIN_USERNAME` | Usuario creado en una base vacía            |
| `ADMIN_PASSWORD` | Contraseña inicial creada en una base vacía |
| `DATABASE_PATH`  | Ruta del archivo SQLite                     |
| `UPLOADS_PATH`   | Directorio de documentos                    |
| `MAX_UPLOAD_MB`  | Tamaño máximo por archivo                   |

## Actualización

```bash
git pull
npm ci
npm run check
npm run build
# reinicie el proceso de Node
```

Con Docker:

```bash
git pull
docker compose up -d --build
```

Haga una copia de seguridad antes de cada actualización importante.
