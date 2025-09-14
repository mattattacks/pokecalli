#!/usr/bin/env node

/**
 * Hybrid MCP Server for Poke Integration
 * Combines FastMCP with fallback handling for problematic clients
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";
import dotenv from 'dotenv';
import axios from 'axios';
import express from 'express';

// Load environment variables
dotenv.config();

// VAPI configuration
const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_ID = process.env.VAPI_PHONE_ID;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

const vapiAxios = axios.create({
  baseURL: VAPI_API_BASE,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Phone call function (same as before)
async function makePhoneCall({ phone_number, request_message, user_name = "Customer" }) {
  console.log(`🔄 [makePhoneCall] Starting call process for ${user_name}`);
  console.log(`📞 Raw phone number: "${phone_number}"`);
  console.log(`📝 Request message: "${request_message}"`);

  // Parse phone number to E.164 format
  let cleanPhone = phone_number.replace(/[^\d+]/g, '');

  // Validate and format phone number
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.length === 10) {
      cleanPhone = '+1' + cleanPhone;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      cleanPhone = '+' + cleanPhone;
    } else if (cleanPhone.length === 7) {
      throw new Error(`Invalid phone number format: "${phone_number}". Please include area code.`);
    } else {
      throw new Error(`Invalid phone number format: "${phone_number}". Expected format: +1234567890 or (123) 456-7890`);
    }
  }

  // Final validation of E.164 format
  if (!/^\+1[2-9]\d{9}$/.test(cleanPhone)) {
    throw new Error(`Invalid phone number: "${phone_number}" -> "${cleanPhone}". Must be a valid US number.`);
  }

  console.log(`📱 Cleaned phone number: "${cleanPhone}"`);

  // Parse request details with improved patterns
  const partyMatch = request_message.match(/(?:for|table for|party of|group of|reservation for)\s+(\d+)/i);
  const partySize = partyMatch ? parseInt(partyMatch[1]) : '';

  // Improved time parsing
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/i,  // 7:30 PM
    /(\d{1,2})\s*(am|pm|AM|PM)/i,          // 7 PM
    /(\d{1,2}):(\d{2})/i,                  // 19:30 (24-hour)
    /around\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/i  // around 7:30 PM
  ];
  let timeWindow = '';
  for (const pattern of timePatterns) {
    const match = request_message.match(pattern);
    if (match) {
      timeWindow = match[1] || match[0];
      break;
    }
  }

  // Enhanced date parsing
  const datePatterns = [
    /(today|tonight|this evening)/i,
    /(tomorrow|tomorrow night|tomorrow evening)/i,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+night|\s+evening)?/i,
    /(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(this|next)\s+(week|weekend)/i,
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i
  ];
  let datePrefs = '';
  for (const pattern of datePatterns) {
    const match = request_message.match(pattern);
    if (match) {
      datePrefs = match[0];
      break;
    }
  }

  // Enhanced venue name extraction
  const venuePatterns = [
    /(?:at|to)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    /^(.+?)\s+(?:for|on|at|tonight|today|tomorrow)/i,
    /reservation\s+at\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    /call\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|to|about|regarding)|\s*$)/i,
    /book\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+for|\s*$)/i,
    /([A-Za-z0-9'\s&.,-]{2,30})(?:\s+(?:restaurant|cafe|pizza|grill|bistro|bar|diner))?/i
  ];

  let venueName = '';
  for (const pattern of venuePatterns) {
    const match = request_message.match(pattern);
    if (match && match[1]) {
      venueName = match[1].trim();
      venueName = venueName.replace(/^(the|a|an)\s+/i, '');
      venueName = venueName.replace(/\s+(restaurant|cafe|pizza|grill|bistro|bar|diner)$/i, '');
      if (venueName.length > 2) {
        break;
      }
    }
  }

  console.log(`🏪 Parsed venue name: "${venueName}"`);
  console.log(`👥 Party size: "${partySize}"`);
  console.log(`📅 Date preferences: "${datePrefs}"`);
  console.log(`⏰ Time window: "${timeWindow}"`);

  // Validate environment variables
  if (!VAPI_API_KEY) {
    console.error('❌ [ENV_ERROR] VAPI_API_KEY is missing');
    throw new Error('VAPI API key is not configured');
  }
  if (!VAPI_PHONE_ID) {
    console.error('❌ [ENV_ERROR] VAPI_PHONE_ID is missing');
    throw new Error('VAPI phone ID is not configured');
  }
  if (!VAPI_ASSISTANT_ID) {
    console.error('❌ [ENV_ERROR] VAPI_ASSISTANT_ID is missing');
    throw new Error('VAPI assistant ID is not configured');
  }

  console.log('✅ [ENV_CHECK] All VAPI environment variables present');

  try {
    // Create VAPI call
    const callData = {
      phoneNumberId: VAPI_PHONE_ID,
      assistantId: VAPI_ASSISTANT_ID,
      customer: {
        number: cleanPhone
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: user_name,
          USER_PHONE: "",
          USER_EMAIL: "",
          USER_TZ: "America/New_York",
          REQUEST_CONTEXT: request_message,
          VENUE_NAME: venueName,
          PARTY_SIZE: partySize,
          DATE_PREFS: datePrefs,
          TIME_WINDOW: timeWindow
        }
      }
    };

    console.log(`🚀 [VAPI_CALL] Initiating call with data:`, JSON.stringify(callData, null, 2));

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log(`✅ [VAPI_SUCCESS] Call initiated successfully:`, JSON.stringify(call, null, 2));

    return `📞 **Call Initiated Successfully!**

Calling: ${cleanPhone}
For: ${user_name}
Request: ${request_message}

Call ID: ${call.id}
Status: ${call.status}
Started: ${call.createdAt}

Calli AI is now making the call. You'll receive a follow-up message with the results.`;

  } catch (error) {
    console.error('❌ [VAPI_ERROR] Call initiation failed:');
    console.error('   Error message:', error.message);

    if (error.response) {
      console.error('   HTTP Status:', error.response.status);
      console.error('   Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));

      switch (error.response.status) {
        case 401:
          throw new Error(`Authentication failed: Invalid VAPI API key`);
        case 402:
          throw new Error(`Payment required: Insufficient credits in VAPI account`);
        case 404:
          throw new Error(`Resource not found: Invalid phone ID (${VAPI_PHONE_ID}) or assistant ID (${VAPI_ASSISTANT_ID})`);
        case 400:
          throw new Error(`Bad request: ${error.response.data?.message || 'Invalid call parameters'}`);
        case 429:
          throw new Error(`Rate limited: Too many calls. Try again in a few minutes.`);
        case 500:
          throw new Error(`VAPI server error: ${error.response.data?.message || 'Internal server error'}`);
        default:
          throw new Error(`Failed to initiate call: ${error.response.data?.message || error.message} (Status: ${error.response.status})`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Network error: Cannot connect to VAPI servers. Check internet connection.`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Network timeout: VAPI servers took too long to respond. Try again.`);
    } else {
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

// Initialize FastMCP server
console.log('🔧 [HYBRID] Initializing FastMCP server...');

const server = new FastMCP({
  name: "calli-poke",
  version: "1.0.0"
});

server.addTool({
  name: "make_phone_call",
  description: "Make a phone call to schedule appointments at restaurants, medical offices, salons, or any business",
  parameters: z.object({
    phone_number: z.string().describe("Phone number to call (e.g., '619-853-2051' or '+1-619-853-2051')"),
    request_message: z.string().describe("What you want to schedule (e.g., 'book a table for 2 at Luigi's tonight at 7:30 PM')"),
    user_name: z.string().default("Customer").describe("Name of the person making the appointment")
  }),
  execute: async ({ phone_number, request_message, user_name }) => {
    console.log('📞 [TOOL_CALL] make_phone_call invoked via FastMCP');
    return await makePhoneCall({ phone_number, request_message, user_name });
  }
});

// Setup server with simple configuration
const port = parseInt(process.env.PORT || "8000");
const host = "0.0.0.0";

console.log(`🚀 [HYBRID] Starting server on ${host}:${port}`);

try {
  // Try FastMCP first
  server.start({
    transportType: "httpStream",
    httpStream: {
      port: port,
      endpoint: "/mcp",
      host: host
    }
  });

  console.log(`✅ [FASTMCP] Server running successfully on ${host}:${port}/mcp`);

} catch (error) {
  console.error('❌ [FASTMCP_ERROR] Failed to start FastMCP server:', error);

  // Fallback to express server with manual MCP handling
  console.log('🔄 [FALLBACK] Starting Express fallback server...');

  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', server: 'Calli Poke Fallback' });
  });

  // Simple MCP endpoint that handles tool calls directly
  app.post('/mcp', async (req, res) => {
    console.log('📥 [FALLBACK] MCP request received');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    try {
      const { method, params } = req.body;

      if (method === 'initialize') {
        res.json({
          jsonrpc: "2.0",
          id: req.body.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "calli-poke", version: "1.0.0" }
          }
        });
      } else if (method === 'tools/call' && params?.name === 'make_phone_call') {
        const result = await makePhoneCall(params.arguments);
        res.json({
          jsonrpc: "2.0",
          id: req.body.id,
          result: { content: [{ type: "text", text: result }] }
        });
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          id: req.body.id,
          error: { code: -32601, message: "Method not found" }
        });
      }
    } catch (error) {
      console.error('❌ [FALLBACK_ERROR]:', error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32603, message: error.message }
      });
    }
  });

  app.listen(port, host, () => {
    console.log(`⚡ [FALLBACK] Express server running on ${host}:${port}`);
  });
}