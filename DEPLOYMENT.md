# Railway Deployment Guide - HubSpot MCP

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **HubSpot Access Token**: Obtain from [HubSpot Developer Portal](https://developers.hubspot.com/docs/guides/api/overview)
3. **GitHub Repository**: Code is already pushed to https://github.com/MagicTurtle-s/hubspot-mcp-railway

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Authenticate with GitHub if needed
4. Select **MagicTurtle-s/hubspot-mcp-railway**
5. Click **Deploy Now**

### 2. Configure Environment Variables

Railway will start building immediately, but you need to add environment variables:

1. In your Railway project, click **Variables** tab
2. Add the following variables:

| Variable Name | Value | Required? |
|--------------|-------|-----------|
| `HUBSPOT_ACCESS_TOKEN` | Your HubSpot API token | ✅ Yes |
| `PORT` | 3000 | ✅ Yes (or use Railway's default) |
| `TELEMETRY_ENABLED` | true | No (default: true) |

3. Click **Add** for each variable
4. Railway will automatically redeploy with new variables

### 3. Monitor Deployment

1. Click **Deployments** tab to see build progress
2. Watch for these phases:
   - ✅ **Nixpacks Setup**: Installs Node.js 20
   - ✅ **Install**: Runs `npm install`
   - ✅ **Build**: Runs `npm run build` (compiles TypeScript)
   - ✅ **Start**: Runs `npm start`
3. Deployment takes ~3-5 minutes

### 4. Get Your Endpoint URL

Once deployment is successful:

1. Click **Settings** tab
2. Scroll to **Domains** section
3. Railway auto-generates a URL like: `https://your-app-name.up.railway.app`
4. Copy this URL - you'll need it for Claude.ai

**Example URL:**
```
https://hubspot-mcp-production.up.railway.app
```

### 5. Test the Deployment

#### Option A: Health Check (if implemented)
```bash
curl https://your-app-name.up.railway.app/health
```

#### Option B: Check Logs
1. Click **Logs** tab in Railway
2. Look for: `Listening on port 3000` or similar startup message
3. Verify no error messages

### 6. Configure Claude.ai

1. Open [Claude.ai](https://claude.ai) in your browser
2. Click **Search and Tools** (icon in top-right)
3. Click **Add Server** or **Connect MCP Server**
4. Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | HubSpot CRM |
| **URL** | Your Railway URL from Step 4 |
| **Transport** | SSE/HTTP |
| **Authentication** | None (token is in env vars) |

5. Click **Connect** or **Save**
6. Claude.ai will test the connection

### 7. Enable Tools

After connecting successfully:

1. In Claude.ai, go to **Search and Tools** → **HubSpot CRM**
2. You'll see all 116 tools listed
3. Toggle on the tools you want to use

**Recommended starter tools:**
- ✅ crm_list_objects
- ✅ crm_get_object
- ✅ crm_search_objects
- ✅ crm_create_company
- ✅ crm_get_company
- ✅ crm_search_companies
- ✅ crm_create_contact
- ✅ crm_get_contact
- ✅ crm_search_contacts
- ✅ crm_get_associations

### 8. Test Integration

In Claude.ai chat, try these commands:

```
List all companies in HubSpot
```

```
Search for contacts with email containing @example.com
```

```
Get company details for ID 123456789
```

Claude should call the appropriate MCP tools and return HubSpot data.

## Troubleshooting

### Deployment Fails

**Error: "npm install failed"**
- Check Railway logs for specific dependency errors
- Verify package.json is correct
- May need to clear Railway cache and redeploy

**Error: "Build failed"**
- TypeScript compilation error
- Check Railway logs for `tsc` errors
- Fix locally, commit, and push

**Error: "Start failed"**
- Missing environment variables
- Check `HUBSPOT_ACCESS_TOKEN` is set
- Verify `PORT` variable

### Connection Issues from Claude.ai

**Error: "Cannot connect to server"**
- Verify Railway deployment is running (check Deployments tab)
- Ensure URL is correct (no trailing slash)
- Check Railway logs for errors
- Railway may need a few minutes after deployment

**Error: "No tools visible"**
- Server may not be fully started
- Check Railway logs for startup messages
- Try reconnecting in Claude.ai

**Error: "Tool execution fails"**
- Verify `HUBSPOT_ACCESS_TOKEN` is set correctly
- Check HubSpot token has required scopes
- Check Railway logs for HubSpot API errors

### HubSpot API Errors

**401 Unauthorized**
- Token is invalid or expired
- Get new token from HubSpot
- Update `HUBSPOT_ACCESS_TOKEN` in Railway

**403 Forbidden**
- Token lacks required scopes
- Go to HubSpot → Settings → Integrations → Private Apps
- Add missing scopes (see PROJECT.md)
- Generate new token

**429 Rate Limit**
- Exceeded HubSpot API rate limits
- Free tier: 10,000 requests/day
- Wait or upgrade HubSpot plan

## Monitoring and Maintenance

### Railway Dashboard

**Key Tabs:**
- **Deployments**: Build history and logs
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, network usage
- **Settings**: Environment variables, domains

**What to Monitor:**
- Deployment success/failure
- Error logs
- Memory usage (Railway free tier: 512MB, hobby: 1GB)
- Request latency

### Logs to Watch

**Successful Startup:**
```
> @shinzolabs/hubspot-mcp@2.0.5 start
> node ./dist/index.js
Listening on port 3000
```

**HubSpot API Errors:**
```
Error fetching data from HubSpot: Status 401
Error performing request: Unauthorized
```

**Memory Issues:**
```
JavaScript heap out of memory
```
*Solution: Upgrade to Railway hobby plan ($5/month) for 1GB RAM*

### Regular Maintenance

1. **Weekly**: Check Railway logs for errors
2. **Monthly**: Review HubSpot API usage
3. **Quarterly**: Check for upstream updates from shinzo-labs/hubspot-mcp
4. **As Needed**: Rotate HubSpot token per security policy

## Updating the Deployment

### Code Changes

```bash
# Make changes locally
npm run build  # Test build
git add .
git commit -m "Your changes"
git push origin main
```

Railway auto-deploys on push to main branch.

### Environment Variable Changes

1. Go to Railway project → **Variables** tab
2. Edit variable value
3. Click **Save**
4. Railway auto-redeploys

### Upstream Updates

To sync with shinzo-labs/hubspot-mcp:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/shinzo-labs/hubspot-mcp.git

# Fetch upstream changes
git fetch upstream

# Merge (be careful of conflicts with Railway config)
git merge upstream/main

# Test locally
npm install
npm run build
npm start

# Push to trigger Railway deployment
git push origin main
```

## Cost Estimates

### Railway Pricing

| Plan | Cost | Resources | Best For |
|------|------|-----------|----------|
| **Free** | $0 | 512MB RAM, shared CPU, $5 credit | Testing |
| **Hobby** | $5/month | 1GB RAM, dedicated CPU | Personal use |
| **Pro** | $20/month | 8GB RAM, priority support | Team use |

**Recommended:** Hobby plan ($5/month) for reliable personal use

### HubSpot Pricing

| Tier | Cost | API Calls | Best For |
|------|------|-----------|----------|
| **Free** | $0 | 10,000/day | Personal CRM |
| **Professional** | $450/month | 40,000/day | Business |

**Note:** API rate limits are per HubSpot portal, not per MCP server.

## Advanced Configuration

### Custom Domain

1. Railway → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your custom domain
4. Update DNS records as instructed
5. Railway auto-provisions SSL certificate

### Multiple Environments

Create separate Railway projects for:
- **Development**: dev branch, test HubSpot portal
- **Production**: main branch, production HubSpot portal

### Scaling

Railway auto-scales within plan limits. For high-traffic:
1. Upgrade to Pro plan
2. Enable horizontal scaling (multiple replicas)
3. Configure load balancing

### Monitoring Alerts

Set up Railway notifications:
1. Railway → **Settings** → **Notifications**
2. Add webhook URL or email
3. Configure alerts for:
   - Deployment failures
   - High CPU/memory usage
   - Error rate thresholds

## Security Best Practices

1. **Token Management**
   - Never commit `HUBSPOT_ACCESS_TOKEN` to git
   - Rotate token every 90 days
   - Use HubSpot private apps (not personal access tokens)

2. **Access Control**
   - Railway URL is public but requires knowledge of endpoint
   - Consider adding custom authentication for production
   - Restrict HubSpot token scopes to minimum needed

3. **Monitoring**
   - Review Railway logs weekly
   - Set up alerts for suspicious activity
   - Monitor HubSpot API usage for anomalies

## Support Resources

- **Railway Docs**: https://docs.railway.app
- **HubSpot API Docs**: https://developers.hubspot.com/docs/reference/api
- **MCP Docs**: https://modelcontextprotocol.io
- **Upstream Issues**: https://github.com/shinzo-labs/hubspot-mcp/issues
- **This Fork Issues**: https://github.com/MagicTurtle-s/hubspot-mcp-railway/issues

## Quick Reference

### Railway CLI Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run locally with Railway env vars
railway run npm start

# Deploy manually
railway up
```

### Useful URLs

- **Railway Dashboard**: https://railway.app/dashboard
- **GitHub Repo**: https://github.com/MagicTurtle-s/hubspot-mcp-railway
- **Claude.ai**: https://claude.ai
- **HubSpot Developer**: https://developers.hubspot.com

---

**Deployment Checklist:**
- [ ] Railway project created
- [ ] GitHub repo connected
- [ ] `HUBSPOT_ACCESS_TOKEN` set
- [ ] Deployment successful
- [ ] Railway URL copied
- [ ] Claude.ai configured
- [ ] Tools enabled
- [ ] Test queries working

**Status:** Ready for deployment ✅
**Last Updated:** 2025-10-09
