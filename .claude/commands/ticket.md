---
description: Work on a GitHub Issue end-to-end (read issue, implement, create PR)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(curl:*), mcp__github__*
---

# Ticket Workflow

Work on ticket: $ARGUMENTS

## Instructions

### 1. Read the Issue

Fetch and understand the GitHub Issue:

```
Use gh CLI or GitHub MCP tools to:
- Get issue details (title, description, acceptance criteria)
- Check linked issues or milestones
- Review any comments
```

Summarize:
- What needs to be done
- Acceptance criteria
- Any blockers or dependencies
- Which part of the stack is affected (client/server/both)

### 2. Explore the Codebase

Before coding:
- Read CLAUDE.md for project context
- Search for related code in the affected area
- Understand the current implementation
- Identify files that need changes

Key directories:
- `client/src/components/` — React components (FlipBoard, FlipChar, FlipRow)
- `client/src/hooks/` — WebSocket hook
- `client/src/styles/` — CSS animations and theming
- `server/src/routes/` — API endpoints, clock logic, sound/theme control
- `server/src/index.js` — Express server, WebSocket setup, CORS

### 3. Create a Branch

```bash
git checkout -b feature/issue-{number}-{brief-description}
```

### 4. Implement the Changes

- Follow existing code patterns (check CLAUDE.md)
- Client: Follow React component patterns in existing components
- Server: Follow Express route patterns in existing routes
- If adding API endpoints, update both server route AND broadcast logic
- Keep board dimensions in sync (ROWS/COLS in App.jsx, messages.js, index.js, flip.css)
- Make incremental commits with descriptive messages

### 5. Verify the Changes

- Client builds: `cd client && npm run build`
- Server starts: `cd server && npm start`
- Test API endpoints manually with curl if applicable
- Test WebSocket updates work in the browser

### 6. If You Have Questions or Blockers

If you cannot proceed:
1. Comment on the GitHub Issue with your specific question
2. Remove the `ai-ready` label
3. Add the `needs-clarification` label
4. Assign the issue back to jeffstrout
5. Stop working on this ticket

### 7. Create PR and Link

When ready:
- Push branch: `git push -u origin feature/issue-{number}-{brief-description}`
- Create PR with `gh pr create`
- Link the PR to the issue: include "Closes #{number}" in PR body
- PR title format: `feat(#{number}): brief description`

### 8. If You Find a Bug

If you discover an unrelated bug while working:
1. Create a new GitHub Issue with details
2. Label it `bug`
3. Note it in the PR description
4. Continue with original task
