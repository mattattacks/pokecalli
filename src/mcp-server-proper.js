#!/usr/bin/env node

/**
 * Proper MCP Server for Poke Integration
 * Following the Model Context Protocol specification
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

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

class CalliMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: "calli-poke",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
            required: ["phone_number", "request_message"],
          },
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "make_phone_call":
            return await this.makePhoneCall(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error.message}`
        );
      }
    });
  }

  async makePhoneCall(args) {
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

  setupErrorHandling() {
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Calli Poke MCP server running on stdio");
  }

  async runHttp(port = 8000) {
    const app = express();
    app.use(express.json());

    // MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        // Handle MCP requests over HTTP
        const { method, params } = req.body;

        if (method === 'tools/list') {
          const tools = await this.server.request(ListToolsRequestSchema, {});
          res.json(tools);
        } else if (method === 'tools/call') {
          const result = await this.server.request(CallToolRequestSchema, params);
          res.json(result);
        } else {
          res.status(400).json({ error: 'Unknown MCP method' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'Calli Poke MCP Server' });
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Calli Poke MCP server running on port ${port}`);
    });
  }
}

// Start server
const server = new CalliMcpServer();

if (process.env.NODE_ENV === 'production') {
  server.runHttp(process.env.PORT || 10000);
} else {
  server.runStdio();
}