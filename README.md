# HubSpot MCP

[![npm version](https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp.svg)](https://badge.fury.io/js/@shinzolabs%2Fhubspot-mcp)
[![smithery badge](https://smithery.ai/badge/@shinzo-labs/hubspot-mcp)](https://smithery.ai/server/@shinzo-labs/hubspot-mcp)

<p align="center"><img height="512" src=https://github.com/user-attachments/assets/6a0febe5-1aa5-4998-affb-6c5874ed00c4></p>

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) implementation for the [HubSpot](https://hubspot.com/) API, providing a standardized interface for accessing and managing CRM data.

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

## Config Variables

| Variable               | Description                               | Required? | Default |
|------------------------|-------------------------------------------|-----------|---------|
| `HUBSPOT_ACCESS_TOKEN` | Access Token for Hubspot Application      | Yes       |         |
| `PORT                ` | Port for Streamable HTTP transport method | No        | `3000`  |

## Supported Tools

### Core CRM Objects

#### Basic Object Operations
- `crm_list_objects`: List CRM objects with optional filtering and pagination
- `crm_get_object`: Get a single CRM object by ID
- `crm_create_object`: Create a new CRM object
- `crm_update_object`: Update an existing CRM object
- `crm_delete_object`: Delete a CRM object

#### Search and Batch Operations
- `crm_search_objects`: Search CRM objects using advanced filters
- `crm_batch_create_objects`: Create multiple objects in a single request
- `crm_batch_update_objects`: Update multiple objects in a single request
- `crm_batch_delete_objects`: Delete multiple objects in a single request

### CRM Records Management

#### Companies
- Basic Operations:
  - `crm_create_company`: Create a new company with validated properties
  - `crm_update_company`: Update an existing company
  - `crm_get_company`: Get a single company by ID
  - `crm_search_companies`: Search companies with specific filters
- Batch Operations:
  - `crm_batch_create_companies`: Create multiple companies in a single request
  - `crm_batch_update_companies`: Update multiple companies in a single request
- Property Management:
  - `crm_get_company_properties`: Get all available company properties
  - `crm_create_company_property`: Create a new company property

#### Contacts
- Basic Operations:
  - `crm_create_contact`: Create a new contact with validated properties
  - `crm_update_contact`: Update an existing contact's information
  - `crm_get_contact`: Get a single contact by ID
  - `crm_search_contacts`: Search contacts with specific filters
- Batch Operations:
  - `crm_batch_create_contacts`: Create multiple contacts in a single request
  - `crm_batch_update_contacts`: Update multiple contacts in a single request
- Property Management:
  - `crm_get_contact_properties`: Get all available contact properties
  - `crm_create_contact_property`: Create a new contact property

#### Leads
- Basic Operations:
  - `crm_create_lead`: Create a new lead with validated properties
  - `crm_update_lead`: Update an existing lead's information
  - `crm_get_lead`: Get a single lead by ID
  - `crm_search_leads`: Search leads with specific filters
- Batch Operations:
  - `crm_batch_create_leads`: Create multiple leads in a single request
  - `crm_batch_update_leads`: Update multiple leads in a single request
- Property Management:
  - `crm_get_lead_properties`: Get all available lead properties
  - `crm_create_lead_property`: Create a new lead property

### Engagement Management

#### Engagement Details
- Basic Operations:
  - `engagement_details_get`: Get details of a specific engagement
  - `engagement_details_create`: Create a new engagement
  - `engagement_details_update`: Update an existing engagement
  - `engagement_details_delete`: Delete an engagement
  - `engagement_details_list`: List all engagements with filtering
  - `engagement_details_get_associated`: Get associated engagements

#### Calls
- Basic Operations:
  - `calls_create`: Create a new call record
  - `calls_get`: Get call details
  - `calls_update`: Update a call record
  - `calls_archive`: Archive a call
  - `calls_list`: List all calls
  - `calls_search`: Search calls
- Batch Operations:
  - `calls_batch_create`: Create multiple calls
  - `calls_batch_read`: Read multiple calls
  - `calls_batch_update`: Update multiple calls
  - `calls_batch_archive`: Archive multiple calls

#### Emails
- Basic Operations:
  - `emails_create`: Create a new email record
  - `emails_get`: Get email details
  - `emails_update`: Update an email
  - `emails_archive`: Archive an email
  - `emails_list`: List all emails
  - `emails_search`: Search emails
- Batch Operations:
  - `emails_batch_create`: Create multiple emails
  - `emails_batch_read`: Read multiple emails
  - `emails_batch_update`: Update multiple emails
  - `emails_batch_archive`: Archive multiple emails

#### Meetings
- Basic Operations:
  - `meetings_create`: Create a new meeting
  - `meetings_get`: Get meeting details
  - `meetings_update`: Update a meeting
  - `meetings_delete`: Delete a meeting
  - `meetings_list`: List all meetings
  - `meetings_search`: Search meetings
- Batch Operations:
  - `meetings_batch_create`: Create multiple meetings
  - `meetings_batch_update`: Update multiple meetings
  - `meetings_batch_archive`: Archive multiple meetings

#### Notes
- Basic Operations:
  - `notes_create`: Create a new note
  - `notes_get`: Get note details
  - `notes_update`: Update a note
  - `notes_archive`: Archive a note
  - `notes_list`: List all notes
  - `notes_search`: Search notes
- Batch Operations:
  - `notes_batch_create`: Create multiple notes
  - `notes_batch_read`: Read multiple notes
  - `notes_batch_update`: Update multiple notes
  - `notes_batch_archive`: Archive multiple notes

#### Tasks
- Basic Operations:
  - `tasks_create`: Create a new task
  - `tasks_get`: Get task details
  - `tasks_update`: Update a task
  - `tasks_archive`: Archive a task
  - `tasks_list`: List all tasks
  - `tasks_search`: Search tasks
- Batch Operations:
  - `tasks_batch_create`: Create multiple tasks
  - `tasks_batch_read`: Read multiple tasks
  - `tasks_batch_update`: Update multiple tasks
  - `tasks_batch_archive`: Archive multiple tasks

### Associations and Relationships

#### CRM Associations v4
- Basic Operations:
  - `crm_list_association_types`: List available association types
  - `crm_get_associations`: Get all associations between objects
  - `crm_create_association`: Create an association
  - `crm_delete_association`: Delete an association
- Batch Operations:
  - `crm_batch_create_associations`: Create multiple associations
  - `crm_batch_delete_associations`: Delete multiple associations

### Communication Preferences

#### Subscription Management
- Basic Operations:
  - `communications_get_preferences`: Get contact preferences
  - `communications_update_preferences`: Update contact preferences
  - `communications_unsubscribe_contact`: Global unsubscribe
  - `communications_subscribe_contact`: Global subscribe
  - `communications_get_subscription_definitions`: Get subscription definitions
- Bulk Operations:
  - `communications_get_subscription_status`: Get status for multiple contacts
  - `communications_update_subscription_status`: Update status for multiple contacts

## Contributing

Contributions are welcomed and encouraged! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on issues, contributions, and contact information.
