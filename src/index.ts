#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createStatelessServer } from "@smithery/sdk/server/stateless.js"
import { z } from "zod"
import { prompts } from "./prompts.js";

function formatResponse(data: any) {
  let text = ''

  if (typeof data === 'string') {
    text = data
  } else if (data === null || data === undefined) {
    text = "No data returned"
  } else if (typeof data === 'object') {
    text = JSON.stringify(data)
  } else {
    text = String(data)
  }

  return { content: [{ type: "text", text }] }
}

async function makeApiRequest(apiKey: string, endpoint: string, params: Record<string, any> = {}, method = 'GET', body: Record<string, any> | null = null) {
  if (!apiKey) {
    throw new Error("HUBSPOT_ACCESS_TOKEN environment variable is not set")
  }

  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) queryParams.append(key, value.toString())
  })

  const url = `https://api.hubapi.com${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }

  if (body) headers['Content-Type'] = 'application/json'

  const requestOptions: RequestInit = { method, headers }

  if (body) requestOptions.body = JSON.stringify(body)

  const response = await fetch(url, requestOptions)

  if (!response.ok) return `Error fetching data from HubSpot: Status ${response.status}`

  if (response.status === 204) return `No data returned: Status ${response.status}`

  return await response.json()
}

async function makeApiRequestWithErrorHandling(apiKey: string, endpoint: string, params: Record<string, any> = {}, method = 'GET', body: Record<string, any> | null = null) {
  try {
    const data = await makeApiRequest(apiKey, endpoint, params, method, body)
    return formatResponse(data)
  } catch (error: any) {
    return formatResponse(`Error performing request: ${error.message}`)
  }
}

async function handleEndpoint(apiCall: () => Promise<any>) {
  try {
    return await apiCall()
  } catch (error: any) {
    return formatResponse(error.message)
  }
}

function getConfig(config: any) {
  return {
    hubspotAccessToken: config?.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN
  }
}

function createServer({ config }: { config?: any } = {}) {
  const server = new McpServer({
    name: "HubSpot-MCP",
    version: "1.7.0",
    description: "An extensive MCP for the HubSpot API"
  })

  const { hubspotAccessToken } = getConfig(config)

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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken,  endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', params)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PUT', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', params)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', params)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        const subscriptionEndpointPath = params.subscriptionId ? `/subscription/${params.subscriptionId}` : ''
        const endpoint = `/communication-preferences/v3/status/email/${params.contactId}${subscriptionEndpointPath}`
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PUT', params.preferences)
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PUT', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PUT', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
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
        return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PUT', {
          updates: params.updates
        })
      })
    }
  )

  // Batch Product Endpoints: https://developers.hubspot.com/docs/reference/api/crm/objects/products#batch
  const productPropertiesSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    sku: z.string().optional(),
    hs_product_type: z.string().optional(),
    hs_recurring_billing_period: z.string().optional(),
  }).catchall(z.any())

  server.tool("products_batch_archive",
    "Archive a batch of products by ID",
    {
      productIds: z.array(z.string())
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products/batch/archive'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', { inputs: params.productIds.map(id => ({ id })) })
    })
  )

  server.tool("products_batch_create",
    "Create a batch of products",
    {
      inputs: z.array(z.object({ properties: productPropertiesSchema }))
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products/batch/create'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', { inputs: params.inputs })
    })
  )

  server.tool("products_batch_read",
    "Read a batch of products by internal ID, or unique property values. Retrieve records by the `idProperty` parameter to retrieve records by a custom unique value property.",
    {
      propertiesWithHistory: z.array(z.string()),
      idProperty: z.string().optional(),
      inputs: z.array(z.object({ id: z.string() })),
      properties: z.array(z.string())
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products/batch/read'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', { inputs: params.inputs })
    })
  )

  server.tool("products_batch_update",
    "Update a batch of products by internal ID, or unique values specified by the `idProperty` query param.",
    {
      inputs: z.array(z.object({
        id: z.string(),
        idProperty: z.string().optional(),
        objectWriteTraceId: z.string().optional(),
        properties: productPropertiesSchema
      }))
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products/batch/update'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', { inputs: params.inputs })
    })
  )

  // Basic Product Endpoints: https://developers.hubspot.com/docs/reference/api/crm/objects/products#basic
  server.tool("products_list",
    "Read a page of products. Control what is returned via the `properties` query param. `after` is the paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.",
    {
      limit: z.number().min(1).optional(),
      after: z.string().optional(),
      properties: z.array(z.string()).optional()
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
        limit: params.limit,
        after: params.after,
        properties: params.properties?.join(',')
      })
    })
  )

  server.tool("products_read",
    "Read an Object identified by ID",
    {
      productId: z.string(),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.string()).optional()
    },
    async params => handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/products/${params.productId}`
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {
        properties: params.properties?.join(','),
        associations: params.associations?.join(',')
      })
    })
  )

  server.tool("products_create",
    "Create a product with the given properties and return a copy of the object, including the ID.",
    { properties: productPropertiesSchema },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', { properties: params.properties })
    })
  )

  server.tool("products_update",
    "Perform a partial update of an Object identified by ID. Read-only and non-existent properties will result in an error. Properties values can be cleared by passing an empty string.",
    { productId: z.string(), properties: productPropertiesSchema    },
    async params => handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/products/${params.productId}`
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'PATCH', { properties: params.properties })
    })
  )

  server.tool("products_archive",
    "Move an Object identified by ID to the recycling bin.",
    { productId: z.string() },
    async params => handleEndpoint(async () => {
      const endpoint = `/crm/v3/objects/products/${params.productId}`
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'DELETE')
    })
  )

  server.tool("products_search",
    "Search products",
    {
      query: z.string().optional(),
      limit: z.number().min(1).optional(),
      after: z.string().optional(),
      sorts: z.array(z.string()).optional(),
      properties: z.array(z.string()).optional(),
      filterGroups: z.array(z.object({
        filters: z.array(z.object({
          propertyName: z.string(),
          operator: z.enum(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']),
          value: z.any().optional(),
          values: z.array(z.any()).optional()
        }))
      })),
    },
    async params => handleEndpoint(async () => {
      const endpoint = '/crm/v3/objects/products/search'
      return await makeApiRequestWithErrorHandling(hubspotAccessToken, endpoint, {}, 'POST', {
        filterGroups: params.filterGroups,
        properties: params.properties,
        limit: params.limit,
        after: params.after,
        sorts: params.sorts
      })
    })
  )


  // Register each prompt directly with the server using the MCP standard way
  // 1. Process Lead List prompt
  server.prompt(
    "process_lead_list",
    { list: z.string() },
    ({ list }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need to process this lead data into my HubSpot CRM. As a HubSpot database update specialist, please:

1. ANALYZE the input data format (CSV, TSV, or other delimiter)
2. IDENTIFY contacts, companies, and engagement information
3. CHECK if records already exist before creating (using email for contacts, domain/name for companies)
4. CREATE new records only when necessary, otherwise UPDATE existing ones
5. ESTABLISH proper associations between contacts and companies
6. MAINTAIN data integrity (use exact values provided, never invent data)
7. HANDLE errors gracefully with clear explanations
8. REPORT results with summary statistics (records created, updated, errors)

Here's my lead data:

\`\`\`
${list}
\`\`\`

When finished, provide a summary of what was created, updated, and any errors encountered.`
          }
        }
      ]
    })
  );

  // 2. Update Company Info prompt
  server.prompt(
    "update_company_info",
    { companyInfo: z.string() },
    ({ companyInfo }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot company data specialist, please update this company information with the following workflow:

1. VALIDATE input data format and required fields
2. IDENTIFY the company by company ID, domain, or name
3. SEARCH for the company first to verify it exists
4. UPDATE only the fields provided (never override with blank values)
5. MAP common field variations to HubSpot properties (e.g., 'phone_number' → 'phone')
6. VALIDATE property values against HubSpot requirements
7. MAINTAIN industry standards for formats (phone numbers, addresses, etc.)
8. REPORT success or specific errors with recommended resolutions

Here's the company information to update:

\`\`\`
${companyInfo}
\`\`\``
          }
        }
      ]
    })
  );

  // 3. Log Engagement prompt
  server.prompt(
    "log_engagement",
    { engagementDetails: z.string() },
    ({ engagementDetails }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot engagement specialist, please log this engagement with the following workflow:

1. IDENTIFY the engagement type (call, email, meeting, note, or task)
2. VALIDATE required fields for that specific engagement type
3. VERIFY the associated contact or company exists first (search by ID, email, or domain)
4. CREATE the engagement with proper metadata and timestamps
5. ASSOCIATE with the correct contacts, companies, deals, or tickets
6. SET proper engagement status (completed, scheduled, etc.)
7. FORMAT the content according to best practices
8. CONFIRM successful creation with engagement ID and summary

SPECIFIC REQUIREMENTS BY ENGAGEMENT TYPE:
- calls: requires title, timestamp, status (complete/scheduled), duration, outcome
- meetings: requires title, start/end time, description, location (physical/virtual)
- emails: requires from, to, cc, subject, html/text content, timestamp
- notes: requires title, content, timestamp, associated objects
- tasks: requires title, type, due date, owner, priority, status

Here's the engagement to log:

\`\`\`
${engagementDetails}
\`\`\``
          }
        }
      ]
    })
  );

  // 4. Bulk Update Contacts prompt
  server.prompt(
    "bulk_update_contacts",
    { contactsList: z.string() },
    ({ contactsList }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot contact management specialist focusing on high-volume updates, please process this list of contacts with the following optimized workflow:

1. PARSE the input data into a structured format (detect CSV, JSON, etc.)
2. VALIDATE contact identifiers (email required, others optional)
3. ORGANIZE contacts into optimal batches (max 100 per batch for HubSpot API)
4. CHECK for existing contacts using batch search operations
5. SEPARATE into creation and update batches based on existence
6. TRANSFORM data to match HubSpot property names
7. VALIDATE email format, phone numbers, and other structured fields
8. EXECUTE batch operations with error handling
9. TRACK progress and identify any failed records
10. PROVIDE detailed summary with success/failure counts and specific errors

OPTIMIZATION TECHNIQUES:
- Use crm_batch_* operations rather than individual calls
- Prioritize email as the primary identifier
- Handle duplicates by merging or using most recent data
- Implement proper error handling with retry logic for failed records

Here's the contact list to process:

\`\`\`
${contactsList}
\`\`\`

When complete, give me a summary of how many were updated successfully and any issues encountered.`
          }
        }
      ]
    })
  );

  // 5. Associate Contacts Companies prompt
  server.prompt(
    "associate_contacts_companies",
    { associations: z.string() },
    ({ associations }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot association expert, please create proper relationships between these contacts and companies following this workflow:

1. PARSE the relationship definitions (contacts and companies)
2. VERIFY both contacts and companies exist in HubSpot (search by email/domain/ID)
3. CHECK if associations already exist before creating
4. DETERMINE the appropriate association types (primary, secondary, etc.)
5. CREATE associations with the correct labels and categories
6. USE batch operations for efficiency when possible
7. VERIFY creation with association ID confirmation
8. HANDLE special cases like multiple associations or contact transfers

ASSOCIATION TYPE REFERENCE:
- Primary association types:
  * contact_to_company: Primary company relationship
  * company_to_contact: Primary contact relationship

- Association categories and labels:
  * 1 (Standard): Default association
  * 5 (Employer): Employee to employer relationship
  * 8 (Advisor): Advisory relationship
  * 9 (Contractor): Contract worker relationship

Here are the associations to create:

\`\`\`
${associations}
\`\`\`

When finished, confirm the associations were created successfully and provide association IDs if available.`
          }
        }
      ]
    })
  );

  // 6. Manage Deals Pipeline prompt
  server.prompt(
    "manage_deals_pipeline",
    { dealOperations: z.string() },
    ({ dealOperations }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot deal management specialist, please help me with these deal operations following this workflow:

1. IDENTIFY the deal operation (create, update, move stage, close)
2. VALIDATE required deal properties (name, amount, stage, etc.)
3. VERIFY associated contacts and companies exist first
4. PERFORM the requested deal operation with proper stage transitions
5. UPDATE forecasting and probability based on stage changes
6. MAINTAIN timeline with appropriate deal stage changes
7. CREATE or UPDATE associated line items if provided
8. PROVIDE summary with deal status, stage, and next recommended actions

DEAL STAGES REFERENCE:
- appointmentscheduled: Qualified to buy, appointment scheduled
- qualifiedtobuy: Qualified to buy, no appointment yet
- presentationscheduled: Presentation scheduled
- decisionmakerboughtin: Decision maker bought-in
- contractsent: Contract sent
- closedwon: Closed won
- closedlost: Closed lost

KEY DEAL PROPERTIES:
- dealname: Name/title of the deal
- amount: Deal value amount (number only)
- dealstage: Current stage in pipeline (from stages above)
- closedate: Expected close date (YYYY-MM-DD)
- pipeline: Pipeline ID (default is 'default')
- dealtype: Type of deal (new, existing, etc.)
- priority: Deal priority (low, medium, high)

Here are the deal operations to perform:

\`\`\`
${dealOperations}
\`\`\``
          }
        }
      ]
    })
  );

  // 7. Manage Marketing Preferences prompt
  server.prompt(
    "manage_marketing_preferences",
    { marketingPreferences: z.string() },
    ({ marketingPreferences }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `As a HubSpot compliance specialist focusing on marketing preferences, please update these contact preferences following this strict privacy-oriented workflow:

1. IDENTIFY the contact(s) by email address (required field)
2. VERIFY each contact exists in HubSpot before updating
3. VALIDATE that consent changes include timestamp and source information
4. UPDATE subscription preferences with proper legal basis
5. MAINTAIN audit trail for all consent changes
6. ENSURE GDPR/CCPA/CASL compliance for all updates
7. HANDLE special cases (unsubscribe-all, resubscribe, etc.)
8. PROVIDE privacy-compliant confirmation of changes

SUBSCRIPTION TYPES:
- EMAIL: Email marketing communications
- WORKFLOW: Automated workflow emails
- SMS: Text message marketing
- CALL: Phone call marketing
- GDPRSTATUS: Overall GDPR status

LEGAL BASIS OPTIONS:
- LEGITIMATE_INTEREST: Legitimate business interest
- PERFORMANCE_OF_CONTRACT: Necessary for contract
- CONSENT: Explicit consent provided
- LEGAL_OBLIGATION: Required by law

STATUS OPTIONS:
- SUBSCRIBED: Actively subscribed
- UNSUBSCRIBED: Explicitly unsubscribed
- NOT_OPTED: No preference specified
- OPT_IN: Pending double opt-in

Here are the marketing preferences to update:

\`\`\`
${marketingPreferences}
\`\`\``
          }
        }
      ]
    })
  );

  return server.server
}

// Stdio Server 
const stdioServer = createServer({})
const transport = new StdioServerTransport()
await stdioServer.connect(transport)

// Streamable HTTP Server
const { app } = createStatelessServer(createServer)
const PORT = process.env.PORT || 3000
app.listen(PORT)
