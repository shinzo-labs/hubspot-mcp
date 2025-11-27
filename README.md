<div align="center">
    <h1 align="center">HubSpot MCP Server</h1>
    <p align=center>
        <a href="https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp"><img src="https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp.svg" alt="NPM Version"></a>
        <a href="https://github.com/shinzo-labs/hubspot-mcp/stargazers"><img src="https://img.shields.io/github/stars/shinzo-labs/hubspot-mcp?style=flat&logo=github&color=e3b341" alt="Stars"></a>
        <a href="https://github.com/shinzo-labs/hubspot-mcp/forks"><img src="https://img.shields.io/github/forks/shinzo-labs/hubspot-mcp?style=flat&logo=github&color=8957e5" alt="Forks"></a>
        <a href="https://smithery.ai/server/@shinzo-labs/hubspot-mcp"><img src="https://smithery.ai/badge/@shinzo-labs/hubspot-mcp" alt="Smithery Calls"></a>
        <a href="https://www.npmjs.com/package/@shinzolabs/hubspot-mcp"><img src="https://img.shields.io/npm/dm/%40shinzolabs%2Fhubspot-mcp" alt="NPM Downloads"></a>
</div>

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server implementation for the [HubSpot](https://hubspot.com/) API, providing a standardized interface for accessing and managing CRM data.

<p align="center"><img height="512" src=https://github.com/user-attachments/assets/6a0febe5-1aa5-4998-affb-6c5874ed00c4></p>

## Features

- Complete coverage of the HubSpot CRM API
- Support for all standard CRM objects (companies, contacts, deals, etc.)
- Advanced association management with CRM Associations v4
- Pipeline management for deals, tickets, and leads
- Workflow automation (BETA - v4 Automation API)
- Company-specific endpoints with property validation
- Batch operations for efficient data management
- Advanced search and filtering capabilities
- Type-safe parameter validation with [Zod](https://zod.dev/)
- Full OAuth 2.0 support with token refresh
- Optional client secret support for enhanced authentication

## Prerequisites

You can authenticate with HubSpot using either:

1. **Private App Access Token** (Recommended for server-to-server): Follow the steps [here](https://developers.hubspot.com/docs/guides/api/overview) to obtain an access token. Optionally, you may also need a Client Secret for certain HubSpot API operations that require additional security.

2. **OAuth 2.0** (Recommended for user-facing applications): Create a public app in your [HubSpot Developer Account](https://developers.hubspot.com/get-started), configure your OAuth redirect URI, and use the OAuth tools to obtain access and refresh tokens. See the OAuth Setup section below for detailed instructions.

## Client Configuration

There are several options to configure your MCP client with the server. For hosted/remote server setup, use Smithery's CLI with a [Smithery API Key](https://smithery.ai/docs/registry#registry-api). For local installation, use `npx` or build from source. Each of these options is explained below.

### Smithery Remote Server (Recommended)

To add a remote server to your MCP client `config.json`, run the following command from [Smithery CLI](https://github.com/smithery-ai/cli?tab=readme-ov-file#smithery-cli--):

```bash
npx -y @smithery/cli install @shinzo-labs/hubspot-mcp
```

Enter your `HUBSPOT_ACCESS_TOKEN` when prompted.

### Smithery SDK

If you are developing your own agent application, you can use the boilerplate code [here](https://smithery.ai/server/@shinzo-labs/hubspot-mcp/api).

### NPX Local Install

To install the server locally with `npx`, add the following to your MCP client `config.json`:
```javascript
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": [
        "@shinzolabs/hubspot-mcp"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-access-token-here",
        "HUBSPOT_CLIENT_SECRET": "your-client-secret-here" // Optional
      }
    }
  }
}
```

### Build from Source

1. Download the repo:
```bash
git clone https://github.com/shinzo-labs/hubspot-mcp.git
```

2. Install packages (inside cloned repo):
```bash
pnpm i
```

3. Add the following to your MCP client `config.json`:
```javascript
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": [
        "/path/to/hubspot-mcp/index.js"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-access-token-here",
        "HUBSPOT_CLIENT_SECRET": "your-client-secret-here" // Optional
      }
    }
  }
}
```

## Config Variables

| Variable                 | Description                                              | Required? | Default |
|--------------------------|----------------------------------------------------------|-----------|---------|
| `HUBSPOT_ACCESS_TOKEN`   | Access Token for HubSpot Application (from Private App or OAuth)                     | Yes*       |         |
| `HUBSPOT_CLIENT_SECRET`  | Client Secret for enhanced authentication or OAuth       | No**        |         |
| `HUBSPOT_CLIENT_ID`      | OAuth Client ID (required for OAuth flow)                | No**        |         |
| `HUBSPOT_REDIRECT_URI`   | OAuth redirect URI (default: http://localhost:3000/oauth/callback) | No        | `http://localhost:3000/oauth/callback` |
| `HUBSPOT_REFRESH_TOKEN`  | OAuth refresh token for automatic token renewal          | No        |         |
| `PORT`                   | Port for Streamable HTTP transport method               | No        | `3000`  |
| `TELEMETRY_ENABLED`      | Enable telemetry                                         | No        | `true`  |

\* Required unless using OAuth flow to obtain tokens
\** Required for OAuth authentication

## OAuth Setup

To use OAuth authentication with HubSpot:

### 1. Create a HubSpot App

1. Go to your [HubSpot Developer Account](https://developers.hubspot.com/)
2. Create a new public app or select an existing one
3. Navigate to the "Auth" tab in your app settings
4. Add your redirect URI (default: `http://localhost:3000/oauth/callback`)
5. Note your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Set the following environment variables:
```bash
HUBSPOT_CLIENT_ID="your-client-id"
HUBSPOT_CLIENT_SECRET="your-client-secret"
HUBSPOT_REDIRECT_URI="http://localhost:3000/oauth/callback"  # Optional, this is the default
```

### 3. Obtain Access Token

Use the OAuth MCP tools to complete the authentication flow:

**Step 1: Generate Authorization URL**
```javascript
// Use the oauth_get_authorization_url tool
{
  "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.companies.read", "crm.objects.companies.write"]
}
```

**Step 2: Visit the URL and Authorize**
Visit the authorization URL returned by the tool. After granting permissions, HubSpot will redirect to your redirect URI with a `code` parameter.

**Step 3: Exchange Code for Tokens**
```javascript
// Use the oauth_exchange_code tool with the code from the redirect
{
  "code": "authorization-code-from-redirect"
}
```

**Step 4: Store Tokens**
The response will include `access_token` and `refresh_token`. Store these securely:
```bash
HUBSPOT_ACCESS_TOKEN="your-access-token"
HUBSPOT_REFRESH_TOKEN="your-refresh-token"
```

### 4. Token Refresh

Access tokens expire after a few hours. Use the `oauth_refresh_token` tool to obtain a new access token:
```javascript
// This will use HUBSPOT_REFRESH_TOKEN from environment
{}
```

The redirect URL for OAuth is determined by the `HUBSPOT_REDIRECT_URI` environment variable, or defaults to `http://localhost:3000/oauth/callback`.

## Supported Tools

### OAuth

  - `oauth_get_authorization_url`: Generate OAuth authorization URL for HubSpot
  - `oauth_exchange_code`: Exchange authorization code for access and refresh tokens
  - `oauth_refresh_token`: Refresh an expired access token using a refresh token

### Core CRM Objects

  - `crm_list_objects`: List CRM objects with optional filtering and pagination
  - `crm_get_object`: Get a single CRM object by ID
  - `crm_create_object`: Create a new CRM object
  - `crm_update_object`: Update an existing CRM object
  - `crm_archive_object`: Archive (delete) a CRM object
  - `crm_search_objects`: Search CRM objects using advanced filters
  - `crm_batch_create_objects`: Create multiple objects in a single request
  - `crm_batch_read_objects`: Read multipl objects in a single request
  - `crm_batch_update_objects`: Update multiple objects in a single request
  - `crm_batch_archive_objects`: Archive (delete) multiple objects in a single request

### Companies

  - `crm_create_company`: Create a new company with validated properties
  - `crm_update_company`: Update an existing company
  - `crm_get_company`: Get a single company by ID
  - `crm_search_companies`: Search companies with specific filters
  - `crm_batch_create_companies`: Create multiple companies in a single request
  - `crm_batch_update_companies`: Update multiple companies in a single request
  - `crm_get_company_properties`: Get all available company properties
  - `crm_create_company_property`: Create a new company property

### Contacts

  - `crm_create_contact`: Create a new contact with validated properties
  - `crm_update_contact`: Update an existing contact's information
  - `crm_get_contact`: Get a single contact by ID
  - `crm_search_contacts`: Search contacts with specific filters
  - `crm_batch_create_contacts`: Create multiple contacts in a single request
  - `crm_batch_update_contacts`: Update multiple contacts in a single request
  - `crm_get_contact_properties`: Get all available contact properties
  - `crm_create_contact_property`: Create a new contact property

### Leads

  - `crm_create_lead`: Create a new lead with validated properties
  - `crm_update_lead`: Update an existing lead's information
  - `crm_get_lead`: Get a single lead by ID
  - `crm_search_leads`: Search leads with specific filters
  - `crm_batch_create_leads`: Create multiple leads in a single request
  - `crm_batch_update_leads`: Update multiple leads in a single request
  - `crm_get_lead_properties`: Get all available lead properties
  - `crm_create_lead_property`: Create a new lead property

### Engagement Management

  - `engagement_details_get`: Get details of a specific engagement
  - `engagement_details_create`: Create a new engagement
  - `engagement_details_update`: Update an existing engagement
  - `engagement_details_archive`: Archive (delete) an engagement
  - `engagement_details_list`: List all engagements with filtering
  - `engagement_details_get_associated`: Get associated engagements

### Calls

  - `calls_create`: Create a new call record
  - `calls_get`: Get call details
  - `calls_update`: Update a call record
  - `calls_archive`: Archive a call
  - `calls_list`: List all calls
  - `calls_search`: Search calls
  - `calls_batch_create`: Create multiple calls
  - `calls_batch_read`: Read multiple calls
  - `calls_batch_update`: Update multiple calls
  - `calls_batch_archive`: Archive multiple calls

### Emails

  - `emails_create`: Create a new email record
  - `emails_get`: Get email details
  - `emails_update`: Update an email
  - `emails_archive`: Archive an email
  - `emails_list`: List all emails
  - `emails_search`: Search emails
  - `emails_batch_create`: Create multiple emails
  - `emails_batch_read`: Read multiple emails
  - `emails_batch_update`: Update multiple emails
  - `emails_batch_archive`: Archive multiple emails

### Meetings

  - `meetings_create`: Create a new meeting
  - `meetings_get`: Get meeting details
  - `meetings_update`: Update a meeting
  - `meetings_archive`: Archive (delete) a meeting
  - `meetings_list`: List all meetings
  - `meetings_search`: Search meetings
  - `meetings_batch_create`: Create multiple meetings
  - `meetings_batch_update`: Update multiple meetings
  - `meetings_batch_archive`: Archive multiple meetings

### Notes

  - `notes_create`: Create a new note
  - `notes_get`: Get note details
  - `notes_update`: Update a note
  - `notes_archive`: Archive a note
  - `notes_list`: List all notes
  - `notes_search`: Search notes
  - `notes_batch_create`: Create multiple notes
  - `notes_batch_read`: Read multiple notes
  - `notes_batch_update`: Update multiple notes
  - `notes_batch_archive`: Archive multiple notes

### Tasks

  - `tasks_create`: Create a new task
  - `tasks_get`: Get task details
  - `tasks_update`: Update a task
  - `tasks_archive`: Archive a task
  - `tasks_list`: List all tasks
  - `tasks_search`: Search tasks
  - `tasks_batch_create`: Create multiple tasks
  - `tasks_batch_read`: Read multiple tasks
  - `tasks_batch_update`: Update multiple tasks
  - `tasks_batch_archive`: Archive multiple tasks

### Associations and Relationships

  - `crm_list_association_types`: List available association types
  - `crm_get_associations`: Get all associations between objects
  - `crm_create_association`: Create an association
  - `crm_archive_association`: Archive (delete) an association
  - `crm_batch_create_associations`: Create multiple associations
  - `crm_batch_archive_associations`: Archive (delete) multiple associations

### Communication Preferences

  - `communications_get_preferences`: Get contact preferences
  - `communications_update_preferences`: Update contact preferences
  - `communications_unsubscribe_contact`: Global unsubscribe
  - `communications_subscribe_contact`: Global subscribe
  - `communications_get_subscription_definitions`: Get subscription definitions
  - `communications_get_subscription_status`: Get status for multiple contacts
  - `communications_update_subscription_status`: Update status for multiple contacts

### Products

  - `products_create`: Create a product with the given properties and return a copy of the object, including the ID.
  - `products_read`: Read an Object identified by ID
  - `products_update`: Perform a partial update of an Object identified by ID. Read-only and non-existent properties will result in an error. Properties values can be cleared by passing an empty string.
  - `products_archive`: Move an Object identified by ID to the recycling bin.
  - `products_list`: Read a page of products. Control what is returned via the `properties` query param. `after` is the paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.
  - `products_search`: Search products
  - `products_batch_create`: Create a batch of products
  - `products_batch_read`: Read a batch of products by internal ID, or unique property values. Retrieve records by the `idProperty` parameter to retrieve records by a custom unique value property.
  - `products_batch_update`: Update a batch of products by internal ID, or unique values specified by the `idProperty` query param.
  - `products_batch_archive`: Archive a batch of products by ID

### Pipelines

  - `pipelines_list`: Get all pipelines for a specific object type (deals, tickets, leads)
  - `pipelines_get`: Get a specific pipeline by ID
  - `pipelines_create`: Create a new pipeline with stages
  - `pipelines_update`: Update an existing pipeline's label or display order
  - `pipelines_delete`: Delete a pipeline
  - `pipelines_stage_create`: Create a new stage in a pipeline
  - `pipelines_stage_update`: Update a pipeline stage's details
  - `pipelines_stage_delete`: Delete a stage from a pipeline
  - `pipelines_audit`: View audit history of changes made to a pipeline

### Workflows (BETA)

  - `workflows_list`: Get all workflows in your HubSpot account
  - `workflows_get`: Get a specific workflow by ID
  - `workflows_create`: Create a new workflow (requires workflow specification)
  - `workflows_delete`: Delete a workflow
  - `workflows_batch_read`: Get multiple workflows by their IDs in a single request

## Contributing

Contributions are welcomed and encouraged! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on issues, contributions, and contact information.

## Data Collection and Privacy

Shinzo Labs collects limited anonymous telemetry from this server to help improve our products and services. No personally identifiable information is collected as part of this process. Please review the [Privacy Policy](./PRIVACY.md) for more details on the types of data collected and how to opt-out of this telemetry.

## License

MIT
