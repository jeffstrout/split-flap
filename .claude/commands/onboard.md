---
description: Deep exploration of a task before starting implementation
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(find:*), Bash(cat:*), Bash(head:*)
---

# Onboard

You are given the following context:
$ARGUMENTS

## Instructions

Your job is to **onboard** yourself to the current task.

Do this by:
- Reading CLAUDE.md for full project context
- Exploring the codebase areas related to the task
- Understanding the client/server architecture and WebSocket communication
- Reviewing the API endpoints involved (see `server/src/routes/messages.js`)
- Checking the React components that would be affected
- Understanding the flip animation system (`FlipChar.jsx`, `FlipBoard.jsx`)
- Asking questions if needed

Key directories:
- `client/src/components/` — React components (FlipBoard, FlipChar, FlipRow)
- `client/src/hooks/` — WebSocket hook
- `client/src/styles/` — CSS animations and theming
- `server/src/routes/` — API endpoints, clock logic, sound/theme control
- `server/src/index.js` — Express server, WebSocket setup, CORS

The goal is to get fully prepared to start working on the task.

Take as long as you need. Overdoing it is better than underdoing it.

Record everything in a `.claude/tasks/[TASK_ID]/onboarding.md` file.
