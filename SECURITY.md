# Seguridad

No publique vulnerabilidades en incidencias públicas. Informe de forma privada al responsable del repositorio.

Medidas mínimas de operación:

- HTTPS obligatorio fuera de localhost.
- `JWT_SECRET` exclusivo y aleatorio.
- Contraseña de administrador robusta.
- Acceso restringido por red o proxy.
- Copias de seguridad verificadas.
- Revisión periódica con `npm audit`.

La aplicación es de un solo administrador. Para equipos con distintos permisos debe añadirse control de roles antes de su uso compartido.
