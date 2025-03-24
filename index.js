#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({
  name: "HubSpot-MCP",
  version: "1.2.3",
  description: "An extensive MCP for the HubSpot API"
})

// Unified response formatter for both success and error responses
function formatResponse(messageOrData, status = 200) {
  const isError = typeof messageOrData === 'string';
  return {
    content: [{
      type: "text",
      text: JSON.stringify(isError ? { error: messageOrData, status } : messageOrData)
    }]
  }
}

// Helper function for making API requests to HubSpot
async function makeApiRequest(endpoint, params = {}, method = 'GET', body = null) {
  const apiKey = process.env.HUBSPOT_ACCESS_TOKEN
  if (!apiKey) {
    throw new Error("HUBSPOT_ACCESS_TOKEN environment variable is not set")
  }

  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, value.toString())
    }
  })

  const url = `https://api.hubapi.com${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

  const requestOptions = {
    method,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
  }

  if (body) {
    requestOptions.body = JSON.stringify(body)
    requestOptions.headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, requestOptions)

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || `Error fetching data from HubSpot: ${response.statusText}`)
  }

  return await response.json()
}

// Enhanced API request wrapper with error handling
async function makeApiRequestWithErrorHandling(endpoint, params = {}, method = 'GET', body = null) {
  try {
    const data = await makeApiRequest(endpoint, params, method, body)
    return formatResponse(data)
  } catch (error) {
    return formatResponse(`Error performing request: ${error.message}`, 500)
  }
}

// Wrapper function to handle common endpoint patterns
async function handleEndpoint(apiCall) {
  try {
    return await apiCall()
  } catch (error) {
    return formatResponse(error.message, error.status || 403)
  }
}

// Company-specific property schema
const companyPropertiesSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  numberofemployees: z.number().optional(),
  annualrevenue: z.number().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  address2: z.string().optional(),
  zip: z.string().optional(),
  type: z.string().optional(),
  lifecyclestage: z.enum(['lead', 'customer', 'opportunity', 'subscriber', 'other']).optional(),
}).catchall(z.any())

// Company-specific CRM endpoints
server.tool("crm_create_company",
  "Create a new company with validated properties",
  {
    properties: companyPropertiesSchema,
    associations: z.array(z.object({
      to: z.object({ id: z.string() }),
      types: z.array(z.object({
        associationCategory: z.string(),
        associationTypeId: z.number()
      }))
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/companies'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("crm_update_company",
  "Update an existing company with validated properties",
  {
    companyId: z.string(),
    properties: companyPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/companies/${params.companyId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("crm_get_company",
  "Get a single company by ID with specific properties and associations",
  {
    companyId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'deals', 'tickets'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/companies/${params.companyId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("crm_search_companies",
  "Search companies with company-specific filters",
  {
    filterGroups: z.array(z.object({
      filters: z.array(z.object({
        propertyName: z.string(),
        operator: z.enum(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']),
        value: z.any()
      }))
    })),
    properties: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    sorts: z.array(z.object({
      propertyName: z.string(),
      direction: z.enum(['ASCENDING', 'DESCENDING'])
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/companies/search'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        filterGroups: params.filterGroups,
        properties: params.properties,
        limit: params.limit,
        after: params.after,
        sorts: params.sorts
      })
    })
  }
)

server.tool("crm_batch_create_companies",
  "Create multiple companies in a single request",
  {
    inputs: z.array(z.object({
      properties: companyPropertiesSchema,
      associations: z.array(z.object({
        to: z.object({ id: z.string() }),
        types: z.array(z.object({
          associationCategory: z.string(),
          associationTypeId: z.number()
        }))
      })).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/companies/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_update_companies",
  "Update multiple companies in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: companyPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/companies/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_get_company_properties",
  "Get all properties for companies",
  {
    archived: z.boolean().optional(),
    properties: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/properties/companies'
      return await makeApiRequestWithErrorHandling(endpoint, {
        archived: params.archived,
        properties: params.properties?.join(',')
      })
    })
  }
)

server.tool("crm_create_company_property",
  "Create a new company property",
  {
    name: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'datetime', 'enumeration', 'bool']),
    fieldType: z.enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date', 'file']),
    groupName: z.string(),
    description: z.string().optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
      description: z.string().optional(),
      displayOrder: z.number().optional(),
      hidden: z.boolean().optional()
    })).optional(),
    displayOrder: z.number().optional(),
    hasUniqueValue: z.boolean().optional(),
    hidden: z.boolean().optional(),
    formField: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/properties/companies'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', params)
    })
  }
)

// CRM Object API Endpoints
server.tool("crm_list_objects",
  "List CRM objects of a specific type with optional filtering and pagination",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    properties: z.array(z.string()).optional(),
    after: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        after: params.after,
        limit: params.limit,
        archived: params.archived
      })
    })
  }
)

server.tool("crm_get_object",
  "Get a single CRM object by ID",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    objectId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/${params.objectId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("crm_create_object",
  "Create a new CRM object",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    properties: z.record(z.any()),
    associations: z.array(z.object({
      to: z.object({ id: z.string() }),
      types: z.array(z.object({
        associationCategory: z.string(),
        associationTypeId: z.number()
      }))
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("crm_update_object",
  "Update an existing CRM object",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    objectId: z.string(),
    properties: z.record(z.any())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/${params.objectId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("crm_delete_object",
  "Delete a CRM object",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    objectId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/${params.objectId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("crm_search_objects",
  "Search CRM objects using filters",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    filterGroups: z.array(z.object({
      filters: z.array(z.object({
        propertyName: z.string(),
        operator: z.enum(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']),
        value: z.any()
      }))
    })),
    properties: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    sorts: z.array(z.object({
      propertyName: z.string(),
      direction: z.enum(['ASCENDING', 'DESCENDING'])
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/search`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        filterGroups: params.filterGroups,
        properties: params.properties,
        limit: params.limit,
        after: params.after,
        sorts: params.sorts
      })
    })
  }
)

server.tool("crm_batch_create_objects",
  "Create multiple CRM objects in a single request",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    inputs: z.array(z.object({
      properties: z.record(z.any()),
      associations: z.array(z.object({
        to: z.object({ id: z.string() }),
        types: z.array(z.object({
          associationCategory: z.string(),
          associationTypeId: z.number()
        }))
      })).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/batch/create`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_update_objects",
  "Update multiple CRM objects in a single request",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.record(z.any())
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/batch/update`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_delete_objects",
  "Delete multiple CRM objects in a single request",
  {
    objectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    objectIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/${params.objectType}/batch/archive`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.objectIds.map(id => ({ id }))
      })
    })
  }
)

// CRM Associations v4 API Endpoints
server.tool("crm_list_association_types",
  "List all available association types for a given object type pair",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom'])
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/associations/${params.fromObjectType}/${params.toObjectType}/types`
      return await makeApiRequestWithErrorHandling(endpoint)
    })
  }
)

server.tool("crm_get_associations",
  "Get all associations of a specific type between objects",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    fromObjectId: z.string(),
    after: z.string().optional(),
    limit: z.number().min(1).max(500).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/objects/${params.fromObjectType}/${params.fromObjectId}/associations/${params.toObjectType}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        after: params.after,
        limit: params.limit
      })
    })
  }
)

server.tool("crm_create_association",
  "Create an association between two objects",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    fromObjectId: z.string(),
    toObjectId: z.string(),
    associationTypes: z.array(z.object({
      associationCategory: z.string(),
      associationTypeId: z.number()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/objects/${params.fromObjectType}/${params.fromObjectId}/associations/${params.toObjectType}/${params.toObjectId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PUT', {
        types: params.associationTypes
      })
    })
  }
)

server.tool("crm_delete_association",
  "Delete an association between two objects",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    fromObjectId: z.string(),
    toObjectId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/objects/${params.fromObjectType}/${params.fromObjectId}/associations/${params.toObjectType}/${params.toObjectId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("crm_batch_create_associations",
  "Create multiple associations in a single request",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    inputs: z.array(z.object({
      from: z.object({ id: z.string() }),
      to: z.object({ id: z.string() }),
      types: z.array(z.object({
        associationCategory: z.string(),
        associationTypeId: z.number()
      }))
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/associations/${params.fromObjectType}/${params.toObjectType}/batch/create`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_delete_associations",
  "Delete multiple associations in a single request",
  {
    fromObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    toObjectType: z.enum(['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes', 'custom']),
    inputs: z.array(z.object({
      from: z.object({ id: z.string() }),
      to: z.object({ id: z.string() })
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v4/associations/${params.fromObjectType}/${params.toObjectType}/batch/archive`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

// Contact-specific property schema
const contactPropertiesSchema = z.object({
  email: z.string().email().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  mobilephone: z.string().optional(),
  company: z.string().optional(),
  jobtitle: z.string().optional(),
  lifecyclestage: z.enum(['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', 'evangelist', 'other']).optional(),
  leadstatus: z.enum(['new', 'open', 'inprogress', 'opennotcontacted', 'opencontacted', 'closedconverted', 'closednotconverted']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  website: z.string().url().optional(),
  twitterhandle: z.string().optional(),
  facebookfanpage: z.string().optional(),
  linkedinbio: z.string().optional(),
}).catchall(z.any())

// Contact-specific CRM endpoints
server.tool("crm_create_contact",
  "Create a new contact with validated properties",
  {
    properties: contactPropertiesSchema,
    associations: z.array(z.object({
      to: z.object({ id: z.string() }),
      types: z.array(z.object({
        associationCategory: z.string(),
        associationTypeId: z.number()
      }))
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/contacts'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("crm_update_contact",
  "Update an existing contact with validated properties",
  {
    contactId: z.string(),
    properties: contactPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/contacts/${params.contactId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("crm_get_contact",
  "Get a single contact by ID with specific properties and associations",
  {
    contactId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['companies', 'deals', 'tickets', 'calls', 'emails', 'meetings', 'notes'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/contacts/${params.contactId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("crm_search_contacts",
  "Search contacts with contact-specific filters",
  {
    filterGroups: z.array(z.object({
      filters: z.array(z.object({
        propertyName: z.string(),
        operator: z.enum(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']),
        value: z.any()
      }))
    })),
    properties: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    sorts: z.array(z.object({
      propertyName: z.string(),
      direction: z.enum(['ASCENDING', 'DESCENDING'])
    })).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/contacts/search'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        filterGroups: params.filterGroups,
        properties: params.properties,
        limit: params.limit,
        after: params.after,
        sorts: params.sorts
      })
    })
  }
)

server.tool("crm_batch_create_contacts",
  "Create multiple contacts in a single request",
  {
    inputs: z.array(z.object({
      properties: contactPropertiesSchema,
      associations: z.array(z.object({
        to: z.object({ id: z.string() }),
        types: z.array(z.object({
          associationCategory: z.string(),
          associationTypeId: z.number()
        }))
      })).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/contacts/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_update_contacts",
  "Update multiple contacts in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: contactPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/contacts/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_get_contact_properties",
  "Get all properties for contacts",
  {
    archived: z.boolean().optional(),
    properties: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/properties/contacts'
      return await makeApiRequestWithErrorHandling(endpoint, {
        archived: params.archived,
        properties: params.properties?.join(',')
      })
    })
  }
)

server.tool("crm_create_contact_property",
  "Create a new contact property",
  {
    name: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'datetime', 'enumeration', 'bool']),
    fieldType: z.enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date', 'file']),
    groupName: z.string(),
    description: z.string().optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
      description: z.string().optional(),
      displayOrder: z.number().optional(),
      hidden: z.boolean().optional()
    })).optional(),
    displayOrder: z.number().optional(),
    hasUniqueValue: z.boolean().optional(),
    hidden: z.boolean().optional(),
    formField: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/properties/contacts'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', params)
    })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
