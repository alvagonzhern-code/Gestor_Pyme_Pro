# Gestor Pyme Pro

Aplicación web interna para pymes de servicios que centraliza clientes, presupuestos, facturas y documentación. Está pensada para consultorías, asesorías, empresas de formación y profesionales que necesitan reducir trabajo administrativo sin depender de una plataforma externa.

## Funciones incluidas

- Inicio de sesión con sesión JWT y cambio de contraseña.
- Ficha completa de clientes y búsqueda rápida.
- Presupuestos con líneas, cantidades, precios, IVA, estados y PDF.
- Conversión controlada de presupuesto a factura, sin duplicados.
- Facturas con vencimiento, estados, control de cobro y PDF.
- Detección automática de facturas vencidas.
- Repositorio documental asociado opcionalmente a clientes.
- Panel con actividad comercial, deuda pendiente, vencidos e ingresos cobrados.
- Numeración correlativa anual configurable, por ejemplo `PRE-2026-0001`.
- Persistencia local en SQLite, copias de seguridad sencillas y sin base de datos externa.
- Interfaz adaptable a escritorio, tableta y móvil.
- Docker, pruebas automatizadas y CI para GitHub Actions.

## Arquitectura

```text
apps/
├── api/     Node.js + Express + SQLite + PDFKit
└── web/     React + TypeScript + Vite

data/
├── gestor-pyme.db
└── uploads/
```

La aplicación está diseñada para una sola empresa y un usuario administrador. No es una solución multiempresa ni multiusuario con permisos granulares.

## Requisitos

- Node.js 22.12 o superior.
- npm 10 o superior.

## Puesta en marcha local

```bash
cp .env.example .env
npm ci
npm run dev
```

Abra `http://localhost:5173`. Las credenciales iniciales proceden de `.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=cambia-esta-clave
```

Cambie la contraseña al entrar en **Configuración → Seguridad**. El valor `ADMIN_PASSWORD` solo se utiliza para crear el primer usuario cuando la base de datos está vacía.

## Compilación y ejecución en producción

```bash
npm run build
NODE_ENV=production npm start
```

La API sirve también el frontend compilado en `http://localhost:4000`.

## Despliegue con Docker

Cree un archivo `.env` junto a `docker-compose.yml`:

```env
JWT_SECRET=una-clave-larga-aleatoria-y-privada
ADMIN_USERNAME=admin
ADMIN_PASSWORD=una-contraseña-inicial-segura
```

Después:

```bash
docker compose up -d --build
```

La aplicación quedará en `http://localhost:4000`. Los datos se guardan en el volumen `gestor_pyme_data`.

## Comandos

| Comando          | Uso                                              |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | API y frontend en desarrollo                     |
| `npm run build`  | Compila ambos proyectos                          |
| `npm test`       | Ejecuta pruebas de API y smoke test del frontend |
| `npm run check`  | Compila y prueba todo                            |
| `npm start`      | Arranca la compilación de producción             |
| `npm run format` | Formatea el repositorio                          |

## Seguridad y operación

Antes de exponer la aplicación en Internet:

1. Use un `JWT_SECRET` aleatorio y largo.
2. Cambie la contraseña inicial.
3. Publique únicamente detrás de HTTPS mediante un proxy inverso.
4. Restrinja el acceso por VPN, red privada o control de acceso del proxy.
5. Programe copias de `data/gestor-pyme.db` y `data/uploads/`.
6. Mantenga Node y las dependencias actualizados.

Los cálculos se realizan de nuevo en el servidor; el navegador no decide los totales. Las cargas están limitadas por tamaño y tipo de archivo. La aplicación no realiza presentación automática de facturas ante organismos públicos ni sustituye el asesoramiento fiscal o legal.

## Copia de seguridad

Con el proceso detenido, copie:

```text
data/gestor-pyme.db
data/uploads/
```

En Docker:

```bash
docker compose stop
docker run --rm -v gestor_pyme_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/gestor-pyme-backup.tar.gz -C /data .
docker compose start
```

## API

La documentación de rutas está en [`docs/API.md`](docs/API.md). Las instrucciones ampliadas de despliegue están en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Calidad verificada

El repositorio incluye pruebas que comprueban autenticación, autorización, alta de clientes, cálculo fiscal, generación PDF, conversión a factura, cobro y métricas. GitHub Actions ejecuta auditoría, compilación y pruebas en cada cambio.

## Licencia

MIT. Consulte [`LICENSE`](LICENSE).
