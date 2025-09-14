#!/usr/bin/env node

/**
 * Proper MCP Server for Poke Integration
 * Following the Model Context Protocol specification
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
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

// Map to store transports by session ID for stateful connections
const transports = {};

function createMcpServer() {
  const server = new McpServer({
    name: "calli-poke",
    version: "1.0.0",
  });

  // Register the make_phone_call tool
  server.tool(
    "make_phone_call",
    "Make a phone call to schedule appointments at restaurants, medical offices, salons, or any business",
    {
      phone_number: z.string().describe("Phone number to call (e.g., '619-853-2051' or '+1-619-853-2051')"),
      request_message: z.string().describe("What you want to schedule (e.g., 'book a table for 2 at Luigi's tonight at 7:30 PM')"),
      user_name: z.string().optional().describe("Name of the person making the appointment").default("Customer")
    },
    async ({ phone_number, request_message, user_name = "Customer" }) => {
      return await makePhoneCall({ phone_number, request_message, user_name });
    }
  );

  return server;
}

async function makePhoneCall(args) {
  const { phone_number, request_message, user_name = "Customer" } = args;

    // Parse phone number to E.164 format
    let cleanPhone = phone_number.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
        cleanPhone = '+' + cleanPhone;
      }
    }

    // Parse request details
    const partyMatch = request_message.match(/(?:for|table for|party of)\s+(\d+)/i);
    const partySize = partyMatch ? parseInt(partyMatch[1]) : '';

    const timeMatch = request_message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)|(\d{1,2})\s*(am|pm|AM|PM)/i);
    const timeWindow = timeMatch ? timeMatch[0] : '';

    const datePatterns = [
      /(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(this|next)\s+\w+/i
    ];
    let datePrefs = '';
    for (const pattern of datePatterns) {
      const match = request_message.match(pattern);
      if (match) {
        datePrefs = match[0];
        break;
      }
    }

    // Extract venue name
    const venuePatterns = [
      /(?:at|restaurant|place)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s|,|\.|\?|for|on|at|$)/i
    ];
    let venueName = '';
    for (const pattern of venuePatterns) {
      const match = request_message.match(pattern);
      if (match && match[1]) {
        venueName = match[1].trim();
        break;
      }
    }

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

      const callResponse = await vapiAxios.post('/call', callData);
      const call = callResponse.data;

      return {
        content: [
          {
            type: "text",
            text: `📞 **Call Initiated Successfully!**

Calling: ${cleanPhone}
For: ${user_name}
Request: ${request_message}

Call ID: ${call.id}
Status: ${call.status}
Started: ${call.createdAt}

Calli AI is now making the call. You'll receive a follow-up message with the results.`
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to initiate call: ${error.response?.data?.message || error.message}`);
    }
  }

// Express server setup with proper MCP integration
function startHttpServer(port = 8000) {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'Calli Poke MCP Server' });
  });

  // MCP endpoint with session management
  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
        transport.handleRequest(req, res);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request - create new server and transport
        const server = createMcpServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID()
        });

        // Store transport for session
        const newSessionId = transport.sessionId || randomUUID();
        transports[newSessionId] = transport;

        // Connect server to transport
        await server.connect(transport);
        transport.handleRequest(req, res);
      } else {
        res.status(400).json({ error: 'Invalid MCP request' });
      }
    } catch (error) {
      console.error('MCP request error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Calli Poke MCP server running on port ${port}`);
  });
}

// Start the server
const port = process.env.PORT || 8000;
console.log(`Starting Calli Poke MCP Server on port ${port}`);
startHttpServer(port);