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
