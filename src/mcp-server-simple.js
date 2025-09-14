#!/usr/bin/env node

/**
 * Simple Stateless MCP Server for Poke Integration
 * Modeled after InteractionCo/mcp-server-template structure
 * Handles stateless HTTP requests like the Python version
 */

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

// Phone call function (same enhanced version)
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

// Create Express app for MCP server - following InteractionCo template pattern
const app = express();
app.use(express.json());

console.log('🔧 [SIMPLE_MCP] Initializing stateless MCP server...');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Calli Poke Simple MCP Server',
    timestamp: new Date().toISOString(),
    environment: {
      vapiKey: VAPI_API_KEY ? 'Present' : 'Missing',
      vapiPhone: VAPI_PHONE_ID ? 'Present' : 'Missing',
      vapiAssistant: VAPI_ASSISTANT_ID ? 'Present' : 'Missing'
    }
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    server: 'Simple Stateless MCP',
    version: '1.0.0',
    tools: ['make_phone_call'],
    mcpEndpoint: '/mcp',
    stateless: true,
    template: 'InteractionCo/mcp-server-template',
    timestamp: new Date().toISOString()
  });
});

// Main MCP endpoint - fully stateless like Python FastMCP
app.post('/mcp', async (req, res) => {
  const requestId = req.body.id || Math.random().toString(36).substring(7);

  console.log('📥 [STATELESS_MCP] Request received');
  console.log('🔍 [REQUEST_BODY]', JSON.stringify(req.body, null, 2));
  console.log('🔍 [REQUEST_HEADERS]', JSON.stringify(req.headers, null, 2));

  try {
    const { method, params } = req.body;

    if (method === 'initialize') {
      console.log('🔄 [INITIALIZE] Processing initialize request');

      const response = {
        jsonrpc: "2.0",
        id: requestId,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            logging: {}
          },
          serverInfo: {
            name: "calli-poke",
            version: "1.0.0"
          }
        }
      };

      console.log('✅ [INITIALIZE] Sending response:', JSON.stringify(response, null, 2));
      return res.json(response);

    } else if (method === 'tools/list') {
      console.log('🔄 [TOOLS_LIST] Processing tools list request');

      const response = {
        jsonrpc: "2.0",
        id: requestId,
        result: {
          tools: [
            {
              name: "make_phone_call",
              description: "Make a phone call to schedule appointments at restaurants, medical offices, salons, or any business",
              inputSchema: {
                type: "object",
                properties: {
                  phone_number: {
                    type: "string",
                    description: "Phone number to call (e.g., '619-853-2051' or '+1-619-853-2051')"
                  },
                  request_message: {
                    type: "string",
                    description: "What you want to schedule (e.g., 'book a table for 2 at Luigi's tonight at 7:30 PM')"
                  },
                  user_name: {
                    type: "string",
                    description: "Name of the person making the appointment",
                    default: "Customer"
                  }
                },
                required: ["phone_number", "request_message"]
              }
            }
          ]
        }
      };

      console.log('✅ [TOOLS_LIST] Sending response:', JSON.stringify(response, null, 2));
      return res.json(response);

    } else if (method === 'tools/call' && params?.name === 'make_phone_call') {
      console.log('📞 [TOOL_CALL] Processing make_phone_call request');
      console.log('🔍 [TOOL_PARAMS]', JSON.stringify(params.arguments, null, 2));

      const result = await makePhoneCall(params.arguments);

      const response = {
        jsonrpc: "2.0",
        id: requestId,
        result: {
          content: [
            {
              type: "text",
              text: result
            }
          ]
        }
      };

      console.log('✅ [TOOL_CALL] Call completed successfully');
      return res.json(response);

    } else {
      console.log('❌ [UNKNOWN_METHOD] Method not found:', method);

      const response = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32601,
          message: "Method not found"
        }
      };

      return res.status(400).json(response);
    }

  } catch (error) {
    console.error('❌ [MCP_ERROR] Request failed:', error.message);
    console.error('   Error details:', error);

    const response = {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32603,
        message: error.message
      }
    };

    return res.status(500).json(response);
  }
});

// Start server following InteractionCo template pattern
const port = parseInt(process.env.PORT || "8000");
const host = "0.0.0.0";

console.log(`🚀 [SIMPLE_MCP] Starting server on ${host}:${port}`);

app.listen(port, host, () => {
  console.log(`✅ [SIMPLE_MCP] Stateless MCP server running on ${host}:${port}/mcp`);
  console.log(`🔍 [DEBUG] Debug endpoint: ${host}:${port}/debug`);
  console.log(`💓 [HEALTH] Health check: ${host}:${port}/health`);
  console.log('📋 [COMPATIBLE] Compatible with Poke stateless HTTP requests');
});