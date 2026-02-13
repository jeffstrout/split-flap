# Autonomous Claude Code Workflow — Split-Flap Project Briefing

> **Purpose**: This document is a briefing packet for Claude Code. It contains everything needed to understand and work autonomously in the Split-Flap project.

---

## Context

The Split-Flap project is a retro split-flap display web application with real-time WebSocket updates. It's hosted at `https://github.com/jeffstrout/split-flap` (private repo), deployed on DigitalOcean App Platform with manual deploys.

**Stack**: React + Vite (client) → WebSocket → Node.js + Express (server)

**Goal**: Enable autonomous development where:
1. Jeff describes work in GitHub Issues
2. Claude Code picks up `ai-ready` issues, implements on feature branches, opens PRs
3. Claude Code asks questions by commenting on issues when blocked
4. Automated PR reviews catch problems before merge

---

## Project Architecture

```
Client (React + Vite, port 3000)
  ├── App.jsx — state from WebSocket (lines, sound, theme)
  ├── FlipBoard.jsx — audio synthesis
  ├── FlipRow.jsx — maps text to character cells
  ├── FlipChar.jsx — flip animation (CSS 3D transforms)
  ├── useWebSocket.js — auto-reconnecting WebSocket hook
  └── flip.css — styling, animations, theme support

Server (Node.js + Express + WebSocket, port 3001)
  ├── index.js — HTTP server, WebSocket, CORS, state
  └── routes/messages.js — API endpoints, clock, sound, theme
```

## Key Conventions

- **Board dimensions**: 24 columns × 8 rows, defined in 4 files (must stay in sync)
- **State is in-memory**: server restart resets everything
- **All state changes broadcast via WebSocket** to all connected clients
- **Two themes**: dark (default) and light, controlled via CSS class
- **Sound**: procedurally generated via Web Audio API
- **Branch protection**: edits blocked on `main` — always use feature branches

## Deployment

- DigitalOcean App Platform (`.do/app.yaml`)
- Manual deploys only (`deploy_on_push: false`)
- Backend at `/api`, frontend static site at `/`
- WebSocket connects to `wss://<host>/api` in production

## Claude Code Infrastructure

| Component | Location |
|-----------|----------|
| Settings + hooks | `.claude/settings.json` |
| Slash commands | `.claude/commands/` (deploy, onboard, ticket, pr-review) |
| Agents | `.claude/agents/` (code-reviewer, github-workflow) |
| Skills | `.claude/skills/` (express-websocket-server, react-flipboard-client) |
| PR review workflow | `.github/workflows/pr-claude-code-review.yml` |
| Issue template | `.github/ISSUE_TEMPLATE/ai-task.yml` |

## Environment Variables

```bash
# Local: for MCP GitHub integration
export GITHUB_TOKEN="ghp_your_token_here"

# GitHub Actions: add as repository secret
# Settings → Secrets and variables → Actions → New repository secret
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

## How to Use

Open Claude Code in the Split-Flap project directory:

```bash
# Work on a GitHub Issue
/ticket 5

# Review a PR
/pr-review 3

# Explore before starting work
/onboard "add UI controls for sound/theme"

# Deploy to production
/deploy
```
