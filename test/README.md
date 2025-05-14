# Test Suite

This directory contains tests to run against the MCP package. It currently consists of a single [e2e.test.js](./e2e.test.js) script to run with test keys.

## Prerequisites

- Node.js 18+ installed
- Google project setup as describe in the main [README](../README.md)

## Running Jest E2E Tests

1. Configure the required environment variables:
```bash
export HUBSPOT_ACCESS_TOKEN=
export PORT= #For Streamable HTTP transport if 3000 is unavailable

2. Run the test suite:
```bash
pnpm i && pnpm build && pnpm test
```
