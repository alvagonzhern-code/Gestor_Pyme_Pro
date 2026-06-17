# API REST

Base local: `http://localhost:4000/api`

Salvo `/health` y `/auth/login`, todas las rutas requieren:

```http
Authorization: Bearer <token>
```

## Autenticación

- `POST /auth/login`
- `PUT /profile/password`

## Panel

- `GET /dashboard`

## Clientes

- `GET /clients?search=`
- `GET /clients/:id`
- `POST /clients`
- `PUT /clients/:id`
- `DELETE /clients/:id`

## Presupuestos

- `GET /quotes?status=&search=`
- `GET /quotes/:id`
- `GET /quotes/:id/pdf`
- `POST /quotes`
- `PUT /quotes/:id`
- `POST /quotes/:id/convert`
- `DELETE /quotes/:id`

Ejemplo de creación:

```json
{
  "clientId": 1,
  "issueDate": "2026-06-17",
  "expiryDate": "2026-07-17",
  "status": "draft",
  "notes": "Validez de 30 días",
  "items": [
    {
      "description": "Servicio de consultoría",
      "quantity": 10,
      "unitPrice": 85,
      "taxRate": 21
    }
  ]
}
```

## Facturas

- `GET /invoices?status=&search=`
- `GET /invoices/:id`
- `GET /invoices/:id/pdf`
- `POST /invoices`
- `PUT /invoices/:id`
- `PATCH /invoices/:id/status`
- `DELETE /invoices/:id`

Estados: `draft`, `sent`, `paid`, `overdue`, `cancelled`.

## Documentos

- `GET /documents?clientId=`
- `POST /documents` como `multipart/form-data`
- `GET /documents/:id/download`
- `DELETE /documents/:id`

Campos de subida: `file`, `clientId`, `category`, `notes`.

## Configuración

- `GET /settings`
- `PUT /settings`

## Errores

Formato habitual:

```json
{
  "error": "Descripción legible del problema",
  "details": {}
}
```
