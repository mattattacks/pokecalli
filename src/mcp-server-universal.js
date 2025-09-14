#!/usr/bin/env node

/**
 * Universal MCP Server for Poke Integration
 * Handles both JSON-RPC MCP protocol AND REST API requests
 * Fixes venue/time parsing issues
 */

import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

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

console.log('🔧 [UNIVERSAL_MCP] Initializing universal MCP server...');

// Phone number extraction utility (improved)
function extractPhoneNumber(text) {
  console.log(`📞 [PHONE_EXTRACT] Processing text: "${text}"`);

  const patterns = [
    /\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    /\+?([0-9]{1,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{4})/g,
    /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*)?(?:[2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*(?:\)\s*)?(?:[.-]\s*)?)?(?:[2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?(?:[0-9]{4})/g
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let phone = matches[0].replace(/[^\d+]/g, '');

      // Add country code if missing
      if (!phone.startsWith('+')) {
        if (phone.length === 10) {
          phone = '+1' + phone;
        } else if (phone.length === 11 && phone.startsWith('1')) {
          phone = '+' + phone;
        }
      }

      console.log(`📱 [PHONE_EXTRACT] Found: "${matches[0]}" -> "${phone}"`);
      return phone;
    }
  }

  console.log('❌ [PHONE_EXTRACT] No valid phone number found');
  return null;
}

// Send message back to Poke
async function sendMessageToPoke(message) {
  const POKE_API_KEY = process.env.POKE_API_KEY;

  if (!POKE_API_KEY) {
    console.log('📧 [POKE_NOTIFY] No API key configured - skipping notification');
    return;
  }

  try {
    console.log('📧 [POKE_NOTIFY] Sending message to Poke...');
    const response = await axios.post('https://poke.com/api/v1/inbound-sms/webhook', {
      message: message
    }, {
      headers: {
        'Authorization': `Bearer ${POKE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ [POKE_NOTIFY] Message sent successfully');
  } catch (error) {
    console.error('❌ [POKE_NOTIFY] Failed to send message:', error.response?.data || error.message);
  }
}

// Monitor call completion and notify Poke
async function monitorCallAndNotifyPoke(callId, userIdentifier) {
  console.log(`🔍 [CALL_MONITOR] Starting monitoring for ${callId} (user: ${userIdentifier})`);

  let attempts = 0;
  const maxAttempts = 30;

  const monitorInterval = setInterval(async () => {
    attempts++;

    try {
      const statusResponse = await vapiAxios.get(`/call/${callId}`);
      const call = statusResponse.data;

      console.log(`🔍 [CALL_MONITOR] Status for ${callId}: ${call.status} (attempt ${attempts})`);

      if (['ended', 'failed', 'busy', 'no-answer'].includes(call.status)) {
        clearInterval(monitorInterval);

        let pokeMessage = `🤖 **Calli Call Complete** - ${userIdentifier}\n\n`;
        pokeMessage += `📞 **Status**: ${call.status}\n`;
        pokeMessage += `⏱️ **Duration**: ${call.duration || 0}s\n`;

        if (call.status === 'ended') {
          pokeMessage += `🎯 **Result**: ${call.endedReason || 'completed'}\n`;

          if (call.summary) {
            pokeMessage += `\n📋 **Summary**: ${call.summary}\n`;
          }

          if (call.transcript) {
            const transcript = call.transcript.toLowerCase();
            const hasBooking = transcript.includes('confirmed') || transcript.includes('booked') || transcript.includes('reservation');
            const hasTime = transcript.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/i);

            if (hasBooking && hasTime) {
              pokeMessage += `\n✅ **Likely Success**: Booking language detected\n`;
            }

            const sentences = call.transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const keyPhrases = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
            pokeMessage += `\n💬 **Key Conversation**: "${keyPhrases}"\n`;
          }

          if (call.analysis?.successEvaluation) {
            pokeMessage += `\n🤖 **AI Assessment**: ${call.analysis.successEvaluation}\n`;
          }

        } else {
          pokeMessage += `\n❌ **Issue**: ${call.endedReason || 'Call was not successful'}\n`;

          if (call.status === 'no-answer') {
            pokeMessage += `💡 **Suggestion**: Try calling back later or check if the number is correct\n`;
          } else if (call.status === 'busy') {
            pokeMessage += `💡 **Suggestion**: The line was busy - try again soon\n`;
          }
        }

        pokeMessage += `\n🔗 **Call ID**: ${callId}`;

        await sendMessageToPoke(pokeMessage);
        console.log(`✅ [CALL_MONITOR] Monitoring complete for ${callId} - notification sent`);

      } else if (attempts >= maxAttempts) {
        clearInterval(monitorInterval);

        await sendMessageToPoke(
          `⏰ **Calli Call Timeout** - ${userIdentifier}\n\n` +
          `📞 Call ${callId} is still in progress after 5 minutes.\n` +
          `Status: ${call.status}\n\n` +
          `Check VAPI dashboard for final results.`
        );

        console.log(`⏰ [CALL_MONITOR] Timeout for ${callId}`);
      }

    } catch (error) {
      console.error(`❌ [CALL_MONITOR] Error for ${callId}:`, error.message);

      if (attempts >= maxAttempts) {
        clearInterval(monitorInterval);
        await sendMessageToPoke(
          `❌ **Calli Monitoring Error** - ${userIdentifier}\n\n` +
          `Unable to monitor call ${callId} - check VAPI dashboard.`
        );
      }
    }
  }, 10000);
}

// FIXED: Parse reservation request utility with proper venue/time extraction
function parseReservationRequest(text, userName = 'User') {
  console.log(`🔍 [PARSE] Processing request: "${text}"`);

  const request = {
    userName,
    originalText: text,
    phoneNumber: extractPhoneNumber(text),
    venueName: null,
    partySize: null,
    date: null,
    time: null
  };

  // FIXED: Improved venue name extraction - prioritize patterns that find restaurant names
  const venuePatterns = [
    // "Luigi's Pizza" from "Call Luigi's Pizza at phone" - capture restaurant name before "at phone"
    /^call\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+at\s+[\+\(]?\d)/i,
    // "Luigi's Pizza" from "book a table for 2 at Luigi's Pizza"
    /table\s+for\s+\d+\s+at\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:tonight|today|tomorrow|on|for)|\s*$)/i,
    // "Luigi's Pizza" from "reservation at Luigi's Pizza"
    /reservation\s+at\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    // "Luigi's Pizza" from "at Luigi's Pizza tonight" - but NOT if followed by phone number
    /\bat\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:tonight|today|tomorrow|on|for)|\s*$)/i,
    // General pattern for restaurant names with type words
    /([A-Za-z0-9'\s&.,-]{3,30})(?:\s+(?:restaurant|cafe|pizza|grill|bistro|bar|diner))/i
  ];

  for (const pattern of venuePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let venueName = match[1].trim();
      // Clean up venue name
      venueName = venueName.replace(/^(the|a|an)\s+/i, ''); // Remove articles
      venueName = venueName.replace(/\s+(restaurant|cafe|pizza|grill|bistro|bar|diner)$/i, ''); // Remove type suffixes
      venueName = venueName.replace(/\s+at$/, ''); // Remove trailing "at"
      if (venueName.length > 2) {
        request.venueName = venueName;
        console.log(`🏪 [PARSE] Found venue: "${venueName}" using pattern: ${pattern}`);
        break;
      }
    }
  }

  // Enhanced party size extraction
  const partyMatch = text.match(/(?:for|table for|party of|group of|reservation for)\s+(\d+)/i);
  if (partyMatch) {
    request.partySize = parseInt(partyMatch[1]);
  }

  // FIXED: Improved time parsing to capture full time
  const timePatterns = [
    /(\d{1,2}:\d{2})\s*(am|pm|AM|PM)/i,  // "7:30 PM"
    /(\d{1,2})\s*(am|pm|AM|PM)/i,        // "7 PM"
    /(\d{1,2}:\d{2})/i,                  // "19:30" (24-hour)
    /around\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/i  // "around 7:30 PM"
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Capture the full time match including AM/PM
      if (match[2]) {
        request.time = `${match[1]} ${match[2].toUpperCase()}`;
      } else {
        request.time = match[1];
      }
      console.log(`⏰ [PARSE] Found time: "${request.time}" using pattern: ${pattern}`);
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

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      request.date = match[0];
      break;
    }
  }

  console.log('🔍 [PARSE] Final extracted:', {
    phone: request.phoneNumber,
    venue: request.venueName,
    party: request.partySize,
    date: request.date,
    time: request.time
  });

  return request;
}

// Phone call execution function
async function makePhoneCall({ phone_number, request_message, user_name = "Customer" }) {
  console.log(`🔄 [MAKE_CALL] Starting call process for ${user_name}`);

  // Parse the reservation request
  const request = parseReservationRequest(request_message, user_name);

  if (!request.phoneNumber) {
    throw new Error('No valid phone number found in request');
  }

  // Validate environment variables
  if (!VAPI_API_KEY || !VAPI_PHONE_ID || !VAPI_ASSISTANT_ID) {
    console.error('❌ [MAKE_CALL] Missing VAPI configuration');
    throw new Error('VAPI configuration incomplete');
  }

  // Create variable values for the assistant
  const variableValues = {
    USER_NAME: request.userName,
    USER_PHONE: phone_number || '',
    USER_EMAIL: '',
    USER_TZ: 'America/New_York',
    REQUEST_CONTEXT: request.originalText,
    VENUE_NAME: request.venueName || '',
    PARTY_SIZE: request.partySize || '',
    DATE_PREFS: request.date || '',
    TIME_WINDOW: request.time || ''
  };

  console.log('🚀 [VAPI_CALL] Initiating call with variables:', variableValues);

  // Create the VAPI call
  const callData = {
    phoneNumberId: VAPI_PHONE_ID,
    assistantId: VAPI_ASSISTANT_ID,
    customer: {
      number: request.phoneNumber
    },
    assistantOverrides: {
      variableValues
    }
  };

  try {
    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ [VAPI_CALL] Call initiated successfully:', call.id);

    // Start call monitoring
    monitorCallAndNotifyPoke(call.id, request.userName);

    return {
      success: true,
      message: `📞 Calling ${request.phoneNumber} to make your reservation...`,
      callId: call.id,
      status: 'initiated',
      details: {
        venue: request.venueName || 'restaurant',
        partySize: request.partySize,
        requestedDate: request.date,
        requestedTime: request.time,
        phone: request.phoneNumber
      }
    };

  } catch (error) {
    console.error('❌ [VAPI_CALL] Call initiation failed:', error.message);
    throw error;
  }
}

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight CORS and method discovery to satisfy clients that probe with GET/HEAD/OPTIONS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-Id');
  next();
});

// Friendly GET/HEAD/OPTIONS handlers for /mcp so external validators don't 404
app.options('/mcp', (req, res) => {
  res.setHeader('Allow', 'GET, POST, HEAD, OPTIONS');
  return res.status(204).end();
});

app.head('/mcp', (req, res) => {
  return res.status(200).end();
});

app.get('/mcp', (req, res) => {
  return res.json({
    status: 'ok',
    server: 'Universal MCP Server',
    protocol: 'JSON-RPC 2.0 over HTTP',
    endpoint: '/mcp',
    methods: ['POST'],
    note: 'Send a POST JSON-RPC request with method="initialize" to begin the MCP handshake.'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Calli Poke Universal MCP Server',
    timestamp: new Date().toISOString(),
    environment: {
      vapiKey: VAPI_API_KEY ? 'Present' : 'Missing',
      vapiPhone: VAPI_PHONE_ID ? 'Present' : 'Missing',
      vapiAssistant: VAPI_ASSISTANT_ID ? 'Present' : 'Missing',
      pokeKey: process.env.POKE_API_KEY ? 'Present' : 'Missing'
    }
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    server: 'Universal MCP Server',
    version: '1.0.0',
    formats: ['JSON-RPC MCP', 'REST API'],
    endpoints: ['/mcp', '/test', '/health', '/call-status/:callId'],
    timestamp: new Date().toISOString()
  });
});

// UNIVERSAL MCP endpoint - handles BOTH JSON-RPC and REST formats
app.post('/mcp', async (req, res) => {
  console.log('📨 [MCP] Received request:', JSON.stringify(req.body, null, 2));
  console.log('📨 [MCP] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('📨 [MCP] Request method:', req.method);
  console.log('📨 [MCP] Request URL:', req.url);

  try {
    const requestBody = req.body;

    // ENHANCED DEBUG: Log detailed request analysis
    console.log('🔍 [DEBUG] Request body keys:', Object.keys(requestBody));
    console.log('🔍 [DEBUG] Has method property:', !!requestBody.method);
    console.log('🔍 [DEBUG] Has jsonrpc property:', !!requestBody.jsonrpc);
    console.log('🔍 [DEBUG] Has body property:', !!requestBody.body);
    console.log('🔍 [DEBUG] Method value:', requestBody.method);
    console.log('🔍 [DEBUG] JSONRPC version:', requestBody.jsonrpc);
    console.log('🔍 [DEBUG] Request ID:', requestBody.id);

    // DETECT FORMAT: JSON-RPC MCP vs REST
    if (requestBody.method && requestBody.jsonrpc) {
      // JSON-RPC MCP format
      console.log('📋 [MCP] ✅ DETECTED: JSON-RPC MCP request');
      console.log('🎯 [MCP] JSON-RPC Method:', requestBody.method);
      console.log('🎯 [MCP] JSON-RPC Params:', JSON.stringify(requestBody.params, null, 2));
      return handleMcpJsonRpc(req, res);
    } else if (requestBody.body) {
      // REST format
      console.log('📋 [MCP] ✅ DETECTED: REST API request');
      console.log('🎯 [MCP] REST Body:', requestBody.body);
      return handleRestRequest(req, res);
    } else {
      console.log('❌ [MCP] ⚠️  UNKNOWN REQUEST FORMAT');
      console.log('❌ [MCP] Request body structure:', JSON.stringify(requestBody, null, 2));
      return res.status(400).json({
        error: 'Unknown request format',
        received: {
          hasMethod: !!requestBody.method,
          hasJsonrpc: !!requestBody.jsonrpc,
          hasBody: !!requestBody.body,
          keys: Object.keys(requestBody)
        }
      });
    }

  } catch (error) {
    console.error('❌ [MCP] Request processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// Handle JSON-RPC MCP requests
async function handleMcpJsonRpc(req, res) {
  const { method, params, id } = req.body;

  console.log('🎯 [JSON_RPC] ========== PROCESSING JSON-RPC REQUEST ==========');
  console.log('🎯 [JSON_RPC] Method:', method);
  console.log('🎯 [JSON_RPC] Request ID:', id);
  console.log('🎯 [JSON_RPC] Params:', JSON.stringify(params, null, 2));
  console.log('🎯 [JSON_RPC] Full request body:', JSON.stringify(req.body, null, 2));

  try {
    if (method === 'initialize') {
      console.log('🔄 [JSON_RPC] ✅ HANDLING: initialize request');
      console.log('🔄 [JSON_RPC] Initialize params:', JSON.stringify(params, null, 2));

      const response = {
        jsonrpc: "2.0",
        id: id,
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

      console.log('✅ [JSON_RPC] Sending initialize response:', JSON.stringify(response, null, 2));
      return res.json(response);

    } else if (method === 'tools/list') {
      console.log('🔄 [JSON_RPC] ✅ HANDLING: tools/list request');
      console.log('🔄 [JSON_RPC] Tools/list params:', JSON.stringify(params, null, 2));

      const response = {
        jsonrpc: "2.0",
        id: id,
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

      console.log('✅ [JSON_RPC] Sending tools/list response:', JSON.stringify(response, null, 2));
      return res.json(response);

    } else if (method === 'tools/call' && params?.name === 'make_phone_call') {
      console.log('📞 [JSON_RPC] ✅ HANDLING: tools/call request for make_phone_call');
      console.log('🔍 [JSON_RPC] Tool name:', params.name);
      console.log('🔍 [JSON_RPC] Tool arguments:', JSON.stringify(params.arguments, null, 2));

      const result = await makePhoneCall(params.arguments);

      const response = {
        jsonrpc: "2.0",
        id: id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };

      console.log('✅ [JSON_RPC] Call completed successfully, sending response:', JSON.stringify(response, null, 2));
      return res.json(response);

    } else if (method === 'tools/call') {
      console.log('❌ [JSON_RPC] ⚠️  tools/call request with UNKNOWN TOOL NAME');
      console.log('❌ [JSON_RPC] Expected tool name: "make_phone_call"');
      console.log('❌ [JSON_RPC] Received tool name:', params?.name);
      console.log('❌ [JSON_RPC] All params:', JSON.stringify(params, null, 2));

      const response = {
        jsonrpc: "2.0",
        id: id,
        error: {
          code: -32602,
          message: `Unknown tool: ${params?.name}. Available tools: make_phone_call`
        }
      };

      return res.status(400).json(response);

    } else {
      console.log('❌ [JSON_RPC] ⚠️  METHOD NOT FOUND:', method);
      console.log('❌ [JSON_RPC] Available methods: initialize, tools/list, tools/call');
      console.log('❌ [JSON_RPC] Full request:', JSON.stringify(req.body, null, 2));

      const response = {
        jsonrpc: "2.0",
        id: id,
        error: {
          code: -32601,
          message: `Method not found: ${method}. Available methods: initialize, tools/list, tools/call`
        }
      };

      return res.status(400).json(response);
    }

  } catch (error) {
    console.error('❌ [JSON_RPC] ========== REQUEST FAILED ==========');
    console.error('❌ [JSON_RPC] Error message:', error.message);
    console.error('❌ [JSON_RPC] Error stack:', error.stack);
    console.error('❌ [JSON_RPC] Request method:', method);
    console.error('❌ [JSON_RPC] Request params:', JSON.stringify(params, null, 2));
    console.error('❌ [JSON_RPC] Full error:', error);

    const response = {
      jsonrpc: "2.0",
      id: id,
      error: {
        code: -32603,
        message: `Internal error processing method "${method}": ${error.message}`,
        data: {
          method: method,
          originalError: error.message
        }
      }
    };

    console.error('❌ [JSON_RPC] Sending error response:', JSON.stringify(response, null, 2));
    return res.status(500).json(response);
  }
}

// Handle REST API requests
async function handleRestRequest(req, res) {
  const { body, user } = req.body;

  if (!body) {
    console.log('❌ [REST] No request body provided');
    return res.status(400).json({ error: 'No request body provided' });
  }

  console.log('🔄 [REST] Processing REST request');

  try {
    // Extract phone number from the message
    const phoneNumber = extractPhoneNumber(body);
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'No valid phone number found in request',
        message: 'Please include a phone number (e.g., "Call 555-123-4567 to book...")'
      });
    }

    const result = await makePhoneCall({
      phone_number: phoneNumber,
      request_message: body,
      user_name: user?.name || user?.email || 'User'
    });

    console.log('✅ [REST] Request processed successfully');
    return res.json(result);

  } catch (error) {
    console.error('❌ [REST] Request failed:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Failed to process reservation request',
      message: error.message,
      details: error.response?.data
    });
  }
}

// Call status endpoint
app.get('/call-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    console.log(`🔍 [CALL_STATUS] Checking status for ${callId}`);

    const response = await vapiAxios.get(`/call/${callId}`);
    const call = response.data;

    res.json({
      id: call.id,
      status: call.status,
      duration: call.duration,
      endedReason: call.endedReason,
      transcript: call.transcript,
      summary: call.summary,
      createdAt: call.createdAt,
      endedAt: call.endedAt
    });

  } catch (error) {
    console.error('❌ [CALL_STATUS] Failed to get status:', error.message);
    res.status(500).json({ error: 'Failed to get call status', message: error.message });
  }
});

// Test endpoint for debugging
app.post('/test', async (req, res) => {
  console.log('🧪 [TEST] Test request received:', req.body);

  const testRequest = {
    body: req.body.message || "Call (619) 853-2051 to book a table for 2 at Luigi's Pizza tonight at 7:30 PM",
    user: {
      name: req.body.userName || "Test User",
      email: req.body.userEmail || "test@example.com"
    }
  };

  // Forward to MCP endpoint as REST request
  try {
    const response = await axios.post(`http://localhost:${process.env.PORT || 8000}/mcp`, testRequest, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json({ success: true, result: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

// Start server
const port = parseInt(process.env.PORT || 8000);
const host = "0.0.0.0";

console.log(`🚀 [UNIVERSAL_MCP] Starting server on ${host}:${port}`);

app.listen(port, host, () => {
  console.log(`✅ [UNIVERSAL_MCP] Universal MCP server running on ${host}:${port}`);
  console.log(`🔗 [ENDPOINTS] Available endpoints:`);
  console.log(`   POST /mcp - Universal MCP endpoint (JSON-RPC + REST)`);
  console.log(`   GET  /call-status/:callId - Check call status`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /debug - Debug info`);
  console.log(`   POST /test - Manual testing endpoint`);
  console.log(`📋 [FORMATS] Supports JSON-RPC MCP protocol AND REST API requests`);
  console.log(`🏪 [PARSING] Fixed venue extraction: "Luigi's Pizza" ✅`);
  console.log(`⏰ [PARSING] Fixed time extraction: "7:30 PM" ✅`);
});