<div align="center">
    <h1 align="center">HubSpot MCP Server</h1>
    <p align=center>
        <a href="https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp"><img src="https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp.svg" alt="NPM Version"></a>
        <a href="https://github.com/shinzo-labs/hubspot-mcp/stargazers"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Fshinzo-labs%2Fhubspot-mcp%2Fstargazers&query=%24.length&logo=github&label=stars&color=e3b341" alt="Stars"></a>
        <a href="https://github.com/shinzo-labs/hubspot-mcp/forks"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Fshinzo-labs%2Fhubspot-mcp%2Fforks&query=%24.length&logo=github&label=forks&color=8957e5" alt="Forks"></a>
        <a href="https://smithery.ai/server/@shinzo-labs/hubspot-mcp"><img src="https://smithery.ai/badge/@shinzo-labs/hubspot-mcp" alt="Smithery Calls"></a>
        <a href="https://www.npmjs.com/package/@shinzolabs/hubspot-mcp"><img src="https://img.shields.io/npm/dm/%40shinzolabs%2Fhubspot-mcp" alt="NPM Downloads"></a>
</div>

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server implementation for the [HubSpot](https://hubspot.com/) API, providing a standardized interface for accessing and managing CRM data.

<p align="center"><img height="512" src=https://github.com/user-attachments/assets/6a0febe5-1aa5-4998-affb-6c5874ed00c4></p>

## Features

- Complete coverage of the HubSpot CRM API
- Support for all standard CRM objects (companies, contacts, deals, etc.)
- Advanced association management with CRM Associations v4
- Company-specific endpoints with property validation
- Batch operations for efficient data management
- Advanced search and filtering capabilities
- Type-safe parameter validation with [Zod](https://zod.dev/)

## Prerequisites

If you don't have an API key, follow the steps [here](https://developers.hubspot.com/docs/guides/api/overview) to obtain an access token. OAuth support is planned as a future enhancement.

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
        "HUBSPOT_ACCESS_TOKEN": "your-access-token-here"
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
        "HUBSPOT_ACCESS_TOKEN": "your-access-token-here"
      }
    }
  }
}
```

### Claude Code CLI Integration

For Claude Code CLI with remote HTTP transport (Railway deployment):

```bash
claude mcp add hubspot https://YOUR_DEPLOYMENT_URL/mcp
```

Replace `YOUR_DEPLOYMENT_URL` with your Railway deployment domain.

Or manually add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "hubspot": {
      "url": "https://YOUR_DEPLOYMENT_URL/mcp",
      "transport": "http"
    }
  }
}
```

**Note**: The Railway deployment uses HTTP transport. Configure `HUBSPOT_ACCESS_TOKEN` in your Railway environment variables.

## Config Variables

| Variable               | Description                               | Required? | Default |
|------------------------|-------------------------------------------|-----------|---------|
| `HUBSPOT_ACCESS_TOKEN` | Access Token for Hubspot Application      | Yes       |         |
| `PORT                ` | Port for Streamable HTTP transport method | No        | `3000`  |
| `TELEMETRY_ENABLED`    | Enable telemetry                          | No        | `true`  |

## Supported Tools

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

### Deals

  - `crm_create_deal`: Create a new deal with validated properties
  - `crm_update_deal`: Update an existing deal's information
  - `crm_get_deal`: Get a single deal by ID
  - `crm_search_deals`: Search deals with specific filters
  - `crm_batch_create_deals`: Create multiple deals in a single request
  - `crm_batch_update_deals`: Update multiple deals in a single request
  - `crm_get_deal_properties`: Get all available deal properties
  - `crm_create_deal_property`: Create a new deal property

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

## Contributing

Contributions are welcomed and encouraged! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on issues, contributions, and contact information.

## Data Collection and Privacy

Shinzo Labs collects limited anonymous telemetry from this server to help improve our products and services. No personally identifiable information is collected as part of this process. Please review the [Privacy Policy](./PRIVACY.md) for more details on the types of data collected and how to opt-out of this telemetry.

## License

MIT
