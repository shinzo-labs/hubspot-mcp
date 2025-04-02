#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({
  name: "HubSpot-MCP",
  version: "1.3.1",
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

// Lead-specific property schema
const leadPropertiesSchema = z.object({
  email: z.string().email().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobtitle: z.string().optional(),
  leadstatus: z.enum(['new', 'open', 'in_progress', 'qualified', 'unqualified', 'converted', 'lost']).optional(),
  leadsource: z.string().optional(),
  industry: z.string().optional(),
  annualrevenue: z.number().optional(),
  numberofemployees: z.number().optional(),
  rating: z.enum(['hot', 'warm', 'cold']).optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
}).catchall(z.any())

// Lead-specific CRM endpoints
server.tool("crm_create_lead",
  "Create a new lead with validated properties",
  {
    properties: leadPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/leads'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("crm_update_lead",
  "Update an existing lead with validated properties",
  {
    leadId: z.string(),
    properties: leadPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/leads/${params.leadId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("crm_get_lead",
  "Get a single lead by ID with specific properties and associations",
  {
    leadId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['companies', 'contacts', 'deals', 'notes', 'tasks'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/leads/${params.leadId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("crm_search_leads",
  "Search leads with lead-specific filters",
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
      const endpoint = '/crm/v3/objects/leads/search'
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

server.tool("crm_batch_create_leads",
  "Create multiple leads in a single request",
  {
    inputs: z.array(z.object({
      properties: leadPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/leads/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_batch_update_leads",
  "Update multiple leads in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: leadPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/leads/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("crm_get_lead_properties",
  "Get all properties for leads",
  {
    archived: z.boolean().optional(),
    properties: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/properties/leads'
      return await makeApiRequestWithErrorHandling(endpoint, {
        archived: params.archived,
        properties: params.properties?.join(',')
      })
    })
  }
)

server.tool("crm_create_lead_property",
  "Create a new lead property",
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
      const endpoint = '/crm/v3/properties/leads'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', params)
    })
  }
)

// Meetings API Endpoints
server.tool("meetings_list",
  "List all meetings with optional filtering",
  {
    after: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    properties: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/meetings'
      return await makeApiRequestWithErrorHandling(endpoint, {
        after: params.after,
        limit: params.limit,
        createdAfter: params.createdAfter,
        createdBefore: params.createdBefore,
        properties: params.properties?.join(',')
      })
    })
  }
)

server.tool("meetings_get",
  "Get details of a specific meeting",
  {
    meetingId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/meetings/${params.meetingId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("meetings_create",
  "Create a new meeting",
  {
    properties: z.object({
      hs_timestamp: z.string(),
      hs_meeting_title: z.string(),
      hs_meeting_body: z.string().optional(),
      hs_meeting_location: z.string().optional(),
      hs_meeting_start_time: z.string(),
      hs_meeting_end_time: z.string(),
      hs_meeting_outcome: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED']).optional(),
      hubspot_owner_id: z.string().optional()
    }),
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
      const endpoint = '/crm/v3/objects/meetings'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("meetings_update",
  "Update an existing meeting",
  {
    meetingId: z.string(),
    properties: z.object({
      hs_meeting_title: z.string().optional(),
      hs_meeting_body: z.string().optional(),
      hs_meeting_location: z.string().optional(),
      hs_meeting_start_time: z.string().optional(),
      hs_meeting_end_time: z.string().optional(),
      hs_meeting_outcome: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED']).optional(),
      hubspot_owner_id: z.string().optional()
    })
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/meetings/${params.meetingId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("meetings_delete",
  "Delete a meeting",
  {
    meetingId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/meetings/${params.meetingId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("meetings_search",
  "Search meetings with specific filters",
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
      const endpoint = '/crm/v3/objects/meetings/search'
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

server.tool("meetings_batch_create",
  "Create multiple meetings in a single request",
  {
    inputs: z.array(z.object({
      properties: z.object({
        hs_timestamp: z.string(),
        hs_meeting_title: z.string(),
        hs_meeting_body: z.string().optional(),
        hs_meeting_location: z.string().optional(),
        hs_meeting_start_time: z.string(),
        hs_meeting_end_time: z.string(),
        hs_meeting_outcome: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED']).optional(),
        hubspot_owner_id: z.string().optional()
      }),
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
      const endpoint = '/crm/v3/objects/meetings/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("meetings_batch_update",
  "Update multiple meetings in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.object({
        hs_meeting_title: z.string().optional(),
        hs_meeting_body: z.string().optional(),
        hs_meeting_location: z.string().optional(),
        hs_meeting_start_time: z.string().optional(),
        hs_meeting_end_time: z.string().optional(),
        hs_meeting_outcome: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED']).optional(),
        hubspot_owner_id: z.string().optional()
      })
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/meetings/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("meetings_batch_archive",
  "Archive (delete) multiple meetings in a single request",
  {
    meetingIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/meetings/batch/archive'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.meetingIds.map(id => ({ id }))
      })
    })
  }
)

// Notes API Endpoints
const notePropertiesSchema = z.object({
  hs_note_body: z.string(),
  hs_timestamp: z.string().optional(),
  hubspot_owner_id: z.string().optional()
}).catchall(z.any())

server.tool("notes_create",
  "Create a new note",
  {
    properties: notePropertiesSchema,
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
      const endpoint = '/crm/v3/objects/notes'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("notes_get",
  "Get details of a specific note",
  {
    noteId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/notes/${params.noteId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("notes_update",
  "Update an existing note",
  {
    noteId: z.string(),
    properties: notePropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/notes/${params.noteId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("notes_archive",
  "Archive (delete) a note",
  {
    noteId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/notes/${params.noteId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("notes_list",
  "List all notes with optional filtering",
  {
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional(),
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/notes'
      return await makeApiRequestWithErrorHandling(endpoint, {
        limit: params.limit,
        after: params.after,
        properties: params.properties?.join(','),
        associations: params.associations?.join(','),
        archived: params.archived
      })
    })
  }
)

server.tool("notes_search",
  "Search notes with specific filters",
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
      const endpoint = '/crm/v3/objects/notes/search'
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

server.tool("notes_batch_create",
  "Create multiple notes in a single request",
  {
    inputs: z.array(z.object({
      properties: notePropertiesSchema,
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
      const endpoint = '/crm/v3/objects/notes/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("notes_batch_read",
  "Read multiple notes in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/notes/batch/read'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("notes_batch_update",
  "Update multiple notes in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: notePropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/notes/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("notes_batch_archive",
  "Archive (delete) multiple notes in a single request",
  {
    noteIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/notes/batch/archive'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.noteIds.map(id => ({ id }))
      })
    })
  }
)

// Tasks API Endpoints
const taskPropertiesSchema = z.object({
  hs_task_body: z.string(),
  hs_task_priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  hs_task_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'DEFERRED']).optional(),
  hs_task_subject: z.string(),
  hs_task_type: z.string().optional(),
  hs_timestamp: z.string().optional(),
  hs_task_due_date: z.string().optional(),
  hubspot_owner_id: z.string().optional()
}).catchall(z.any())

server.tool("tasks_create",
  "Create a new task",
  {
    properties: taskPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/tasks'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("tasks_get",
  "Get details of a specific task",
  {
    taskId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/tasks/${params.taskId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("tasks_update",
  "Update an existing task",
  {
    taskId: z.string(),
    properties: taskPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/tasks/${params.taskId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("tasks_archive",
  "Archive (delete) a task",
  {
    taskId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/tasks/${params.taskId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("tasks_list",
  "List all tasks with optional filtering",
  {
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional(),
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/tasks'
      return await makeApiRequestWithErrorHandling(endpoint, {
        limit: params.limit,
        after: params.after,
        properties: params.properties?.join(','),
        associations: params.associations?.join(','),
        archived: params.archived
      })
    })
  }
)

server.tool("tasks_search",
  "Search tasks with specific filters",
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
      const endpoint = '/crm/v3/objects/tasks/search'
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

server.tool("tasks_batch_create",
  "Create multiple tasks in a single request",
  {
    inputs: z.array(z.object({
      properties: taskPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/tasks/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("tasks_batch_read",
  "Read multiple tasks in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/tasks/batch/read'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("tasks_batch_update",
  "Update multiple tasks in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: taskPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/tasks/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("tasks_batch_archive",
  "Archive (delete) multiple tasks in a single request",
  {
    taskIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/tasks/batch/archive'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.taskIds.map(id => ({ id }))
      })
    })
  }
)

// Engagement Details API Endpoints
const engagementDetailsSchema = z.object({
  type: z.enum(['EMAIL', 'CALL', 'MEETING', 'TASK', 'NOTE']),
  title: z.string(),
  description: z.string().optional(),
  owner: z.object({
    id: z.string(),
    email: z.string().email()
  }).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  activityType: z.string().optional(),
  loggedAt: z.string().optional(),
  status: z.string().optional()
}).catchall(z.any())

server.tool("engagement_details_get",
  "Get details of a specific engagement",
  {
    engagementId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/engagements/v1/engagements/${params.engagementId}`
      return await makeApiRequestWithErrorHandling(endpoint)
    })
  }
)

server.tool("engagement_details_create",
  "Create a new engagement with details",
  {
    engagement: engagementDetailsSchema,
    associations: z.object({
      contactIds: z.array(z.string()).optional(),
      companyIds: z.array(z.string()).optional(),
      dealIds: z.array(z.string()).optional(),
      ownerIds: z.array(z.string()).optional(),
      ticketIds: z.array(z.string()).optional()
    }).optional(),
    metadata: z.record(z.any()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/engagements/v1/engagements'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        engagement: params.engagement,
        associations: params.associations,
        metadata: params.metadata
      })
    })
  }
)

server.tool("engagement_details_update",
  "Update an existing engagement's details",
  {
    engagementId: z.string(),
    engagement: engagementDetailsSchema,
    metadata: z.record(z.any()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/engagements/v1/engagements/${params.engagementId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        engagement: params.engagement,
        metadata: params.metadata
      })
    })
  }
)

server.tool("engagement_details_list",
  "List all engagements with optional filtering",
  {
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    activityTypes: z.array(z.string()).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/engagements/v1/engagements/paged'
      return await makeApiRequestWithErrorHandling(endpoint, {
        limit: params.limit,
        offset: params.offset,
        startTime: params.startTime,
        endTime: params.endTime,
        activityTypes: params.activityTypes?.join(',')
      })
    })
  }
)

server.tool("engagement_details_delete",
  "Delete an engagement",
  {
    engagementId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/engagements/v1/engagements/${params.engagementId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("engagement_details_get_associated",
  "Get all engagements associated with an object",
  {
    objectType: z.enum(['CONTACT', 'COMPANY', 'DEAL', 'TICKET']),
    objectId: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    activityTypes: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/engagements/v1/engagements/associated/${params.objectType}/${params.objectId}/paged`
      return await makeApiRequestWithErrorHandling(endpoint, {
        startTime: params.startTime,
        endTime: params.endTime,
        activityTypes: params.activityTypes?.join(','),
        limit: params.limit,
        offset: params.offset
      })
    })
  }
)

// Calls API Endpoints
const callPropertiesSchema = z.object({
  hs_call_body: z.string(),
  hs_call_direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  hs_call_disposition: z.string().optional(),
  hs_call_duration: z.number().optional(),
  hs_call_recording_url: z.string().url().optional(),
  hs_call_status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_ANSWER']).optional(),
  hs_call_title: z.string(),
  hs_timestamp: z.string().optional(),
  hubspot_owner_id: z.string().optional()
}).catchall(z.any())

server.tool("calls_create",
  "Create a new call record",
  {
    properties: callPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/calls'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("calls_get",
  "Get details of a specific call",
  {
    callId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/calls/${params.callId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("calls_update",
  "Update an existing call record",
  {
    callId: z.string(),
    properties: callPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/calls/${params.callId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("calls_archive",
  "Archive (delete) a call record",
  {
    callId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/calls/${params.callId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("calls_list",
  "List all calls with optional filtering",
  {
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional(),
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/calls'
      return await makeApiRequestWithErrorHandling(endpoint, {
        limit: params.limit,
        after: params.after,
        properties: params.properties?.join(','),
        associations: params.associations?.join(','),
        archived: params.archived
      })
    })
  }
)

server.tool("calls_search",
  "Search calls with specific filters",
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
      const endpoint = '/crm/v3/objects/calls/search'
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

server.tool("calls_batch_create",
  "Create multiple call records in a single request",
  {
    inputs: z.array(z.object({
      properties: callPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/calls/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("calls_batch_read",
  "Read multiple call records in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/calls/batch/read'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("calls_batch_update",
  "Update multiple call records in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: callPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/calls/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("calls_batch_archive",
  "Archive (delete) multiple call records in a single request",
  {
    callIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/calls/batch/archive'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.callIds.map(id => ({ id }))
      })
    })
  }
)

// Email API Endpoints
const emailPropertiesSchema = z.object({
  hs_email_subject: z.string(),
  hs_email_text: z.string(),
  hs_email_html: z.string().optional(),
  hs_email_status: z.enum(['SENT', 'DRAFT', 'SCHEDULED']).optional(),
  hs_email_direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  hs_timestamp: z.string().optional(),
  hs_email_headers: z.record(z.string()).optional(),
  hs_email_from_email: z.string().email(),
  hs_email_from_firstname: z.string().optional(),
  hs_email_from_lastname: z.string().optional(),
  hs_email_to_email: z.string().email(),
  hs_email_to_firstname: z.string().optional(),
  hs_email_to_lastname: z.string().optional(),
  hs_email_cc: z.array(z.string().email()).optional(),
  hs_email_bcc: z.array(z.string().email()).optional(),
  hubspot_owner_id: z.string().optional()
}).catchall(z.any())

server.tool("emails_create",
  "Create a new email record",
  {
    properties: emailPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/emails'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        properties: params.properties,
        associations: params.associations
      })
    })
  }
)

server.tool("emails_get",
  "Get details of a specific email",
  {
    emailId: z.string(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/emails/${params.emailId}`
      return await makeApiRequestWithErrorHandling(endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  }
)

server.tool("emails_update",
  "Update an existing email record",
  {
    emailId: z.string(),
    properties: emailPropertiesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/emails/${params.emailId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PATCH', {
        properties: params.properties
      })
    })
  }
)

server.tool("emails_archive",
  "Archive (delete) an email record",
  {
    emailId: z.string()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/emails/${params.emailId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'DELETE')
    })
  }
)

server.tool("emails_list",
  "List all emails with optional filtering",
  {
    limit: z.number().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
    associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional(),
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/emails'
      return await makeApiRequestWithErrorHandling(endpoint, {
        limit: params.limit,
        after: params.after,
        properties: params.properties?.join(','),
        associations: params.associations?.join(','),
        archived: params.archived
      })
    })
  }
)

server.tool("emails_search",
  "Search emails with specific filters",
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
      const endpoint = '/crm/v3/objects/emails/search'
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

server.tool("emails_batch_create",
  "Create multiple email records in a single request",
  {
    inputs: z.array(z.object({
      properties: emailPropertiesSchema,
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
      const endpoint = '/crm/v3/objects/emails/batch/create'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("emails_batch_read",
  "Read multiple email records in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.enum(['contacts', 'companies', 'deals', 'tickets'])).optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/emails/batch/read'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("emails_batch_update",
  "Update multiple email records in a single request",
  {
    inputs: z.array(z.object({
      id: z.string(),
      properties: emailPropertiesSchema
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/emails/batch/update'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.inputs
      })
    })
  }
)

server.tool("emails_batch_archive",
  "Archive (delete) multiple email records in a single request",
  {
    emailIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/emails/batch/archive'
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        inputs: params.emailIds.map(id => ({ id }))
      })
    })
  }
)

// Communications API Endpoints
const communicationPreferencesSchema = z.object({
  subscriptionId: z.string(),
  status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED', 'NOT_OPTED']),
  legalBasis: z.enum(['LEGITIMATE_INTEREST_CLIENT', 'LEGITIMATE_INTEREST_PUB', 'PERFORMANCE_OF_CONTRACT', 'CONSENT_WITH_NOTICE', 'CONSENT_WITH_NOTICE_AND_OPT_OUT']).optional(),
  legalBasisExplanation: z.string().optional()
}).catchall(z.any())

server.tool("communications_get_preferences",
  "Get communication preferences for a contact",
  {
    contactId: z.string(),
    subscriptionId: z.string().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/status/email/${params.contactId}`
      if (params.subscriptionId) {
        return await makeApiRequestWithErrorHandling(`${endpoint}/subscription/${params.subscriptionId}`)
      }
      return await makeApiRequestWithErrorHandling(endpoint)
    })
  }
)

server.tool("communications_update_preferences",
  "Update communication preferences for a contact",
  {
    contactId: z.string(),
    subscriptionId: z.string(),
    preferences: communicationPreferencesSchema
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/status/email/${params.contactId}/subscription/${params.subscriptionId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PUT', params.preferences)
    })
  }
)

server.tool("communications_unsubscribe_contact",
  "Unsubscribe a contact from all email communications",
  {
    contactId: z.string(),
    portalSubscriptionLegalBasis: z.enum(['LEGITIMATE_INTEREST_CLIENT', 'LEGITIMATE_INTEREST_PUB', 'PERFORMANCE_OF_CONTRACT', 'CONSENT_WITH_NOTICE', 'CONSENT_WITH_NOTICE_AND_OPT_OUT']).optional(),
    portalSubscriptionLegalBasisExplanation: z.string().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/unsubscribe/email/${params.contactId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PUT', {
        portalSubscriptionLegalBasis: params.portalSubscriptionLegalBasis,
        portalSubscriptionLegalBasisExplanation: params.portalSubscriptionLegalBasisExplanation
      })
    })
  }
)

server.tool("communications_subscribe_contact",
  "Subscribe a contact to all email communications",
  {
    contactId: z.string(),
    portalSubscriptionLegalBasis: z.enum(['LEGITIMATE_INTEREST_CLIENT', 'LEGITIMATE_INTEREST_PUB', 'PERFORMANCE_OF_CONTRACT', 'CONSENT_WITH_NOTICE', 'CONSENT_WITH_NOTICE_AND_OPT_OUT']).optional(),
    portalSubscriptionLegalBasisExplanation: z.string().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/subscribe/email/${params.contactId}`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PUT', {
        portalSubscriptionLegalBasis: params.portalSubscriptionLegalBasis,
        portalSubscriptionLegalBasisExplanation: params.portalSubscriptionLegalBasisExplanation
      })
    })
  }
)

server.tool("communications_get_subscription_definitions",
  "Get all subscription definitions for the portal",
  {
    archived: z.boolean().optional()
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = '/communication-preferences/v3/definitions'
      return await makeApiRequestWithErrorHandling(endpoint, {
        archived: params.archived
      })
    })
  }
)

server.tool("communications_get_subscription_status",
  "Get subscription status for multiple contacts",
  {
    subscriptionId: z.string(),
    contactIds: z.array(z.string())
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/status/email/subscription/${params.subscriptionId}/bulk`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'POST', {
        contactIds: params.contactIds
      })
    })
  }
)

server.tool("communications_update_subscription_status",
  "Update subscription status for multiple contacts",
  {
    subscriptionId: z.string(),
    updates: z.array(z.object({
      contactId: z.string(),
      status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED', 'NOT_OPTED']),
      legalBasis: z.enum(['LEGITIMATE_INTEREST_CLIENT', 'LEGITIMATE_INTEREST_PUB', 'PERFORMANCE_OF_CONTRACT', 'CONSENT_WITH_NOTICE', 'CONSENT_WITH_NOTICE_AND_OPT_OUT']).optional(),
      legalBasisExplanation: z.string().optional()
    }))
  },
  async (params) => {
    return handleEndpoint(async () => {
      const endpoint = `/communication-preferences/v3/status/email/subscription/${params.subscriptionId}/bulk`
      return await makeApiRequestWithErrorHandling(endpoint, {}, 'PUT', {
        updates: params.updates
      })
    })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
