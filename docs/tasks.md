# Tareas

Formato: `- [ ] ID · descripción · criterio de "listo"`. Una tarea = una sesión = un commit.

## Fase 0: Análisis (sesión con Opus, plan mode, sin código)
- [ ] A1 · Escribir `docs/spec.md` (qué es FARO, usuarios, módulos) · aprobado por mí
- [ ] A2 · Cerrar decisiones 3, 4 y 5 de `docs/decisiones.md` · tabla actualizada
- [ ] A3 · Escribir `docs/architecture.md` (versiones, carpetas, convenciones de naming,
        manejo de errores, auth) · aprobado por mí
- [ ] A4 · Revisar `docs/base-desde-siap.md` leyendo el código real de SIAP y corregir el
        inventario (dependencias ocultas) · lista final
- [ ] A5 · Desglosar Fase 1 y Fase 2 en tareas pequeñas en este archivo

## Fase 1: Esqueleto (Sonnet)
- [ ] B1 · Crear `faro-backend` con Nest CLI + config, lint, prettier, `.env.example` · `npm run start:dev` levanta y `/api/docs` muestra Swagger
- [ ] B2 · Portar `common/` desde SIAP · tests de utils en verde
- [ ] B3 · Usuario + auth JWT + migración + seed admin · login responde token; test e2e de login
- [ ] B4 · Permisos (módulos, opciones, roles) · endpoint de menú por rol
- [ ] F1 · Crear `faro-frontend` con Angular CLI + Material + lint · `npm start` levanta
- [ ] F2 · Portar `core/` (interceptors, guards, auth/session services) · build sin errores
- [ ] F3 · Layout + login + acceso denegado · login real contra B3 funciona
- [ ] F4 · Pantallas de usuario y permisos · CRUD funcional
- [ ] F5 · Portar `shared/` necesario (combobox, pipes, utils) · tests en verde

## Fase 2: Dominio de FARO
(se llena en A5)
