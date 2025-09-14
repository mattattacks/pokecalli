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
      // Assume local number, need area code - this would be an error
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
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,  // 12/25 or 12/25/2024
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
    // "book a table at Luigi's Pizza"
    /(?:at|to)\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    // "Luigi's Pizza for tonight"
    /^(.+?)\s+(?:for|on|at|tonight|today|tomorrow)/i,
    // "make a reservation at The Cheesecake Factory"
    /reservation\s+at\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)/i,
    // "call Luigi's Pizza"
    /call\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+(?:for|to|about|regarding)|\s*$)/i,
    // "book Luigi's for 2 people"
    /book\s+([A-Za-z0-9'\s&.,-]+?)(?:\s+for|\s*$)/i,
    // General pattern for restaurant names
    /([A-Za-z0-9'\s&.,-]{2,30})(?:\s+(?:restaurant|cafe|pizza|grill|bistro|bar|diner))?/i
  ];

  let venueName = '';
  for (const pattern of venuePatterns) {
    const match = request_message.match(pattern);
    if (match && match[1]) {
      venueName = match[1].trim();
      // Clean up venue name
      venueName = venueName.replace(/^(the|a|an)\s+/i, ''); // Remove articles
      venueName = venueName.replace(/\s+(restaurant|cafe|pizza|grill|bistro|bar|diner)$/i, ''); // Remove type suffixes
      if (venueName.length > 2) { // Only use if meaningful
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

      // Provide more specific error messages based on status codes
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

// Start server
const port = parseInt(process.env.PORT || "8000");
const host = "0.0.0.0";

console.log(`Starting FastMCP server on ${host}:${port}`);

// Start FastMCP server with httpStream transport
server.start({
  transportType: "httpStream",
  httpStream: {
    port: port,
    endpoint: "/mcp",
    host: host
  }
});

console.log(`FastMCP server running on ${host}:${port}/mcp`);