#!/usr/bin/env node

/**
 * FastMCP Server for Poke Integration
 * Following the exact pattern from InteractionCo/mcp-server-template
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";
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

// Initialize FastMCP server
const server = new FastMCP({
  name: "calli-poke",
  version: "1.0.0"
});

// Add the make_phone_call tool
server.addTool({
  name: "make_phone_call",
  description: "Make a phone call to schedule appointments at restaurants, medical offices, salons, or any business",
  parameters: z.object({
    phone_number: z.string().describe("Phone number to call (e.g., '619-853-2051' or '+1-619-853-2051')"),
    request_message: z.string().describe("What you want to schedule (e.g., 'book a table for 2 at Luigi's tonight at 7:30 PM')"),
    user_name: z.string().default("Customer").describe("Name of the person making the appointment")
  }),
  execute: async ({ phone_number, request_message, user_name }) => {
    return await makePhoneCall({ phone_number, request_message, user_name });
  }
});

async function makePhoneCall({ phone_number, request_message, user_name = "Customer" }) {
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

    return `📞 **Call Initiated Successfully!**

Calling: ${cleanPhone}
For: ${user_name}
Request: ${request_message}

Call ID: ${call.id}
Status: ${call.status}
Started: ${call.createdAt}

Calli AI is now making the call. You'll receive a follow-up message with the results.`;

  } catch (error) {
    throw new Error(`Failed to initiate call: ${error.response?.data?.message || error.message}`);
  }
}

// Start server
const port = parseInt(process.env.PORT || "8000");
const host = "0.0.0.0";

console.log(`Starting FastMCP server on ${host}:${port}`);

server.start({
  transportType: "httpStream",
  httpStream: {
    port: port,
    endpoint: "/mcp"
  }
});