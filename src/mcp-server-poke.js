#!/usr/bin/env node

/**
 * Poke-Compatible MCP Server for Calli Integration
 * Based on working index.js pattern - handles REST API requests from Poke
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

console.log('🔧 [POKE_MCP] Initializing Poke-compatible MCP server...');

// Phone number extraction utility
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

// Parse reservation request utility
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

  // Enhanced venue name extraction (same as mcp-server-simple.js)
  const venuePatterns = [
    /(?:at|to)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    /^(.+?)\s+(?:for|on|at|tonight|today|tomorrow)/i,
    /reservation\s+at\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    /call\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|to|about|regarding)|\s*$)/i,
    /book\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+for|\s*$)/i,
    /([A-Za-z0-9'\s&.,-]{2,30})(?:\s+(?:restaurant|cafe|pizza|grill|bistro|bar|diner))?/i
  ];

  for (const pattern of venuePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let venueName = match[1].trim();
      venueName = venueName.replace(/^(the|a|an)\s+/i, '');
      venueName = venueName.replace(/\s+(restaurant|cafe|pizza|grill|bistro|bar|diner)$/i, '');
      if (venueName.length > 2) {
        request.venueName = venueName;
        break;
      }
    }
  }

  // Enhanced party size extraction
  const partyMatch = text.match(/(?:for|table for|party of|group of|reservation for)\s+(\d+)/i);
  if (partyMatch) {
    request.partySize = parseInt(partyMatch[1]);
  }

  // Enhanced time parsing
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/i,
    /(\d{1,2})\s*(am|pm|AM|PM)/i,
    /(\d{1,2}):(\d{2})/i,
    /around\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/i
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      request.time = match[1] || match[0];
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

  console.log('🔍 [PARSE] Extracted:', {
    phone: request.phoneNumber,
    venue: request.venueName,
    party: request.partySize,
    date: request.date,
    time: request.time
  });

  return request;
}

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Calli Poke MCP Server',
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
    server: 'Poke-Compatible MCP Server',
    version: '1.0.0',
    endpoints: ['/mcp', '/test', '/health', '/call-status/:callId'],
    pokeCompatible: true,
    timestamp: new Date().toISOString()
  });
});

// Main MCP endpoint - Poke-compatible format
app.post('/mcp', async (req, res) => {
  console.log('📨 [MCP] Received Poke request:', JSON.stringify(req.body, null, 2));

  try {
    // Extract request information in Poke format
    const { body, user, metadata } = req.body;

    if (!body) {
      console.log('❌ [MCP] No request body provided');
      return res.status(400).json({ error: 'No request body provided' });
    }

    // Parse the reservation request
    const userName = user?.name || user?.email || 'User';
    const request = parseReservationRequest(body, userName);

    if (!request.phoneNumber) {
      console.log('❌ [MCP] No valid phone number found');
      return res.status(400).json({
        error: 'No valid phone number found in request',
        message: 'Please include a phone number (e.g., "Call 555-123-4567 to book...")'
      });
    }

    // Validate environment variables
    if (!VAPI_API_KEY || !VAPI_PHONE_ID || !VAPI_ASSISTANT_ID) {
      console.error('❌ [MCP] Missing VAPI configuration');
      return res.status(500).json({
        success: false,
        error: 'VAPI configuration incomplete',
        message: 'Server configuration error'
      });
    }

    // Create variable values for the assistant
    const variableValues = {
      USER_NAME: request.userName,
      USER_PHONE: user?.phone || '',
      USER_EMAIL: user?.email || '',
      USER_TZ: user?.timezone || 'America/New_York',
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

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ [VAPI_CALL] Call initiated successfully:', call.id);

    // Return immediate response to Poke in expected format
    const response = {
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

    res.json(response);

    // Monitor call completion and send results back to Poke
    monitorCallAndNotifyPoke(call.id, user?.email || userName);

  } catch (error) {
    console.error('❌ [MCP] Request failed:', error.message);
    console.error('   Response data:', error.response?.data);

    res.status(500).json({
      success: false,
      error: 'Failed to process reservation request',
      message: error.message,
      details: error.response?.data
    });
  }
});

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
    body: req.body.message || "Call 555-123-4567 to book a table for 2 at Luigi's tonight at 7:30pm",
    user: {
      name: req.body.userName || "Test User",
      email: req.body.userEmail || "test@example.com"
    }
  };

  // Forward to MCP endpoint
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

console.log(`🚀 [POKE_MCP] Starting server on ${host}:${port}`);

app.listen(port, host, () => {
  console.log(`✅ [POKE_MCP] Poke-compatible MCP server running on ${host}:${port}`);
  console.log(`🔗 [ENDPOINTS] Available endpoints:`);
  console.log(`   POST /mcp - Main Poke integration endpoint`);
  console.log(`   GET  /call-status/:callId - Check call status`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /debug - Debug info`);
  console.log(`   POST /test - Manual testing endpoint`);
  console.log(`📋 [COMPATIBLE] Ready to handle Poke requests in expected format`);
});