# Cómo trabajar FARO con Claude Code

## 0. Instalar (una vez por equipo)
En una terminal de Cursor (PowerShell):
```
npm install -g @anthropic-ai/claude-code
claude          # la primera vez pide iniciar sesión con tu cuenta
```
Requiere Node 18+ (tienes 22 por SIAP) y Git for Windows.

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

## 2. Sesión de análisis (Fase 0)
```
cd D:\FARO
claude --add-dir D:\SIAP --model opus
```
Pulsa **Shift+Tab** hasta ver "plan mode". Primer mensaje sugerido:

> Vamos a iniciar FARO. Lee @CLAUDE.md, @docs/decisiones.md, @docs/base-desde-siap.md y
> @docs/tasks.md. SIAP está en D:\SIAP solo como referencia. Empecemos con la tarea A1:
> hazme las preguntas que necesites para escribir docs/spec.md. Te explico qué es FARO: ...

Haz A1 → A5 en esta sesión o en varias. Entre tareas: `/clear`. Si la sesión se alarga:
`/compact`. Para A4, pídele: "usa subagentes para revisar las dependencias de auth y usuario
en SIAP", así la exploración no llena tu contexto.

## 3. Sesiones de implementación (Fase 1 en adelante)
```
cd D:\FARO
claude --add-dir D:\SIAP          # Sonnet por defecto; /model para cambiar
```
Mensaje tipo:

> Implementa la tarea B3 de @docs/tasks.md. Basa el código en D:\SIAP según
> @docs/base-desde-siap.md. Primero muéstrame el plan, luego implementa, corre tests y lint.

Al terminar: revisa el diff en Cursor → `git commit` → `/clear` → siguiente tarea.

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
| Shift+Tab | Alternar plan mode / auto-aceptar ediciones |
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
