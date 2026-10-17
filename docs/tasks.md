# Tareas

Formato: `- [ ] ID · descripción · criterio de "listo"`. Una tarea = una sesión = un commit.
Niveles de `spec.md`: P = versión preliminar, P+ = deseable en la preliminar, C = versión completa.

## Fase 0: Análisis (Opus, flujo de revisión, sin código)
- [x] A1 · Escribir `docs/spec.md` (qué es FARO, usuarios, módulos) · aprobado por mí
- [x] A2 · Cerrar decisiones 3, 4 y 5 de `docs/decisiones.md` · tabla actualizada
- [x] A3 · Escribir `docs/architecture.md` (versiones, carpetas, convenciones de naming,
        manejo de errores, auth, **módulo contable**: entidades `cuenta`, `asiento`,
        `asiento_detalle` con `producto_id` auxiliar, servicio que genera el asiento dentro
        de la misma transacción que el documento, historial de régimen) · aprobado por mí
- [ ] A4 · Revisar `docs/base-desde-siap.md` leyendo el código real de SIAP y corregir el
        inventario (dependencias ocultas) · lista final
- [ ] A5 · Desglosar Fase 1 y Fase 2 en tareas pequeñas en este archivo. Resolver antes, en
        `docs/revisiones/A5.md`:
        (1) orden de fechas del inventario: documentos que mueven stock con fecha no anterior
        al último movimiento de la sucursal (como `validarOrdenFechaLote` de SIAP para lotes)
        y fecha del movimiento y del asiento de una anulación;
        (2) costo persistido al registrar (lo exige el asiento inmutable) frente al cálculo
        FIFO al vuelo de SIAP (`ejecucion-proyecto/utils/fifo.util.ts`): qué se porta;
        (3) datos para la defensa: `fecha_inicio` del negocio en el pasado, seed de
        demostración que registra meses pasados en orden por los servicios reales y cierra
        cada mes, y reloj inyectable para los tests
- [x] A6 · Aprobar el mockup de dashboard y POS (identidad visual, decisión 23) · aprobado
        2026-10-17 (canvas "FARO · Dashboard y POS"); paleta y tipografía fijadas en A3

## Fase 1: Esqueleto (Sonnet)
- [ ] B1 · Crear `faro-backend` con Nest CLI + config, lint, prettier, `.env.example` · `npm run start:dev` levanta y `/api/docs` muestra Swagger
- [ ] B2 · Portar `common/` desde SIAP · tests de utils en verde
- [ ] B3 · Usuario + auth JWT (sin rol operativo) + migración + seed admin · login responde token; test e2e de login
- [ ] B4 · Permisos (módulos, opciones, roles) · endpoint de menú por rol
- [ ] F1 · Crear `faro-frontend` con Angular CLI + Material (tema M3 de FARO) + Tailwind + lint · `npm start` levanta
- [ ] F2 · Portar `core/` (interceptors, guards, auth/session services) · build sin errores
- [ ] F3 · Layout + login + acceso denegado, con la identidad del mockup · login real contra B3 funciona
- [ ] F4 · Pantallas de usuario y permisos · CRUD funcional
- [ ] F5 · Portar `shared/` necesario (combobox, pipes, utils) · tests en verde

## Fase 2: Dominio de FARO
(se llena en A5; orden sugerido: negocio + régimen + plan de cuentas semilla → catálogo →
inventario inicial y compras con asiento → POS y ventas con asiento → gastos → libro diario y
mayor → cierre mensual con control de cuadre → estado de resultados, ranking y dashboard)
