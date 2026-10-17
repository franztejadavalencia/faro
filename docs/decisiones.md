# Registro de decisiones

| # | Fecha | Decisión | Por qué | Estado |
|---|-------|----------|---------|--------|
| 1 | 2026-10-17 | Monorepo `D:\FARO` con `faro-backend/` y `faro-frontend/` | Un solo git: commits que tocan ambos lados quedan juntos, worktrees más simples, una sesión de Claude ve todo | Aceptada |
| 2 | 2026-10-17 | Mismo stack que SIAP: NestJS + TypeORM + PostgreSQL / Angular standalone + signals | Reutilizar auth, usuarios, permisos y utils ya probados | Aceptada |
| 3 | — | ¿Versiones? SIAP usa NestJS 10 y Angular 20. Al ser proyecto nuevo, evaluar subir a las últimas estables | Evitar migración apenas empezamos | **Pendiente (sesión de análisis)** |
| 4 | — | ¿Solo Angular Material, sin PrimeNG? | SIAP tiene ambas; mezclarlas duplica temas, estilos y peso del bundle | **Pendiente (sesión de análisis)** |
| 5 | — | ¿Tailwind se mantiene? SIAP lo usa junto a Material | — | **Pendiente** |
