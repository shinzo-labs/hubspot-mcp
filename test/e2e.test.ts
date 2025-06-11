import { StdioClientTransport, StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { CallToolRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import path from 'path'

const RESPONSE_TIMEOUT = 1_000 // 1s
const START_DELAY = 1_000 // 1s
const TEST_TIMEOUT = 10_000 // 10s
const SEARCH_DELAY = 8 // 8s

const TOTAL_TOOLS = 112

const streamableClientUrl = new URL(`http://localhost:${process.env.PORT || 3000}/mcp`)

jest.setTimeout(TEST_TIMEOUT)

type ReadMessageType = {
  jsonrpc: string
  id: number
  result: {
    content?: {
      type: string
      text: string
    }[],
    tools?: any[]
  }
}

type JSONRPCMessageWithParams = JSONRPCMessage & {
  params?: CallToolRequest["params"]
}

// In some tests the argument IDs in this object are modified, ensure the ID is always set per-test where relevant
const jsonRpcMessage: Record<string, JSONRPCMessageWithParams> = {
  ping: { jsonrpc: "2.0", id: 1, method: "ping" },
  pong: { jsonrpc: '2.0', id: 1, result: {} },
  toolsList: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  crmCreateCompany: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_create_company",
    arguments: {
      properties: {
        name: "Test Company",
        domain: "test.com",
        website: "https://test.com",
        description: "Test Description",
        industry: "CONSUMER_SERVICES",
        numberofemployees: 10,
        annualrevenue: 100000,
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        phone: "1234567890",
        address: "Test Address",
        address2: "Test Address 2",
        zip: "123456",
        type: "PARTNER",
        lifecyclestage: "lead"
      }
    }
  } },
  crmGetCompany: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_get_company",
    arguments: {
      companyId: "test-id"
    }
  } },
  crmUpdateCompany: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_update_company",
    arguments: {
      companyId: "test-id",
      properties: {
        name: "Test Company Updated"
      }
    }
  } },
  crmSearchCompanies: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_search_companies",
    arguments: {
      filterGroups: [{
        filters: [{
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value: "Test Company"
        }]
      }]
    }
  } },
  crmArchiveObject: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_archive_object",
    arguments: {
      objectType: "companies",
      objectId: "test-id"
    }
  } },
  productsCreate: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_create",
    arguments: {
      properties: {
        name: "Test Product"
      }
    }
  } },
  productsRead: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_read",
    arguments: {
      productId: "test-id"
    }
  } },
  productsUpdate: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_update",
    arguments: {
      productId: "test-id",
      properties: {
        name: "Test Product Updated"
      }
    }
  } },
  productsList: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_list",
    arguments: {
      limit: 100,
      properties: ["name", "description"]
    }
  } },
  productsSearch: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_search",
    arguments: {
      limit: 100,
      properties: ["name", "description"],
      filterGroups: [{
        filters: [{
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value: "Test Product"
        }]
      }]
    }
  } },
  productsArchive: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_archive",
    arguments: {
      productId: "test-id"
    }
  } },
  productsBatchCreate: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_batch_create",
    arguments: {
      inputs: [
        { properties: { name: "Test Product" } },
        { properties: { name: "Test Product 2" } }
      ]
    }
  } },
  productsBatchRead: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_batch_read",
    arguments: {
      propertiesWithHistory: [],
      properties: ["name"]
    }
  } },
  productsBatchUpdate: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_batch_update",
    arguments: {}
  } },
  productsBatchUpsert: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_batch_upsert",
    arguments: {}
  } },
  productsBatchArchive: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "products_batch_archive",
    arguments: {}
  } },
  crmBatchReadObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_batch_read_objects",
    arguments: {
      objectType: "companies",
      propertiesWithHistory: ["name", "domain"],
      inputs: [{ id: "test-id" }],
      properties: ["name", "domain"]
    }
  } },
  crmListObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_list_objects",
    arguments: {
      objectType: "companies",
      limit: 100,
      properties: ["name", "domain"]
    }
  } },
  crmCreateObject: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_create_object",
    arguments: {
      objectType: "companies",
      properties: {
        name: "Test Company",
        domain: "test.com",
        website: "https://test.com",
        description: "Test Description",
        industry: "CONSUMER_SERVICES",
        numberofemployees: 10,
        annualrevenue: 100000,
        city: "Test City",
        state: "Test State",
        country: "Test Country",
        phone: "1234567890",
        address: "Test Address",
        address2: "Test Address 2",
        zip: "123456",
        type: "PARTNER",
        lifecyclestage: "lead"
      }
    }
  } },
  crmGetObject: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_get_object",
    arguments: {
      objectType: "companies",
      objectId: "test-id",
      properties: ["name", "domain"]
    }
  } },
  crmUpdateObject: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_update_object",
    arguments: {
      objectType: "companies",
      objectId: "test-id",
      properties: {
        name: "Test Company Updated",
        domain: "updated-test.com"
      }
    }
  } },
  crmSearchObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_search_objects",
    arguments: {
      objectType: "companies",
      filterGroups: [{
        filters: [{
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value: "Test Company"
        }]
      }],
      properties: ["name", "domain"]
    }
  } },
  crmBatchCreateObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_batch_create_objects",
    arguments: {
      objectType: "companies",
      inputs: [
        { properties: { name: "Test Company 1", domain: "test1.com", type: "PARTNER", lifecyclestage: "lead" } },
        { properties: { name: "Test Company 2", domain: "test2.com", type: "PARTNER", lifecyclestage: "lead" } }
      ]
    }
  } },
  crmBatchUpdateObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_batch_update_objects",
    arguments: {
      objectType: "companies",
      inputs: [
        { id: "test-id", properties: { name: "Updated Company 1", type: "PARTNER" } },
        { id: "test-id", properties: { name: "Updated Company 2", type: "PARTNER" } }
      ]
    }
  } },
  crmBatchArchiveObjects: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_batch_archive_objects",
    arguments: {
      objectType: "companies",
      inputs: [{ id: "test-id" }]
    }
  } }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Hubspot MCP', () => {
  let stdioClient: StdioClientTransport

  beforeAll(async () => {
    const serverParameters: StdioServerParameters = {
      command: "node",
      args: [path.resolve(__dirname, '../dist/index.js')],
      env: process.env as Record<string, string>
    }

    stdioClient = new StdioClientTransport(serverParameters)
    await stdioClient.start()
  })

  afterAll(async () => {
    await stdioClient.close()
  })

  describe('Stdio Transport', () => {
    let readMessages: ReadMessageType[]
    let errors: Error[]
    let companyId: string
    let productId: string
    let batchProductIds: string[]
    let crmObjectId: string
    let crmBatchObjectIds: string[]

    beforeAll(async () => {
      await delay(START_DELAY)
      stdioClient.onmessage = (message) => readMessages.push(message as ReadMessageType)
      stdioClient.onerror = (error) => errors.push(error)
    })

    beforeEach(async () => {
      readMessages = []
      errors = []
    })

  it('can call the crm_get_quote tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1001,
    method: "tools/call",
    params: {
      name: "crm_get_quote",
      arguments: {
        quoteId: "test-id"
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const quote = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(quote.id).toBeDefined()
  readMessages = []
})

it('can call the crm_list_quotes tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1002,
    method: "tools/call",
    params: {
      name: "crm_list_quotes",
      arguments: {
        limit: 10,
        properties: ["hs_title"]
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(Array.isArray(result.results)).toBe(true)
  readMessages = []
})

it('can call the crm_get_meeting tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1003,
    method: "tools/call",
    params: {
      name: "crm_get_meeting",
      arguments: {
        meetingId: "test-id"
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const meeting = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(meeting.id).toBeDefined()
  readMessages = []
})

it('can call the crm_list_meetings tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1004,
    method: "tools/call",
    params: {
      name: "crm_list_meetings",
      arguments: {
        limit: 5,
        properties: ["hs_meeting_title", "hs_meeting_start_time"]
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(Array.isArray(result.results)).toBe(true)
  readMessages = []
})

it('can call the crm_get_ticket tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1005,
    method: "tools/call",
    params: {
      name: "crm_get_ticket",
      arguments: {
        ticketId: "test-id"
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const ticket = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(ticket.id).toBeDefined()
  readMessages = []
})

it('can call the crm_list_tickets tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1006,
    method: "tools/call",
    params: {
      name: "crm_list_tickets",
      arguments: {
        limit: 5,
        properties: ["subject", "content"]
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(Array.isArray(result.results)).toBe(true)
  readMessages = []
})

it('can call the crm_get_call tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1007,
    method: "tools/call",
    params: {
      name: "crm_get_call",
      arguments: {
        callId: "test-id"
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const call = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(call.id).toBeDefined()
  readMessages = []
})

it('can call the crm_list_calls tool', async () => {
  stdioClient.send({
    jsonrpc: "2.0",
    id: 1008,
    method: "tools/call",
    params: {
      name: "crm_list_calls",
      arguments: {
        limit: 5,
        properties: ["status", "durationMilliseconds"]
      }
    }
  })
  await delay(RESPONSE_TIMEOUT)

  expect(readMessages).toHaveLength(1)
  const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
  expect(Array.isArray(result.results)).toBe(true)
  readMessages = []
})




    it('responds to ping', async () => {
      stdioClient.send(jsonRpcMessage.ping)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0]).toEqual(jsonRpcMessage.pong)
      expect(errors).toHaveLength(0)
    })

    it('returns a list of tools', async () => {
      stdioClient.send(jsonRpcMessage.toolsList)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.tools?.length).toEqual(TOTAL_TOOLS)
    })

    it('can call the crm_create_company tool', async () => {
      stdioClient.send(jsonRpcMessage.crmCreateCompany)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const company = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
      companyId = company.id
    })

    it('can call the crm_get_company tool', async () => {
      if (!jsonRpcMessage.crmGetCompany.params?.arguments) throw new Error('Missing params or arguments')
      jsonRpcMessage.crmGetCompany.params.arguments.companyId = companyId
      stdioClient.send(jsonRpcMessage.crmGetCompany)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const company = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
    })

    it('can call the crm_update_company tool', async () => {
      const params = jsonRpcMessage.crmUpdateCompany.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.companyId = companyId
      stdioClient.send(jsonRpcMessage.crmUpdateCompany)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const updated = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(updated.properties.name).toEqual('Test Company Updated')
    })

    it('can call the crm_search_companies tool', async () => {
      await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait additional time to ensure the company is indexed
      stdioClient.send(jsonRpcMessage.crmSearchCompanies)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const results = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(companyId)
    })

    it('can call the crm_archive_object tool', async () => {
      const params = jsonRpcMessage.crmArchiveObject.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.objectId = companyId
      stdioClient.send(jsonRpcMessage.crmArchiveObject)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)
      expect(readMessages[0].result.content?.[0].text).toEqual(`No data returned: Status 204`)
    })

    it('can call the products_create tool', async () => {
      stdioClient.send(jsonRpcMessage.productsCreate)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const product = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(product.properties.name).toEqual('Test Product')
      productId = product.id
    })

    it('can call the products_read tool', async () => {
      const params = jsonRpcMessage.productsRead.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      stdioClient.send(jsonRpcMessage.productsRead)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const product = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(product.properties.name).toEqual('Test Product')
    })

    it('can call the products_update tool', async () => {
      const params = jsonRpcMessage.productsUpdate.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      stdioClient.send(jsonRpcMessage.productsUpdate)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const updated = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(updated.properties.name).toEqual('Test Product Updated')
    })

    it('can call the products_list tool', async () => {
      stdioClient.send(jsonRpcMessage.productsList)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const results = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
    })

    it('can call the products_search tool', async () => {
      await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait additional time to ensure the product is indexed
      stdioClient.send(jsonRpcMessage.productsSearch)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const results = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(productId)
    })

    it('can call the products_archive tool', async () => {
      const params = jsonRpcMessage.productsArchive.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      stdioClient.send(jsonRpcMessage.productsArchive)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)
      expect(readMessages[0].result.content?.[0].text).toEqual(`No data returned: Status 204`)
    })

    it('can call the products_batch_create tool', async () => {
      stdioClient.send(jsonRpcMessage.productsBatchCreate)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
      batchProductIds = result.results.map((p: any) => p.id)
    })

    it('can call the products_batch_read tool', async () => {
      const params = jsonRpcMessage.productsBatchRead.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productIds = batchProductIds
      stdioClient.send(jsonRpcMessage.productsBatchRead)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('can call the products_batch_update tool', async () => {
      const params = jsonRpcMessage.productsBatchUpdate.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.inputs = batchProductIds.map(id => ({ 
        id, 
        properties: { name: `Batch Updated Product ${id}` }
      }))
      stdioClient.send(jsonRpcMessage.productsBatchUpdate)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('can call the products_batch_archive tool', async () => {
      const params = jsonRpcMessage.productsBatchArchive.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productIds = batchProductIds
      stdioClient.send(jsonRpcMessage.productsBatchArchive)
      await delay(RESPONSE_TIMEOUT)
      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)
    })

    describe('CRM Object Operations', () => {
      it('can call the crm_create_object tool', async () => {
        stdioClient.send(jsonRpcMessage.crmCreateObject)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company')
        expect(result.properties.domain).toEqual('test.com')
        crmObjectId = result.id
      })

      it('can call the crm_get_object tool', async () => {
        const params = jsonRpcMessage.crmGetObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        stdioClient.send(jsonRpcMessage.crmGetObject)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company')
        expect(result.properties.domain).toEqual('test.com')
      })

      it('can call the crm_update_object tool', async () => {
        const params = jsonRpcMessage.crmUpdateObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        stdioClient.send(jsonRpcMessage.crmUpdateObject)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company Updated')
        expect(result.properties.domain).toEqual('updated-test.com')
      })

      it('can call the crm_search_objects tool', async () => {
        await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait for indexing
        stdioClient.send(jsonRpcMessage.crmSearchObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results[0].id).toEqual(crmObjectId)
      })

      it('can call the crm_list_objects tool', async () => {
        stdioClient.send(jsonRpcMessage.crmListObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBeGreaterThan(0)
        const foundObject = result.results.find((obj: any) => obj.id === crmObjectId)
        expect(foundObject).toBeDefined()
      })

      it('can call the crm_batch_create_objects tool', async () => {
        stdioClient.send(jsonRpcMessage.crmBatchCreateObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
        crmBatchObjectIds = result.results.map((obj: any) => obj.id)
      })

      it('can call the crm_batch_read_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchReadObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectIds = crmBatchObjectIds
        stdioClient.send(jsonRpcMessage.crmBatchReadObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
        expect(result.results[0].properties.name).toBeDefined()
        expect(result.results[0].properties.domain).toBeDefined()
        expect(result.results[1].properties.name).toBeDefined()
        expect(result.results[1].properties.domain).toBeDefined()
      })

      it('can call the crm_batch_update_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchUpdateObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.inputs = crmBatchObjectIds.map((id, index) => ({
          id,
          properties: { name: `Updated Company ${index + 1}`, type: "PARTNER" }
        }))
        stdioClient.send(jsonRpcMessage.crmBatchUpdateObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)

        const result = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
      })

      it('can call the crm_batch_archive_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchArchiveObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectIds = crmBatchObjectIds
        stdioClient.send(jsonRpcMessage.crmBatchArchiveObjects)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)
      })

      it('can call the crm_archive_object tool', async () => {
        const params = jsonRpcMessage.crmArchiveObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        stdioClient.send(jsonRpcMessage.crmArchiveObject)
        await delay(RESPONSE_TIMEOUT)
        expect(readMessages).toHaveLength(1)
        expect(readMessages[0].result.content?.length).toEqual(1)
        expect(readMessages[0].result.content?.[0].text).toEqual(`No data returned: Status 204`)
      })
    })
  })

  describe('Streamable HTTP Transport', () => {
    let streamableClient: Client = new Client({
      name: 'streamable-test-client',
      version: '1.0.0'
    })

    let companyId: string
    let productId: string
    let batchProductIds: string[]
    let crmObjectId: string
    let crmBatchObjectIds: string[]

    beforeAll(async () => {
      let transport = new StreamableHTTPClientTransport(streamableClientUrl)
      await streamableClient.connect(transport)
    })

    it('responds to ping', async () => {
      const response = await streamableClient.ping()
      expect(response).toEqual({})
    })

    it('returns a list of tools', async () => {
      const response = await streamableClient.listTools()
      expect(response.tools.length).toEqual(TOTAL_TOOLS)
    })

    it('can call the crm_create_company tool', async () => {
      const params = jsonRpcMessage.crmCreateCompany.params as CallToolRequest["params"]
      const response = await streamableClient.callTool(params)
      const company = JSON.parse(response.content?.[0].text ?? '{}')
      expect(response.content?.[0].type).toBe('text')

      companyId = company.id
    })

    it('can call the crm_get_company tool', async () => {
      const params = jsonRpcMessage.crmGetCompany.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.companyId = companyId
      const response = await streamableClient.callTool(params)

      const company = JSON.parse(response.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
    })

    it('can call the crm_update_company tool', async () => {
      const params = jsonRpcMessage.crmUpdateCompany.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.companyId = companyId
      const response = await streamableClient.callTool(params)

      const updated = JSON.parse(response.content?.[0].text ?? '{}')
      expect(updated.properties.name).toEqual('Test Company Updated')
    })

    it('can call the crm_search_companies tool', async () => {
      await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait additional time to ensure the company is indexed
      const params = jsonRpcMessage.crmSearchCompanies.params as CallToolRequest["params"]
      const response = await streamableClient.callTool(params)

      const results = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(companyId)
    })

    it('can call the crm_archive_object tool', async () => {
      if (!companyId) throw new Error('No company ID available')
      const params = jsonRpcMessage.crmArchiveObject.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.objectId = companyId
      const response = await streamableClient.callTool(params)
      expect(response.content?.[0].text).toEqual(`No data returned: Status 204`)
    })

    it('can call the products_create tool', async () => {
      const params = jsonRpcMessage.productsCreate.params as CallToolRequest["params"]
      const response = await streamableClient.callTool(params)

      const product = JSON.parse(response.content?.[0].text ?? '{}')
      expect(product.properties.name).toEqual('Test Product')
      productId = product.id
    })

    it('can call the products_read tool', async () => {
      const params = jsonRpcMessage.productsRead.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      const response = await streamableClient.callTool(params)

      const product = JSON.parse(response.content?.[0].text ?? '{}')
      expect(product.properties.name).toEqual('Test Product')
    })

    it('can call the products_update tool', async () => {
      const params = jsonRpcMessage.productsUpdate.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      const response = await streamableClient.callTool(params)

      const updated = JSON.parse(response.content?.[0].text ?? '{}')
      expect(updated.properties.name).toEqual('Test Product Updated')
    })

    it('can call the products_list tool', async () => {
      const params = jsonRpcMessage.productsList.params as CallToolRequest["params"]
      const response = await streamableClient.callTool(params)

      const results = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(productId)
    })

    it('can call the products_search tool', async () => {
      await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait additional time to ensure the product is indexed
      const params = jsonRpcMessage.productsSearch.params as CallToolRequest["params"]
      const response = await streamableClient.callTool(params)

      const results = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(productId)
    })

    it('can call the products_archive tool', async () => {
      const params = jsonRpcMessage.productsArchive.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productId = productId
      const response = await streamableClient.callTool(params)

      expect(response.content?.[0].text).toEqual(`No data returned: Status 204`)
    })

    it('can call the products_batch_create tool', async () => {
      const params = jsonRpcMessage.productsBatchCreate.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.inputs = [
        { properties: { name: "Test Product" } },
        { properties: { name: "Test Product 2" } }
      ]
      const response = await streamableClient.callTool(params)

      const result = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
      batchProductIds = result.results.map((p: any) => p.id)
    })

    it('can call the products_batch_read tool', async () => {
      const params = jsonRpcMessage.productsBatchRead.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productIds = batchProductIds
      const response = await streamableClient.callTool(params)

      const result = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('can call the products_batch_update tool', async () => {
      const params = jsonRpcMessage.productsBatchUpdate.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.inputs = batchProductIds.map(id => ({ 
        id, 
        properties: { name: `Batch Updated Product ${id}` }
      }))
      const response = await streamableClient.callTool(params)

      const result = JSON.parse(response.content?.[0].text ?? '{}')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('can call the products_batch_archive tool', async () => {
      const params = jsonRpcMessage.productsBatchArchive.params as CallToolRequest["params"]
      if (params?.arguments) params.arguments.productIds = batchProductIds
      const response = await streamableClient.callTool(params)

      expect(response.content?.[0].text).toEqual(`No data returned: Status 204`)
    })

    describe('CRM Object Operations', () => {
      it('can call the crm_create_object tool', async () => {
        const params = jsonRpcMessage.crmCreateObject.params as CallToolRequest["params"]
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company')
        expect(result.properties.domain).toEqual('test.com')
        crmObjectId = result.id
      })

      it('can call the crm_get_object tool', async () => {
        const params = jsonRpcMessage.crmGetObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company')
        expect(result.properties.domain).toEqual('test.com')
      })

      it('can call the crm_update_object tool', async () => {
        const params = jsonRpcMessage.crmUpdateObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(result.properties.name).toEqual('Test Company Updated')
        expect(result.properties.domain).toEqual('updated-test.com')
      })

      it('can call the crm_search_objects tool', async () => {
        await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait for indexing
        const params = jsonRpcMessage.crmSearchObjects.params as CallToolRequest["params"]
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results[0].id).toEqual(crmObjectId)
      })

      it('can call the crm_list_objects tool', async () => {
        const params = jsonRpcMessage.crmListObjects.params as CallToolRequest["params"]
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBeGreaterThan(0)
        const foundObject = result.results.find((obj: any) => obj.id === crmObjectId)
        expect(foundObject).toBeDefined()
      })

      it('can call the crm_batch_create_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchCreateObjects.params as CallToolRequest["params"]
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
        crmBatchObjectIds = result.results.map((obj: any) => obj.id)
      })

      it('can call the crm_batch_read_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchReadObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectIds = crmBatchObjectIds
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
        expect(result.results[0].properties.name).toBeDefined()
        expect(result.results[0].properties.domain).toBeDefined()
        expect(result.results[1].properties.name).toBeDefined()
        expect(result.results[1].properties.domain).toBeDefined()
      })

      it('can call the crm_batch_update_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchUpdateObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.inputs = crmBatchObjectIds.map((id, index) => ({
          id,
          properties: { name: `Updated Company ${index + 1}`, type: "PARTNER" }
        }))
        const response = await streamableClient.callTool(params)

        const result = JSON.parse(response.content?.[0].text ?? '{}')
        expect(Array.isArray(result.results)).toBe(true)
        expect(result.results.length).toBe(2)
      })

      it('can call the crm_batch_archive_objects tool', async () => {
        const params = jsonRpcMessage.crmBatchArchiveObjects.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectIds = crmBatchObjectIds
        const response = await streamableClient.callTool(params)

        expect(response.content?.[0].text).toEqual(`No data returned: Status 204`)
      })

      it('can call the crm_archive_object tool', async () => {
        const params = jsonRpcMessage.crmArchiveObject.params as CallToolRequest["params"]
        if (params?.arguments) params.arguments.objectId = crmObjectId
        const response = await streamableClient.callTool(params)

        expect(response.content?.[0].text).toEqual(`No data returned: Status 204`)
      })
    })
  })
})
