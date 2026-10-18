# Cómo trabajar FARO con Claude Code

## 0. Instalar (una vez por equipo)
Instalador nativo (recomendado por la documentación de Claude Code: se actualiza solo en segundo
plano y no depende de la carpeta global de npm). En PowerShell:
```
irm https://claude.ai/install.ps1 | iex
```
Abre una terminal **nueva** (en Cursor también) y comprueba:
```
claude --version
where.exe claude   # debe salir solo %USERPROFILE%\.local\bin\claude.exe
claude doctor      # salud de la instalación y resultado de la última actualización
claude             # la primera vez pide iniciar sesión con tu cuenta
```
Si antes estaba instalado con npm, quítalo primero (`npm uninstall -g @anthropic-ai/claude-code`)
para no tener dos instalaciones. Git for Windows es recomendable (Claude Code usa Git Bash; sin él
usa PowerShell). Node 22 sigue haciendo falta para FARO y SIAP, no para Claude Code.
Si aparece "Auto-update failed", cierra las sesiones y corre `claude doctor`.

## 1. Inicializar el repo (una vez)
```
cd D:\FARO
git init
git add . ; git commit -m "chore: docs iniciales"
```
Crea el repo remoto (GitHub/GitLab) y haz `git push`. **Esto es lo que permite cambiar de
equipo**: todo lo que vive en el repo (CLAUDE.md, docs/, .claude/settings.json,
.claude/commands/) viaja con `git clone`. Lo que NO viaja: el historial de conversaciones
(`claude --resume` solo ve las del equipo local) y tu config personal en `~/.claude/`.
Por eso las decisiones se escriben en `docs/`, no se dejan en el chat.

## 2. El ciclo de cada tarea (revisión con Claude en el chat)

Claude Code no deja el plan ni las preguntas en su chat: los escribe en
`docs/revisiones/<ID>.md` (reglas en `CLAUDE.md`, plantilla en `docs/revisiones/_plantilla.md`).
Así el plan se revisa en otra conversación, viaja con git y queda como historial.

| Paso | Dónde | Qué pasa |
|---|---|---|
| 1. Planificar | Claude Code | Escribe `docs/revisiones/<ID>.md` con plan y preguntas, y se detiene |
| 2. Revisar | Chat de Claude | "Claude Code terminó, revisemos": se lee el archivo, se analiza y se escribe `## Respuestas` en el mismo archivo |
| 3. Aplicar | Claude Code | "Aplica @docs/revisiones/<ID>.md": implementa; si surgen dudas, las escribe y vuelve al paso 2 |
| 4. Cerrar | Claude Code + tú | Completa `## Resultado`; revisas el diff en Cursor → `git commit` → `/clear` |

**No uses plan mode**: en plan mode Claude Code no puede escribir archivos, así que el plan se
quedaría en el chat. El archivo de revisión cumple esa función. Deja el modo normal, en el que
Claude Code pide permiso antes de cada edición.

## 3. Mensajes tipo

Sesión de análisis (Fase 0):
```
cd D:\FARO
claude --add-dir D:\SIAP --model opus
```
> Tarea A3 de @docs/tasks.md. Sigue el flujo de revisión de @CLAUDE.md: investiga lo que
> necesites en D:\SIAP y escribe docs/revisiones/A3.md con tu plan y tus preguntas. No
> escribas nada más hasta que te lo pida.

Sesión de implementación (Fase 1 en adelante; Sonnet por defecto, `/model` para cambiar):
```
cd D:\FARO
claude --add-dir D:\SIAP
```
> Tarea B3 de @docs/tasks.md. Sigue el flujo de revisión de @CLAUDE.md. Basa el código en
> D:\SIAP según @docs/base-desde-siap.md.

Después de la revisión:
> Aplica @docs/revisiones/B3.md. Corre tests y lint al terminar.

Entre tareas: `/clear`. Si la sesión se alarga: `/compact`. Para explorar mucho código de
SIAP, pídele que use subagentes, así la exploración no llena su contexto.

## 4. Backend y frontend en paralelo (cuando haya contrato de API)
Dos terminales en Cursor:
```
git worktree add ..\FARO-front -b feat/frontend
# terminal 1: cd D:\FARO       ; claude   (backend)
# terminal 2: cd D:\FARO-front ; claude   (frontend)
```

## 5. Comandos que más usarás
| Comando | Para qué |
|---|---|
| Shift+Tab | Cambiar de modo (normal / auto-aceptar ediciones / plan mode; en FARO se usa el normal) |
| `/clear` | Contexto limpio entre tareas (lo que más ahorra tokens) |
| `/compact` | Resumir una sesión larga sin perder el hilo |
| `/model` | Opus para diseño o bugs difíciles, Sonnet para implementar |
| `@archivo` | Referenciar archivos en vez de pegar código |
| `/init` | Generar el `CLAUDE.md` de cada subcarpeta cuando ya exista código |
| `claude --resume` | Retomar una sesión anterior (mismo equipo) |
| Esc / Esc Esc | Interrumpir / volver a un mensaje anterior |

## 6. Rol de Cursor
Editor: revisar diffs, cambios pequeños, navegar el código. Desactiva o ignora el agente de
Cursor para no tener dos IAs editando a la vez.

## 7. Retomar en una sesión nueva

### Estado al cierre del 2026-10-18
- **Hecho**: Fase 0 (A1–A6) y backend de la Fase 1 (B1, B2, B2b, B3–B7), cada una con su
  `docs/revisiones/<ID>.md` cerrado. Decisiones hasta la **105**. Backend en Nest 11.2.7
  (decisión 79); `npm audit --omit=dev` en 2 moderadas aceptadas (`js-yaml` de Swagger, decisión
  70). Al cierre de B7: 339 unit y 163 e2e en verde.
- **Sigue**: frontend de la Fase 1, **F1 a F6** (Sonnet), contra el contrato que ya está en Swagger
  (`/api/docs`) y en `architecture.md` §11. Después, Fase 2 en el orden de `tasks.md` (D1, D2,
  V1, …).
- Para F1: el frontend es otra app (`faro-frontend/`), con su propio `CLAUDE.md` (decisión 73),
  `npm audit --omit=dev` propio y la misma regla de comprobar que las pruebas cargan un paquete
  antes de instalarlo (ESM, decisiones 86 y 94).

### Mensaje inicial para el chat de revisión (claude.ai)
> Soy el revisor del proyecto FARO (D:\FARO), mi tesis: un SaaS de rentabilidad para pequeños
> negocios en Bolivia (NestJS + Angular). Trabajo con Claude Code en Cursor con un flujo de
> revisión: Claude Code escribe el plan y sus preguntas en `docs/revisiones/<ID>.md` y se detiene;
> tú lo revisas conmigo y escribes las respuestas en la sección "Respuestas" de ese archivo; luego
> Claude Code aplica. Las reglas están en `CLAUDE.md` y `docs/GUIA-SESIONES.md` (lee la sección 7).
> Antes de nada, lee en D:\FARO: `CLAUDE.md`, `faro-backend/CLAUDE.md`, `docs/tasks.md`,
> `docs/decisiones.md` (las últimas 20 filas), `docs/pendientes-siap.md` y la última revisión
> cerrada. SIAP (D:\SIAP) y CONTROLADOR (D:\CONTROLADOR) son solo referencia de lectura.
> Cuando diga "Claude Code terminó, revisemos", lee la revisión más reciente, verifica en el
> código lo crítico y escribe las respuestas. Al guardar en mi computadora usa cada vez una
> ubicación nueva y verifica el contenido en el disco. Nunca escribas credenciales en archivos
> que se commitean; los `.env.*` reales los edito yo. Cita referencias profesionales (ERP, POS,
> normas contables, OWASP) en las decisiones. Siguiente tarea: <ID>.

### Lo aprendido en la Fase 1 (para el revisor y para Claude Code)
- **Guardar desde el chat de revisión**: escribir el archivo completo una sola vez en una carpeta
  nueva y comparar byte a byte después de guardar. Un guardado llegó con la versión vieja.
- **El archivo de revisión** solo se edita en la sección propia (paso 5 del flujo de `CLAUDE.md`):
  en B2b, reemplazar "desde `## Resultado` hasta el final" borró las Respuestas.
- **Paquetes solo ESM**: Jest 29 no los carga (`@nestjs/jwt` 12, `otplib` completo). Comprobar el
  `exports` de un paquete y de sus dependencias antes de instalarlo.
- **TypeORM no deja redeclarar una columna heredada** (decisión 81): por eso hay tres bases de
  entidad.
- **Las dudas que cambian el diseño se detienen** en "Preguntas nuevas" (como B3 con las bases):
  mejor que aflojar una restricción para que pase un test.

### Pendientes a mano (fuera de Claude Code)
- [ ] Un commit por tarea (B2b … B7), con el mensaje del final de cada revisión; revisar antes con
      `git status` que no entre ningún `.env.*` real.
- [ ] Puerto 3000 ocupado por un proceso que no es tuyo: `Get-Process -Id <PID>` (Claude Code vio
      28532) y cerrarlo si es un `node.exe` huérfano.
- [ ] `ADMIN_CLAVE` válida en `.env.development` (8 caracteres o más) y `npm run seed:admin`;
      luego enrolar la 2FA del admin enseguida (pendiente de despliegue en `architecture.md` §2).
- [ ] `claude doctor` y `where.exe claude` con el instalador nativo (sección 0).
- [ ] Respaldar fuera del repo `JWT_SECRET` y `TOTP_CLAVE_CIFRADO` de `.env.development`
      (perder la segunda deja ilegibles los secretos TOTP).
