import { StdioClientTransport, StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import path from 'path'

const RESPONSE_TIMEOUT = 1_000 // 1s
const START_DELAY = 1_000 // 1s
const TEST_TIMEOUT = 10_000 // 10s
const SEARCH_DELAY = 8 // 10s

const TOTAL_TOOLS = 101

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

// In some tests the argument IDs in this object are modified, ensure the ID is always set per-test where relevant
const jsonRpcMessage: Record<string, JSONRPCMessage> = {
  ping: { jsonrpc: "2.0", id: 1, method: "ping" },
  pong: { jsonrpc: '2.0', id: 1, result: {} },
  initialize: {
    jsonrpc: "2.0", id: 1, method: "initialize", params: {
      clientInfo: { name: "test-client", version: "1.0" },
      protocolVersion: "2025-05-13",
      capabilities: {},
    }
  },
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
  crmDeleteObject: { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "crm_delete_object",
    arguments: {
      objectType: "companies",
      objectId: "test-id"
    }
  } }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const sendPostRequest = async (message: JSONRPCMessage | JSONRPCMessage[], sessionId?: string) => (
  fetch(streamableClientUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(message),
  })
)

const getSSEData = async (response: Response) => {
  const reader = response.body?.getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader!.read()
    if (done) break
    buffer += new TextDecoder().decode(value)

    const lines = buffer.split('\n')
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          return JSON.parse(line.slice(5).trim())
        } catch (e) {
          // Ignore and continue accumulating
        }
      }
    }
    // Keep only the last (possibly incomplete) line in buffer
    buffer = lines[lines.length - 1]
  }
  throw new Error('No complete data line found')
}

describe('Hubspot MCP', () => {
  let stdioClient: StdioClientTransport
  let streamableClient: StreamableHTTPClientTransport

  beforeAll(async () => {
    const serverParameters: StdioServerParameters = {
      command: "node",
      args: [path.resolve(__dirname, '../dist/index.js')],
      env: process.env as Record<string, string>
    }

    stdioClient = new StdioClientTransport(serverParameters)
    await stdioClient.start()
    streamableClient = new StreamableHTTPClientTransport(streamableClientUrl)
  })

  afterAll(async () => {
    await stdioClient.close()
  })

  describe('Stdio Transport', () => {
    let readMessages: ReadMessageType[]
    let errors: Error[]
    let companyId: string

    beforeAll(async () => {
      await delay(START_DELAY)
      stdioClient.onmessage = (message) => readMessages.push(message as ReadMessageType)
      stdioClient.onerror = (error) => errors.push(error)
    })

    beforeEach(async () => {
      readMessages = []
      errors = []
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
      jsonRpcMessage.crmGetCompany["params"].arguments.companyId = companyId
      stdioClient.send(jsonRpcMessage.crmGetCompany)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)

      const company = JSON.parse(readMessages[0].result.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
    })

    it('can call the crm_update_company tool', async () => {
      jsonRpcMessage.crmUpdateCompany["params"].arguments.companyId = companyId
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

    it('can call the crm_delete_object tool', async () => {
      jsonRpcMessage.crmDeleteObject["params"].arguments.objectId = companyId
      stdioClient.send(jsonRpcMessage.crmDeleteObject)
      await delay(RESPONSE_TIMEOUT)

      expect(readMessages).toHaveLength(1)
      expect(readMessages[0].result.content?.length).toEqual(1)
      expect(readMessages[0].result.content?.[0].text).toEqual(`No data returned: Status 204`)
    })
  })

  describe('Streamable HTTP Transport', () => {
    let companyId: string

    it('responds to ping', async () => {
      const response = await sendPostRequest(jsonRpcMessage.ping)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse).toEqual(jsonRpcMessage.pong)
    })

    it('returns a list of tools', async () => {
      const response = await sendPostRequest(jsonRpcMessage.toolsList)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.tools?.length).toEqual(TOTAL_TOOLS)
    })

    it('can call the crm_create_company tool', async () => {
      const response = await sendPostRequest(jsonRpcMessage.crmCreateCompany)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.content?.length).toEqual(1)

      const company = JSON.parse(sseResponse.result.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
      companyId = company.id
    })

    it('can call the crm_get_company tool', async () => {
      jsonRpcMessage.crmGetCompany["params"].arguments.companyId = companyId
      const response = await sendPostRequest(jsonRpcMessage.crmGetCompany)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.content?.length).toEqual(1)

      const company = JSON.parse(sseResponse.result.content?.[0].text ?? '{}')
      expect(company.properties.name).toEqual('Test Company')
    })

    it('can call the crm_update_company tool', async () => {
      jsonRpcMessage.crmUpdateCompany["params"].arguments.companyId = companyId
      const response = await sendPostRequest(jsonRpcMessage.crmUpdateCompany)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.content?.length).toEqual(1)

      const updated = JSON.parse(sseResponse.result.content?.[0].text ?? '{}')
      expect(updated.properties.name).toEqual('Test Company Updated')
    })

    it('can call the crm_search_companies tool', async () => {
      await delay(RESPONSE_TIMEOUT * SEARCH_DELAY) // Wait additional time to ensure the company is indexed
      const response = await sendPostRequest(jsonRpcMessage.crmSearchCompanies)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.content?.length).toEqual(1)

      const results = JSON.parse(sseResponse.result.content?.[0].text ?? '{}')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results[0].id).toEqual(companyId)
    })

    it('can call the crm_delete_object tool', async () => {
      jsonRpcMessage.crmDeleteObject["params"].arguments.objectId = companyId
      const response = await sendPostRequest(jsonRpcMessage.crmDeleteObject)
      expect(response.status).toBe(200)

      const sseResponse = await getSSEData(response)
      expect(sseResponse.result.content?.[0].text).toEqual(`No data returned: Status 204`)
    })
  })
})
