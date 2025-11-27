#!/usr/bin/env node

/**
 * Filter HubSpot MCP tools to keep only the 34 selected tools
 * This script modifies src/index.ts to comment out unwanted tools
 */

const fs = require('fs');
const path = require('path');

// The 34 tools we want to keep
const TOOLS_TO_KEEP = new Set([
  // Core CRM Objects (10 tools)
  'crm_list_objects',
  'crm_get_object',
  'crm_create_object',
  'crm_update_object',
  'crm_archive_object',
  'crm_search_objects',
  'crm_batch_create_objects',
  'crm_batch_read_objects',
  'crm_batch_update_objects',
  'crm_batch_archive_objects',

  // Companies (8 tools)
  'crm_create_company',
  'crm_update_company',
  'crm_get_company',
  'crm_search_companies',
  'crm_batch_create_companies',
  'crm_batch_update_companies',
  'crm_get_company_properties',
  'crm_create_company_property',

  // Contacts (8 tools)
  'crm_create_contact',
  'crm_update_contact',
  'crm_get_contact',
  'crm_search_contacts',
  'crm_batch_create_contacts',
  'crm_batch_update_contacts',
  'crm_get_contact_properties',
  'crm_create_contact_property',

  // Leads (8 tools)
  'crm_create_lead',
  'crm_update_lead',
  'crm_get_lead',
  'crm_search_leads',
  'crm_batch_create_leads',
  'crm_batch_update_leads',
  'crm_get_lead_properties',
  'crm_create_lead_property'
]);

const sourcePath = path.join(__dirname, 'src', 'index.ts');
const backupPath = path.join(__dirname, 'src', 'index.ts.backup');

// Read the source file
console.log('Reading source file...');
const content = fs.readFileSync(sourcePath, 'utf8');

// Backup the original file
console.log('Creating backup...');
fs.copyFileSync(sourcePath, backupPath);

// Parse and filter tools
console.log('Filtering tools...');
const lines = content.split('\n');
const result = [];
let inToolBlock = false;
let currentToolName = null;
let toolBlockLines = [];
let commentedCount = 0;
let keptCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if this line starts a server.tool block
  const toolMatch = line.match(/server\.tool\(\s*["']([^"']+)["']/);

  if (toolMatch) {
    // Starting a new tool block
    inToolBlock = true;
    currentToolName = toolMatch[1];
    toolBlockLines = [line];
  } else if (inToolBlock) {
    toolBlockLines.push(line);

    // Check if this is the end of the tool block (closing parenthesis + closing brace)
    if (line.trim() === ')' && i + 1 < lines.length && lines[i + 1].trim() === '') {
      // End of tool block
      inToolBlock = false;

      // Decide whether to keep or comment this tool
      if (TOOLS_TO_KEEP.has(currentToolName)) {
        // Keep this tool
        result.push(...toolBlockLines);
        keptCount++;
        console.log(`✓ Keeping: ${currentToolName}`);
      } else {
        // Comment out this tool
        const commented = toolBlockLines.map(l => l.trim() === '' ? '' : `  // ${l}`);
        result.push(`  // [FILTERED] ${currentToolName}`);
        result.push(...commented);
        commentedCount++;
        console.log(`✗ Filtering: ${currentToolName}`);
      }

      toolBlockLines = [];
      currentToolName = null;
    }
  } else {
    // Not in a tool block, keep the line as-is
    result.push(line);
  }
}

// Write the filtered content
console.log('\nWriting filtered file...');
fs.writeFileSync(sourcePath, result.join('\n'), 'utf8');

console.log('\n=== SUMMARY ===');
console.log(`Tools kept: ${keptCount}`);
console.log(`Tools filtered: ${commentedCount}`);
console.log(`Total tools: ${keptCount + commentedCount}`);
console.log(`\nBackup saved to: ${backupPath}`);
console.log('Done!');
