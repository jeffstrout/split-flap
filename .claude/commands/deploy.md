---
description: Deploy the current main branch to DigitalOcean production
allowed-tools: Bash(git:*), Bash(doctl:*), Bash(curl:*), Read
---

# Deploy to Production

Deploy the Split-Flap application to DigitalOcean App Platform.

## Instructions

### 1. Pre-flight Checks

Before deploying, verify everything is in order:

```bash
# Ensure we're on main and up to date
git checkout main
git pull origin main

# Show what's changed since the last deploy tag (if any)
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD
```

### 2. Show What Will Be Deployed

Display a summary of changes that will go to production:
- List recent commits on main (since last deploy)
- Check for any pending PRs that haven't been merged yet
- Verify the client builds: `cd client && npm run build`
- Verify the server starts: `cd server && npm start` (quick smoke test)

### 3. Confirm with User

Before triggering the deploy, show the summary and ask:
> "Ready to deploy these changes to production?"

Wait for explicit confirmation.

### 4. Trigger Deployment

```bash
doctl apps create-deployment <app-id>
```

Note: The app ID will be available after the first deployment is configured on DigitalOcean.

### 5. Monitor

After triggering:
- Show the deployment URL for monitoring
- Note that deploys typically take 3-5 minutes
- Suggest checking the production URL after deployment completes

### 6. Verify

```bash
curl -s https://<app-url>/api/status
```

If status check fails, alert the user immediately.
