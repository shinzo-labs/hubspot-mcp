# HubSpot MCP Railway

Cloud-deployed HubSpot Model Context Protocol (MCP) server for accessing HubSpot CRM data via Claude.ai web interface.

## Overview

This project is a Railway-hosted fork of [shinzo-labs/hubspot-mcp](https://github.com/shinzo-labs/hubspot-mcp) configured for cloud deployment with SSE (Server-Sent Events) transport. It provides 116 tools for comprehensive HubSpot CRM API access through Claude.ai's web interface.

**Key Benefits:**
- ✅ Web-accessible from any device via Claude.ai
- ✅ Per-tool granular control in Claude UI
- ✅ No local installation required
- ✅ Persistent uptime with Railway hosting
- ✅ Secure token management via environment variables

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **MCP SDK:** @modelcontextprotocol/sdk v1.15.1+
- **Validation:** Zod for type-safe parameters
- **Transport:** SSE/HTTP via @smithery/sdk
- **Deployment:** Railway with Nixpacks builder
- **Source:** Fork of @shinzolabs/hubspot-mcp v2.0.5

## Quick Start

### Prerequisites

1. **HubSpot Access Token**: Get from [HubSpot API Overview](https://developers.hubspot.com/docs/guides/api/overview)
2. **Railway Account**: Sign up at [railway.app](https://railway.app)

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Set environment variable
export HUBSPOT_ACCESS_TOKEN=your-token-here

# Start server (runs on port 3000)
npm start
```

### Railway Deployment

1. **Push to GitHub** (already done)
2. **Connect to Railway:**
   - Go to railway.app
   - Create new project → Deploy from GitHub repo
   - Select `MagicTurtle-s/hubspot-mcp-railway`
3. **Set Environment Variables:**
   - `HUBSPOT_ACCESS_TOKEN`: Your HubSpot API token
   - `PORT`: 3000 (auto-set by Railway)
   - `TELEMETRY_ENABLED`: true (optional)
4. **Deploy:** Railway auto-builds and deploys
5. **Get Endpoint:** Copy the Railway-provided URL (e.g., `https://your-app.up.railway.app`)

### Claude.ai Integration

1. Open Claude.ai web interface
2. Go to **Search and Tools** menu
3. Click **Add Server** or **Connect MCP**
4. Enter:
   - **Name:** HubSpot CRM
   - **URL:** Your Railway endpoint URL
   - **Transport:** SSE/HTTP
5. **Toggle Tools:** Enable/disable individual tools as needed

## Available Tools (116 Total)

### Core CRM Objects (10 tools)
- List, get, create, update, archive, search CRM objects
- Batch operations for create, read, update, archive

### Companies (8 tools)
- Full CRUD + search for companies
- Batch create/update companies
- Get/create company properties

### Contacts (8 tools)
- Full CRUD + search for contacts
- Batch create/update contacts
- Get/create contact properties

### Leads (8 tools)
- Full CRUD + search for leads
- Batch create/update leads
- Get/create lead properties

### Engagement Management (6 tools)
- Get, create, update, archive engagements
- List and get associated engagements

### Communication Tools (50 tools)
- Calls: 9 tools (create, get, update, archive, list, search, batch operations)
- Emails: 10 tools (full CRUD + batch operations)
- Meetings: 9 tools (full CRUD + batch operations)
- Notes: 10 tools (full CRUD + batch operations)
- Tasks: 10 tools (full CRUD + batch operations)

### Associations (6 tools)
- List association types
- Get, create, archive associations
- Batch create/archive associations

### Communication Preferences (7 tools)
- Get/update contact preferences
- Subscribe/unsubscribe contacts
- Manage subscription definitions and status

### Products (9 tools)
- Full CRUD for products
- Search and list products
- Batch create/read/update/archive products

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUBSPOT_ACCESS_TOKEN` | ✅ Yes | - | HubSpot API access token |
| `PORT` | No | 3000 | HTTP server port |
| `TELEMETRY_ENABLED` | No | true | Support Shinzo Labs with anonymous usage data |

## HubSpot API Scopes

**Recommended Scopes:**
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.companies.write
crm.objects.deals.read
crm.objects.deals.write
crm.objects.leads.read
crm.objects.leads.write
crm.schemas.contacts.read
crm.schemas.contacts.write
crm.schemas.companies.read
crm.schemas.companies.write
```

## Project Structure

```
hubspot-mcp-railway/
├── src/
│   └── index.ts           # Main MCP server (2531 lines, all 116 tools)
├── dist/                  # Compiled JavaScript (generated)
├── .claude/
│   └── context.md         # Claude-specific context and patterns
├── PROJECT.md             # This file
├── README.md              # Original upstream README
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── nixpacks.toml          # Railway build configuration
├── railway.json           # Railway deployment settings
├── Procfile               # Process definition for Railway
└── .env.example           # Environment variable template
```

## Key Files

- **src/index.ts**: Single-file MCP server with all 116 tools
- **nixpacks.toml**: Railway build phases (setup, install, build, start)
- **railway.json**: Deployment config (Nixpacks, restart policy)
- **.env.example**: Environment variable reference

## External Services

### HubSpot API
- **Purpose:** CRM data access
- **Authentication:** Bearer token via `HUBSPOT_ACCESS_TOKEN`
- **Docs:** https://developers.hubspot.com/docs/reference/api

### Railway (Hosting)
- **Purpose:** Cloud deployment with persistent uptime
- **Repo:** https://github.com/MagicTurtle-s/hubspot-mcp-railway
- **Cost:** Estimated $5/month for hobby usage

### Shinzo Labs Telemetry (Optional)
- **Purpose:** Anonymous usage metrics to support open-source development
- **Endpoint:** https://api.otel.shinzo.tech/v1
- **Opt-out:** Set `TELEMETRY_ENABLED=false`

## Related Projects

- **Upstream:** shinzo-labs/hubspot-mcp (source repository)
- **Neo4j MCP Railway v2:** `/c/Users/jonat/neo4j-mcp-railway-v2` (similar Railway deployment pattern)

## Maintenance Notes

- **Upstream Sync:** Periodically check shinzo-labs/hubspot-mcp for updates
- **Dependency Updates:** Run `npm update` monthly
- **Railway Logs:** Monitor via Railway dashboard for errors
- **HubSpot Token:** Rotate token as needed per HubSpot security policies

## Troubleshooting

### Build Fails
- Ensure Node.js 18+ is used (Railway uses Node 20)
- Check TypeScript compiles locally: `npm run build`

### Deployment Fails
- Verify environment variables are set in Railway
- Check Railway logs for error messages
- Ensure `HUBSPOT_ACCESS_TOKEN` is valid

### Claude.ai Connection Issues
- Verify Railway URL is accessible
- Ensure SSE transport is selected in Claude.ai
- Check Railway service is running (not sleeping)

### API Errors
- Verify HubSpot token has required scopes
- Check HubSpot API rate limits (10,000 requests/day free tier)
- Review error messages in Railway logs

## License

MIT (inherited from upstream shinzo-labs/hubspot-mcp)

## Credits

- **Original Author:** Austin Born (Shinzo Labs) - austin@shinzolabs.com
- **Fork Maintainer:** MagicTurtle-s
- **Deployment:** Railway-optimized configuration

---

**Status:** ⏳ In Development
**Last Updated:** 2025-10-09
**Version:** 2.0.5 (upstream) + Railway deployment
