#!/usr/bin/env node

/**
 * Calli Poke MCP Server for Claude Desktop
 * Enables Claude Desktop to directly make appointment calls via VAPI
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

// Load environment variables
dotenv.config();

class CalliPokeServer {
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

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "make_appointment_call",
          description: "Call any business to book appointments using Calli AI voice assistant. Works with restaurants, medical offices, salons, legal services, home services, and any business type.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "string",
                description: "Natural language appointment request (e.g., 'Call (555) 123-4567 to book a table for 2 at Luigi's tonight at 7:30 PM')"
              },
              userName: {
                type: "string",
                description: "Name of the person making the appointment",
                default: "Claude User"
              },
              userEmail: {
                type: "string",
                description: "Email address for appointment confirmations",
                default: "user@example.com"
              },
              phoneNumber: {
                type: "string",
                description: "Phone number to call (if not included in request text)"
              }
            },
            required: ["request"],
          },
        },
        {
          name: "check_call_status",
          description: "Check the status of a previously initiated appointment call",
          inputSchema: {
            type: "object",
            properties: {
              callId: {
                type: "string",
                description: "The call ID returned from make_appointment_call"
              }
            },
            required: ["callId"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "make_appointment_call":
            return await this.makeAppointmentCall(args);
          case "check_call_status":
            return await this.checkCallStatus(args);
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

  async makeAppointmentCall(args) {
    const { request, userName = "Claude User", userEmail = "user@example.com", phoneNumber } = args;

    // VAPI configuration
    const VAPI_API_BASE = 'https://api.vapi.ai';
    const VAPI_API_KEY = process.env.VAPI_API_KEY;
    const VAPI_PHONE_ID = process.env.VAPI_PHONE_ID;
    const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

    if (!VAPI_API_KEY || !VAPI_PHONE_ID || !VAPI_ASSISTANT_ID) {
      throw new Error("Missing VAPI configuration. Please set VAPI_API_KEY, VAPI_PHONE_ID, and VAPI_ASSISTANT_ID environment variables.");
    }

    const vapiAxios = axios.create({
      baseURL: VAPI_API_BASE,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Extract phone number from request if not provided
    let targetPhone = phoneNumber;
    if (!targetPhone) {
      const phoneMatch = request.match(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
      if (phoneMatch) {
        targetPhone = `+1${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
      }
    }

    if (!targetPhone) {
      throw new Error("No phone number found in request. Please include a phone number in your appointment request.");
    }

    // Parse appointment details
    const appointmentData = this.parseAppointmentRequest(request);

    // Create VAPI call
    const callData = {
      phoneNumberId: VAPI_PHONE_ID,
      assistantId: VAPI_ASSISTANT_ID,
      customer: {
        number: targetPhone
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: userName,
          USER_PHONE: "",
          USER_EMAIL: userEmail,
          USER_TZ: "America/New_York",
          REQUEST_CONTEXT: request,
          VENUE_NAME: appointmentData.venue || "",
          SERVICE_TYPE: appointmentData.serviceType || "",
          PARTY_SIZE: appointmentData.partySize || "",
          DATE_PREFS: appointmentData.date || "",
          TIME_WINDOW: appointmentData.time || ""
        }
      }
    };

    try {
      const callResponse = await vapiAxios.post('/call', callData);
      const call = callResponse.data;

      return {
        content: [
          {
            type: "text",
            text: `🎉 **Call Initiated Successfully!**

📞 **Calling**: ${targetPhone}
👤 **For**: ${userName}
🎯 **Request**: ${request}
📋 **Call ID**: ${call.id}
⏱️ **Status**: ${call.status}
🕐 **Started**: ${call.createdAt}

Calli AI is now calling the business to make your appointment. The call will automatically adapt to the business type and handle the booking professionally.

**Key Features Active**:
✅ Universal business type detection
✅ No awkward phone number readbacks
✅ Context-aware conversation flow
✅ Real-time call monitoring

Use \`check_call_status\` with call ID \`${call.id}\` to monitor progress and get the final results.`
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to initiate call: ${error.response?.data?.message || error.message}`);
    }
  }

  async checkCallStatus(args) {
    const { callId } = args;

    const VAPI_API_BASE = 'https://api.vapi.ai';
    const VAPI_API_KEY = process.env.VAPI_API_KEY;

    const vapiAxios = axios.create({
      baseURL: VAPI_API_BASE,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    try {
      const response = await vapiAxios.get(`/call/${callId}`);
      const call = response.data;

      let statusText = `📊 **Call Status Update**

📋 **Call ID**: ${call.id}
📞 **Status**: ${call.status}
⏱️ **Duration**: ${call.duration || 'N/A'}s
🎯 **End Reason**: ${call.endedReason || 'In progress'}
🕐 **Created**: ${call.createdAt}`;

      if (call.endedAt) {
        statusText += `\n🏁 **Ended**: ${call.endedAt}`;
      }

      // Add transcript if available
      if (call.transcript) {
        statusText += `\n\n📝 **Call Transcript**:\n\`\`\`\n${call.transcript}\n\`\`\``;

        // Analyze for key improvements
        const transcript = call.transcript.toLowerCase();
        const hasPhoneReadback = transcript.includes('6-1-9') || transcript.includes('six one nine');

        statusText += `\n\n🔍 **Quality Analysis**:`;
        statusText += `\n${!hasPhoneReadback ? '✅' : '❌'} Phone number readback: ${!hasPhoneReadback ? 'GOOD - No readback detected' : 'ISSUE - Phone number was read back'}`;
      }

      // Add summary if available
      if (call.summary) {
        statusText += `\n\n📋 **Summary**: ${call.summary}`;
      }

      // Add analysis if available
      if (call.analysis) {
        statusText += `\n\n🤖 **AI Analysis**: ${JSON.stringify(call.analysis, null, 2)}`;
      }

      // Add cost if available
      if (call.cost) {
        statusText += `\n\n💰 **Cost**: $${call.cost}`;
      }

      return {
        content: [
          {
            type: "text",
            text: statusText
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to get call status: ${error.response?.data?.message || error.message}`);
    }
  }

  parseAppointmentRequest(text) {
    // Extract appointment details from natural language
    const result = {
      venue: null,
      serviceType: null,
      partySize: null,
      date: null,
      time: null
    };

    // Extract venue/business name
    const venuePatterns = [
      /(?:at|restaurant|office|salon|with)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s|,|\.|\?|for|on|at|\d|$)/i,
      /call\s+(?:\([0-9-\s]+\)|\+?[0-9-\s]+)\s+(?:to|for|at)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s|,|\.|\?|for|on|at|\d|$)/i
    ];

    for (const pattern of venuePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.venue = match[1].trim();
        break;
      }
    }

    // Extract service type
    const servicePatterns = [
      /(appointment|consultation|check-up|cleaning|haircut|color|massage|facial|meeting|service|reservation|table)/i,
      /(doctor|medical|dental|legal|hair|nail|skin|massage|meeting|dining)/i
    ];

    for (const pattern of servicePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.serviceType = match[1].toLowerCase();
        break;
      }
    }

    // Extract party size
    const partySizeMatch = text.match(/(?:for|table for|party of|group of)\s+(\d+)/i);
    if (partySizeMatch) {
      result.partySize = partySizeMatch[1];
    }

    // Extract time
    const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)|(\d{1,2})\s*(am|pm|AM|PM)/i);
    if (timeMatch) {
      result.time = timeMatch[0];
    }

    // Extract date
    const datePatterns = [
      /(today|tonight|tomorrow|tmrw)/i,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(next\s+\w+)/i,
      /(this\s+\w+)/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.date = match[1];
        break;
      }
    }

    return result;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Calli Poke MCP server running on stdio");
  }
}

const server = new CalliPokeServer();
server.run().catch(console.error);