# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Calli Poke** project - an AI scheduling assistant that integrates Poke automations with VAPI (Voice AI) to make restaurant reservations via phone calls. The project was designed for the HackMIT sponsor challenge from Interaction Co. (makers of Poke).

### Core Functionality
- Receives scheduling requests through Poke (triggered by email or user command)
- Uses VAPI to make AI-powered phone calls to restaurants
- Returns structured reservation confirmations to users via Poke

## Architecture

The project consists of three main components:

1. **Poke MCP Integration Server** - Receives automation requests from Poke and triggers voice calls
2. **VAPI Voice Assistant ("Calli")** - AI agent that handles phone conversations with restaurants
3. **Result Processing** - Parses call outcomes and returns formatted confirmations to users

### Key Services
- **Poke**: Email-to-automation platform that triggers the integration
- **VAPI**: Voice AI platform for making outbound calls with GPT-4-powered agents
- **MCP (Model Context Protocol)**: Communication protocol between Poke and the integration server

## Environment Variables

The project uses several API keys and IDs stored in `secrets.rtf`:

```
vapi=8556bec9-72d2-4ef6-8239-92d07780088e
vapi_phone=328097e2-8e76-433e-b900-d9b4ac3ad88b
vapi_assistant=dca10f6b-d35f-4b9f-b2cd-05faa8671269
poke=pk_VkD60f27TcHRdSwjY4dXUPvHeCssuM76Vzr71yPfkOI
```

**Important**: These are sensitive credentials and should never be committed to version control.

## Project Structure

This appears to be a documentation-only repository with:
- `readme.rtf` - Comprehensive implementation guide and technical specifications
- `secrets.rtf` - API keys and service IDs (should be moved to environment variables)

## Implementation Notes

Based on the project documentation:

### Request Flow
1. User sends email with reservation request (e.g., "Make me a reservation at Turoni's for 8:30 PM Friday. Here is their number: 812-555-1234")
2. Poke triggers the MCP integration with the email content
3. Integration server parses phone number and request details
4. VAPI creates outbound call using the "Calli" assistant
5. Assistant converses with restaurant staff to make reservation
6. Call results are parsed and formatted confirmation is sent back to user

### Key Technical Decisions
- Uses VAPI's hosted MCP server (https://mcp.vapi.ai/mcp) to avoid custom deployment
- Leverages GPT-4 (via VAPI's `gpt-4o` model) for conversation handling
- Implements structured JSON output from voice assistant for result parsing
- Supports variable injection via `assistantOverrides.variableValues` for personalization

## Development Setup

Since this is a documentation repository, actual implementation would require:

1. Setting up the MCP integration server (using Interaction Co.'s template or VAPI's MCP server)
2. Configuring the VAPI assistant with the scheduling prompt
3. Deploying to a secure HTTPS endpoint for Poke integration
4. Testing the end-to-end flow with real phone numbers

## Related Resources

- **GitHub Repo**: https://github.com/mattattacks/pokecalli
- **Poke MCP Template**: InteractionCo/mcp-server-template
- **VAPI MCP Server**: VapiAI/mcp-server
- **VAPI SDKs**: VapiAI/server-sdk-typescript, VapiAI/server-sdk-python