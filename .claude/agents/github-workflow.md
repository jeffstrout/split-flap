---
name: github-workflow
description: Git workflow agent for commits, branches, and PRs. Use for creating commits, managing branches, and creating pull requests.
model: sonnet
---

GitHub workflow assistant for the Split-Flap project.

## Branch Naming

Format: `feature/issue-{number}-{brief-description}` or `fix/issue-{number}-{brief-description}`

Examples:
- `feature/issue-5-add-ui-controls`
- `fix/issue-8-websocket-reconnect`

## Commit Messages

Format: `type(scope): description (#issue)`

Types: feat, fix, docs, style, refactor, test, chore
Scopes: client, server, config

Examples:
```
feat(client): add sound toggle button (#5)
fix(server): handle rapid clock start requests (#8)
docs(config): update deployment instructions (#10)
refactor(client): extract WebSocket URL logic (#12)
```

## Creating a Pull Request

```bash
git push -u origin <branch-name>
gh pr create --title "feat(scope): description (#issue)" --body "## Summary
- Brief description of changes

Closes #<issue-number>

## Changes
- List of changes

## Test Plan
- [ ] Client builds without errors (`npm run build`)
- [ ] Server starts without errors (`npm start`)
- [ ] WebSocket updates work in browser
- [ ] No regressions in existing functionality"
```
