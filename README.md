# HubSpot MCP
[![smithery badge](https://smithery.ai/badge/@shinzo-labs/hubspot-mcp)](https://smithery.ai/server/@shinzo-labs/hubspot-mcp)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) implementation for the [HubSpot](https://hubspot.com/) API, providing a standardized interface for accessing and managing CRM data.

## Features

- Complete coverage of the HubSpot CRM API
- Support for all standard CRM objects (companies, contacts, deals, etc.)
- Advanced association management with CRM Associations v4
- Company-specific endpoints with property validation
- Batch operations for efficient data management
- Advanced search and filtering capabilities
- Type-safe parameter validation with [Zod](https://zod.dev/)

## Installation
If you don't have an API key, follow the steps [here](https://developers.hubspot.com/docs/guides/api/overview) to obtain an access token.

### NPX (Recommended)

Add the following to your `claude_desktop_config.json`:
```javascript
{
  "mcpServers": {
    "hubspot": {
      "command": "npx",
      "args": [
        "@shinzolabs/hubspot-mcp"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Manual Download

1. Download the repo:
```bash
git clone https://github.com/shinzo-labs/hubspot-mcp.git
```

2. Install packages:
```bash
pnpm i
```

3. Add the following to your `claude_desktop_config.json`:
```javascript
{
  "mcpServers": {
    "hubspot": {
      "command": "node",
      "args": [
        "/path/to/hubspot-mcp/index.js"
      ],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-key-here"
      }
    }
  }
}
```

### Smithery

To install for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@shinzo-labs/hubspot-mcp):

```bash
npx -y @smithery/cli install @shinzo-labs/hubspot-mcp --client claude
```

## Supported Endpoints

### CRM Object Operations

#### Basic Operations
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

### CRM Associations v4

#### Association Management
- `crm_list_association_types`: List available association types between object types
- `crm_get_associations`: Get all associations between objects
- `crm_create_association`: Create an association between two objects
- `crm_delete_association`: Delete an association between two objects

#### Batch Association Operations
- `crm_batch_create_associations`: Create multiple associations in a single request
- `crm_batch_delete_associations`: Delete multiple associations in a single request

### Company Operations

#### Basic Company Operations
- `crm_create_company`: Create a new company with validated properties
- `crm_update_company`: Update an existing company
- `crm_get_company`: Get a single company by ID
- `crm_search_companies`: Search companies with specific filters

#### Batch Company Operations
- `crm_batch_create_companies`: Create multiple companies in a single request
- `crm_batch_update_companies`: Update multiple companies in a single request

#### Company Property Management
- `crm_get_company_properties`: Get all available company properties
- `crm_create_company_property`: Create a new company property

### Contact Operations

#### Basic Contact Operations
- `crm_create_contact`: Create a new contact with validated properties (email, name, phone, etc.)
- `crm_update_contact`: Update an existing contact's information
- `crm_get_contact`: Get a single contact by ID with optional properties and associations
- `crm_search_contacts`: Search contacts with specific filters

#### Batch Contact Operations
- `crm_batch_create_contacts`: Create multiple contacts in a single request
- `crm_batch_update_contacts`: Update multiple contacts in a single request

#### Contact Property Management
- `crm_get_contact_properties`: Get all available contact properties
- `crm_create_contact_property`: Create a new contact property

### Supported Object Types
- Companies
- Contacts
- Deals
- Tickets
- Products
- Line Items
- Quotes
- Custom Objects

## Contributing

Contributions are welcomed and encouraged. Contact austin@shinzolabs.com with any questions, comments or concerns.