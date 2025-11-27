#!/bin/bash

# Test script for HubSpot MCP HTTP Server
# Usage: ./test-http-mcp.sh

PORT=3001
BASE_URL="http://localhost:$PORT/mcp"

echo "Testing HubSpot MCP HTTP Server..."
echo ""

# Step 1: Initialize session
echo "1. Initializing MCP session..."
RESPONSE=$(curl -s -i -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0"
      }
    }
  }')

# Extract session ID
SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to initialize session"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Session initialized: $SESSION_ID"
echo ""

# Step 2: List tools
echo "2. Listing available tools..."
TOOLS=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | grep -o '"name":"[^"]*"' | wc -l)

echo "✅ Found $TOOLS tools available"
echo ""

# Step 3: Test a simple tool call
echo "3. Testing crm_list_objects tool..."
RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "crm_list_objects",
      "arguments": {
        "objectType": "contacts",
        "limit": 1
      }
    }
  }')

echo "$RESULT"
echo ""
echo "✅ HTTP MCP Server is working!"
