---
description: Review a pull request using Split-Flap project standards
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(gh:*)
---

# PR Review

Review the pull request: $ARGUMENTS

## Instructions

1. **Get PR information**:
   - Run `gh pr view $ARGUMENTS` to get PR details
   - Run `gh pr diff $ARGUMENTS` to see changes

2. **Read review standards**:
   - Read `.claude/agents/code-reviewer.md` for the review checklist

3. **Apply the checklist** to all changed files:
   - Server: proper error handling, no hardcoded config, WebSocket broadcast logic
   - Client: React patterns, animation consistency, CSS theming
   - General: consistent board dimensions, no secrets in code

4. **Provide structured feedback**:
   - **Critical**: Must fix before merge (security, breaking changes, WebSocket issues)
   - **Warning**: Should fix (conventions, performance)
   - **Suggestion**: Nice to have (style, optimization)

5. **Post review** using `gh pr review` or `gh pr comment`
