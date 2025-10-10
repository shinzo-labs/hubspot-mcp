# Claude Context: HubSpot MCP Railway

## Architecture Overview

### Single-File MCP Server
The entire MCP server is implemented in `src/index.ts` (2531 lines). It contains:
- 116 tool definitions using `server.tool()` calls
- Zod schema validation for all parameters
- HubSpot API client with error handling
- Dual transport support: stdio (local) and SSE/HTTP (cloud)

### Transport Modes

**Stdio (Local Development):**
```typescript
const stdioServer = createServer({})
const transport = new StdioServerTransport()
await stdioServer.connect(transport)
```

**SSE/HTTP (Railway Deployment):**
```typescript
const { app } = createStatefulServer(createServer)
const PORT = process.env.PORT || 3000
app.listen(PORT)
```

Both modes run simultaneously, enabling local testing and cloud deployment.

### HubSpot API Integration

**Base Pattern:**
```typescript
async function makeApiRequest(
  apiKey: string,
  endpoint: string,
  params: Record<string, any> = {},
  method = 'GET',
  body: Record<string, any> | null = null
) {
  const url = `https://api.hubapi.com${endpoint}?${queryParams}`
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }
  const response = await fetch(url, { method, headers, body: JSON.stringify(body) })
  return await response.json()
}
```

**Error Handling:**
- All tools use `handleEndpoint()` wrapper for consistent error handling
- `makeApiRequestWithErrorHandling()` formats responses consistently
- Returns error messages as formatted text response

## Key Patterns

### Tool Definition Structure
Every tool follows this pattern:

```typescript
server.tool("tool_name",
  "Human-readable description",
  {
    // Zod schema for parameters
    param1: z.string(),
    param2: z.number().optional(),
    // ...
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/...'
      return await makeApiRequestWithErrorHandling(
        hubspotAccessToken,
        endpoint,
        { query: params },  // Query parameters
        'POST',              // HTTP method
        { body: params }     // Request body
      )
    })
  }
)
```

### Validation Patterns

**Company Properties Schema:**
```typescript
const companyPropertiesSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  website: z.string().url().optional(),
  lifecyclestage: z.enum(['lead', 'customer', 'opportunity', 'subscriber', 'other']).optional(),
}).catchall(z.any())  // Allow custom properties
```

**Search Filters:**
```typescript
{
  filterGroups: z.array(z.object({
    filters: z.array(z.object({
      propertyName: z.string(),
      operator: z.enum(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']),
      value: z.any()
    }))
  }))
}
```

**Batch Operations:**
```typescript
{
  inputs: z.array(z.object({
    id: z.string(),           // For update/archive
    properties: schema,       // For create/update
    associations: z.array(...)  // Optional
  }))
}
```

### Configuration Management

```typescript
function getConfig(config: any) {
  return {
    hubspotAccessToken: config?.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN,
    telemetryEnabled: config?.TELEMETRY_ENABLED || process.env.TELEMETRY_ENABLED || "true"
  }
}
```

Config is read from:
1. Passed config object (for Smithery SDK)
2. Environment variables (for Railway)
3. Default values

## Common Tasks

### Adding a New Tool

1. Define Zod schema for parameters
2. Add `server.tool()` call following the pattern
3. Implement HubSpot API endpoint call
4. Test locally with MCP Inspector
5. Rebuild: `npm run build`

### Testing Locally

```bash
# Set environment variable
export HUBSPOT_ACCESS_TOKEN=your-token

# Build
npm run build

# Start server (stdio mode for local testing)
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

### Deploying to Railway

```bash
# Commit changes
git add .
git commit -m "Your message"
git push origin main

# Railway auto-deploys on push
# Monitor logs in Railway dashboard
```

### Filtering Tools (Optional)

If you want to reduce the number of exposed tools:

1. Comment out unwanted `server.tool()` blocks in `src/index.ts`
2. Rebuild and redeploy
3. Or use Claude.ai's per-tool toggle in the UI (recommended)

## Gotchas and Pitfalls

### 1. Dependency Version Conflicts
**Issue:** MCP SDK version must match instrumentation package
**Solution:** Use `@modelcontextprotocol/sdk@^1.15.1` (not 1.12.3)

### 2. Dual Transport Startup
**Behavior:** Server starts BOTH stdio and HTTP transports
**Impact:** Railway uses HTTP/SSE, local uses stdio
**Note:** This is intentional for flexibility

### 3. Environment Variables
**Railway:** Set in Railway dashboard under Variables
**Local:** Use `.env` file or export statements
**Gotcha:** Railway auto-sets `PORT` - don't override

### 4. HubSpot API Rate Limits
**Free Tier:** 10,000 requests/day
**Professional:** 40,000 requests/day
**Batch Endpoints:** Count as 1 request regardless of batch size
**Tip:** Use batch operations when processing multiple objects

### 5. Token Scopes
**Problem:** 401/403 errors if token lacks required scopes
**Solution:** Ensure token has read/write access for needed object types
**Check:** HubSpot → Settings → Integrations → Private Apps → Scopes

### 6. Build Directory
**Important:** `dist/` directory is git-ignored
**Railway:** Automatically runs `npm run build` during deployment
**Local:** Must run `npm run build` after code changes

### 7. Telemetry
**Default:** Enabled and sends to Shinzo Labs
**Opt-out:** Set `TELEMETRY_ENABLED=false`
**Data:** Anonymous usage metrics (no PII)

### 8. Smithery SDK
**Purpose:** Enables SSE/HTTP transport for cloud deployment
**Alternative:** Could use standard MCP HTTP transport
**Benefit:** Stateful server with automatic session management

## Testing Strategy

### Unit Testing
Not currently implemented. Original repo has Jest configured but minimal tests.

### Integration Testing
Use MCP Inspector for interactive testing:

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

### End-to-End Testing
1. Deploy to Railway
2. Connect via Claude.ai
3. Test high-priority tools:
   - `crm_list_objects`
   - `crm_get_company`
   - `crm_search_contacts`
   - `crm_create_lead`

## Deployment Process

### Railway Auto-Deploy Flow

1. **Code Push:** `git push origin main`
2. **Railway Detects Change:** Webhook triggers build
3. **Nixpacks Build:**
   - Phase 1: Setup Node.js 20
   - Phase 2: `npm install`
   - Phase 3: `npm run build` (compiles TypeScript)
4. **Start:** `npm start` (runs `node ./dist/index.js`)
5. **Health Check:** Railway monitors HTTP endpoints
6. **Live:** Service available at Railway-provided URL

### Monitoring

**Railway Dashboard:**
- Deployment logs
- Runtime logs
- Resource usage (CPU, memory)
- Build history

**Logs to Watch:**
- `npm install` output (check for dependency errors)
- `tsc` output (check for TypeScript errors)
- Server startup messages
- HubSpot API errors

### Rollback Strategy

If deployment fails:
1. Check Railway logs for errors
2. Fix issue locally and test
3. Push fix to trigger new deployment
4. Or use Railway's "Redeploy" feature to previous successful build

## Integration with Claude.ai

### Connection Setup

**Add MCP Server in Claude.ai:**
1. Search and Tools → Add Server
2. Name: HubSpot CRM
3. URL: `https://your-app.up.railway.app`
4. Transport: SSE/HTTP
5. Authentication: None (token in env vars)

**Tool Management:**
- All 116 tools appear in Claude.ai
- Toggle individual tools on/off as needed
- Recommended: Start with 10-20 high-priority tools

### High-Priority Tools (Start with these)

1. `crm_list_objects` - Browse CRM data
2. `crm_get_object` - Get specific records
3. `crm_search_objects` - Advanced search
4. `crm_create_company` - Create companies
5. `crm_get_company` - Get company details
6. `crm_search_companies` - Find companies
7. `crm_create_contact` - Create contacts
8. `crm_get_contact` - Get contact details
9. `crm_search_contacts` - Find contacts
10. `crm_get_associations` - View relationships

### Usage Patterns in Claude.ai

**List Companies:**
```
Show me all companies in HubSpot
```
Claude calls: `crm_list_objects` with `objectType: "companies"`

**Search Contacts:**
```
Find all contacts with @example.com email
```
Claude calls: `crm_search_contacts` with email filter

**Create Lead:**
```
Create a new lead for Jane Doe at jane@example.com
```
Claude calls: `crm_create_lead` with properties

## Performance Considerations

### Response Times
- **Simple GET:** ~200-500ms (HubSpot API latency)
- **Search:** ~500-1000ms (depends on filter complexity)
- **Batch Operations:** ~1-3s (processes multiple objects)

### Optimization Tips
1. Use batch endpoints when processing multiple objects
2. Specify only needed properties in GET requests
3. Use pagination (`limit` and `after`) for large result sets
4. Cache property schemas locally when possible

### Railway Resource Limits
- **Free Tier:** 512MB RAM, shared CPU
- **Hobby Plan:** $5/month, 1GB RAM, dedicated CPU
- **Scaling:** Railway auto-scales within plan limits

## Security

### Token Management
- ✅ Store in Railway environment variables
- ✅ Never commit tokens to git
- ✅ Rotate tokens periodically
- ❌ Don't log tokens in Railway logs

### API Security
- Railway URL is public but requires knowledge of endpoint
- HubSpot token provides access control
- Consider adding custom authentication layer for production

### Telemetry Privacy
- Shinzo Labs telemetry is anonymous
- No PII or HubSpot data sent to telemetry endpoint
- Only tool usage counts and performance metrics

## Future Enhancements

### Potential Improvements
1. **OAuth Flow:** Replace static token with OAuth 2.0
2. **Multi-User Support:** Per-user token storage
3. **Rate Limit Handling:** Automatic retry with backoff
4. **Caching:** Cache property schemas and metadata
5. **Webhooks:** Listen for HubSpot events
6. **Custom Authentication:** Add auth layer for Railway endpoint

### Upstream Sync
Monitor shinzo-labs/hubspot-mcp for:
- New tools
- Bug fixes
- Dependency updates
- MCP SDK upgrades

## Useful Commands

```bash
# Development
npm install          # Install dependencies
npm run build        # Build TypeScript
npm start            # Start server
npm test             # Run tests (if implemented)

# Railway CLI
railway login        # Authenticate with Railway
railway link         # Link local repo to Railway project
railway logs         # View live logs
railway run npm start # Run locally with Railway env vars

# Git
git add .
git commit -m "Description"
git push origin main

# Debugging
npx @modelcontextprotocol/inspector dist/index.js  # Local MCP testing
curl https://your-app.up.railway.app/health        # Health check (if implemented)
```

## Resources

- **MCP Docs:** https://modelcontextprotocol.io
- **HubSpot API:** https://developers.hubspot.com/docs/reference/api
- **Railway Docs:** https://docs.railway.app
- **Zod Docs:** https://zod.dev
- **Smithery SDK:** https://smithery.ai/docs

---

**Last Updated:** 2025-10-09
**Maintainer:** MagicTurtle-s
