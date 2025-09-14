#!/usr/bin/env python3
"""
Calli Poke MCP Server - Python FastMCP Implementation
AI scheduling assistant that integrates Poke automations with VAPI voice AI for restaurant reservations
"""

import os
import re
import json
import asyncio
import aiohttp
from datetime import datetime
from typing import Optional, Dict, Any
from fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("calli-poke", version="1.0.0")

# VAPI configuration
VAPI_API_BASE = "https://api.vapi.ai"
VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_PHONE_ID = os.getenv("VAPI_PHONE_ID")
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID")
POKE_API_KEY = os.getenv("POKE_API_KEY")

class CallMonitor:
    """Monitor VAPI calls and send results back to Poke"""

    def __init__(self):
        self.active_monitors = {}

    async def start_monitoring(self, call_id: str, user_name: str):
        """Start monitoring a call and notify Poke when complete"""
        print(f"🔍 [MONITOR] Starting monitoring for {call_id} (user: {user_name})")

        # Create async task to monitor the call
        task = asyncio.create_task(self._monitor_call(call_id, user_name))
        self.active_monitors[call_id] = task
        return task

    async def _monitor_call(self, call_id: str, user_name: str):
        """Monitor call status and send Poke notification when complete"""
        max_attempts = 30
        attempt = 0

        async with aiohttp.ClientSession() as session:
            while attempt < max_attempts:
                attempt += 1

                try:
                    # Check call status
                    headers = {
                        "Authorization": f"Bearer {VAPI_API_KEY}",
                        "Content-Type": "application/json"
                    }

                    async with session.get(f"{VAPI_API_BASE}/call/{call_id}", headers=headers) as response:
                        if response.status == 200:
                            call_data = await response.json()
                            status = call_data.get("status")

                            print(f"🔍 [MONITOR] Status for {call_id}: {status} (attempt {attempt})")

                            if status in ["ended", "failed", "busy", "no-answer"]:
                                await self._send_poke_notification(call_data, user_name)
                                break

                        await asyncio.sleep(10)  # Wait 10 seconds between checks

                except Exception as e:
                    print(f"❌ [MONITOR] Error monitoring {call_id}: {e}")
                    await asyncio.sleep(10)

        # Clean up
        self.active_monitors.pop(call_id, None)

    async def _send_poke_notification(self, call_data: dict, user_name: str):
        """Send notification to Poke about call completion"""
        if not POKE_API_KEY:
            print("📧 [POKE] No API key - skipping notification")
            return

        call_id = call_data.get("id")
        status = call_data.get("status")
        duration = call_data.get("duration", 0)

        # Build notification message
        message = f"🤖 **Calli Call Complete** - {user_name}\n\n"
        message += f"📞 **Status**: {status}\n"
        message += f"⏱️ **Duration**: {duration}s\n"

        if status == "ended":
            message += f"🎯 **Result**: {call_data.get('endedReason', 'completed')}\n"

            if call_data.get("summary"):
                message += f"\n📋 **Summary**: {call_data['summary']}\n"

            if call_data.get("transcript"):
                transcript = call_data["transcript"].lower()
                has_booking = any(word in transcript for word in ["confirmed", "booked", "reservation"])
                has_time = bool(re.search(r'\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)', transcript, re.I))

                if has_booking and has_time:
                    message += "\n✅ **Likely Success**: Booking language detected\n"

                # Extract key conversation snippets
                sentences = [s.strip() for s in re.split(r'[.!?]+', call_data["transcript"]) if len(s.strip()) > 10]
                key_phrases = '. '.join(sentences[:3])
                if len(sentences) > 3:
                    key_phrases += "..."
                message += f"\n💬 **Key Conversation**: \"{key_phrases}\"\n"
        else:
            message += f"\n❌ **Issue**: {call_data.get('endedReason', 'Call was not successful')}\n"

            if status == "no-answer":
                message += "💡 **Suggestion**: Try calling back later or check if the number is correct\n"
            elif status == "busy":
                message += "💡 **Suggestion**: The line was busy - try again soon\n"

        message += f"\n🔗 **Call ID**: {call_id}"

        # Send to Poke
        try:
            async with aiohttp.ClientSession() as session:
                poke_data = {"message": message}
                headers = {
                    "Authorization": f"Bearer {POKE_API_KEY}",
                    "Content-Type": "application/json"
                }

                async with session.post("https://poke.com/api/v1/inbound-sms/webhook",
                                      json=poke_data, headers=headers) as response:
                    if response.status == 200:
                        print("✅ [POKE] Notification sent successfully")
                    else:
                        print(f"❌ [POKE] Failed to send notification: {response.status}")

        except Exception as e:
            print(f"❌ [POKE] Error sending notification: {e}")

# Global call monitor instance
call_monitor = CallMonitor()

def extract_phone_number(text: str) -> Optional[str]:
    """Extract phone number from text"""
    patterns = [
        r'\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})',
        r'\+?([0-9]{1,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{4})',
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            phone = re.sub(r'[^\d+]', '', match.group(0))
            # Add country code if missing
            if not phone.startswith('+'):
                if len(phone) == 10:
                    phone = '+1' + phone
                elif len(phone) == 11 and phone.startswith('1'):
                    phone = '+' + phone
            return phone
    return None

def parse_reservation_request(text: str, user_name: str = "Customer") -> dict:
    """Parse reservation details from text"""
    request = {
        "userName": user_name,
        "originalText": text,
        "phoneNumber": extract_phone_number(text),
        "venueName": None,
        "partySize": None,
        "date": None,
        "time": None
    }

    # Extract venue name
    venue_patterns = [
        r'^call\s+([A-Za-z0-9\'\s&.,-]+?)(?:\s+at\s+[\+\(]?\d)',
        r'table\s+for\s+\d+\s+at\s+([A-Za-z0-9\'\s&.,-]+?)(?:\s+(?:tonight|today|tomorrow|on|for)|\s*$)',
        r'reservation\s+at\s+([A-Za-z0-9\'\s&.,-]+?)(?:\s+(?:for|on|at|tonight|today|tomorrow)|\s*$)',
        r'\bat\s+([A-Za-z0-9\'\s&.,-]+?)(?:\s+(?:tonight|today|tomorrow|on|for)|\s*$)',
    ]

    for pattern in venue_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            venue = match.group(1).strip()
            venue = re.sub(r'^(the|a|an)\s+', '', venue, flags=re.I)
            venue = re.sub(r'\s+(restaurant|cafe|pizza|grill|bistro|bar|diner)$', '', venue, flags=re.I)
            if len(venue) > 2:
                request["venueName"] = venue
                break

    # Extract party size
    party_match = re.search(r'(?:for|table for|party of|group of|reservation for)\s+(\d+)', text, re.I)
    if party_match:
        request["partySize"] = int(party_match.group(1))

    # Extract time
    time_patterns = [
        r'(\d{1,2}:\d{2})\s*(am|pm|AM|PM)',
        r'(\d{1,2})\s*(am|pm|AM|PM)',
        r'(\d{1,2}:\d{2})',
        r'around\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)',
    ]

    for pattern in time_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            if len(match.groups()) > 1 and match.group(2):
                request["time"] = f"{match.group(1)} {match.group(2).upper()}"
            else:
                request["time"] = match.group(1)
            break

    # Extract date
    date_patterns = [
        r'(today|tonight|this evening)',
        r'(tomorrow|tomorrow night|tomorrow evening)',
        r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+night|\s+evening)?',
        r'(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
    ]

    for pattern in date_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            request["date"] = match.group(0)
            break

    return request

@mcp.tool
async def make_phone_call(phone_number: str, request_message: str, user_name: str = "Customer") -> dict:
    """
    Make a phone call to schedule appointments at restaurants, medical offices, salons, or any business.

    Args:
        phone_number: Phone number to call (e.g., '619-853-2051' or '+1-619-853-2051')
        request_message: What you want to schedule (e.g., 'book a table for 2 at Luigi's tonight at 7:30 PM')
        user_name: Name of the person making the appointment (default: 'Customer')

    Returns:
        dict: Call status and details
    """
    print(f"🔄 [MAKE_CALL] Starting call process for {user_name}")

    # Parse the reservation request
    request = parse_reservation_request(request_message, user_name)

    if not request["phoneNumber"]:
        request["phoneNumber"] = phone_number

    if not VAPI_API_KEY or not VAPI_PHONE_ID or not VAPI_ASSISTANT_ID:
        raise Exception("VAPI configuration incomplete - missing API keys")

    # Create variable values for the assistant
    variable_values = {
        "USER_NAME": request["userName"],
        "USER_PHONE": phone_number or "",
        "USER_EMAIL": "",
        "USER_TZ": "America/New_York",
        "REQUEST_CONTEXT": request["originalText"],
        "VENUE_NAME": request["venueName"] or "",
        "PARTY_SIZE": str(request["partySize"] or ""),
        "DATE_PREFS": request["date"] or "",
        "TIME_WINDOW": request["time"] or ""
    }

    print(f"🚀 [VAPI_CALL] Initiating call with variables: {variable_values}")

    # Create the VAPI call
    call_data = {
        "phoneNumberId": VAPI_PHONE_ID,
        "assistantId": VAPI_ASSISTANT_ID,
        "customer": {
            "number": request["phoneNumber"]
        },
        "assistantOverrides": {
            "variableValues": variable_values
        }
    }

    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {VAPI_API_KEY}",
                "Content-Type": "application/json"
            }

            async with session.post(f"{VAPI_API_BASE}/call", json=call_data, headers=headers) as response:
                if response.status == 200:
                    call_result = await response.json()
                    call_id = call_result.get("id")

                    print(f"✅ [VAPI_CALL] Call initiated successfully: {call_id}")

                    # Start call monitoring
                    await call_monitor.start_monitoring(call_id, request["userName"])

                    return {
                        "success": True,
                        "message": f"📞 Calling {request['phoneNumber']} to make your reservation...",
                        "callId": call_id,
                        "status": "initiated",
                        "details": {
                            "venue": request["venueName"] or "restaurant",
                            "partySize": request["partySize"],
                            "requestedDate": request["date"],
                            "requestedTime": request["time"],
                            "phone": request["phoneNumber"]
                        }
                    }
                else:
                    error_text = await response.text()
                    print(f"❌ [VAPI_CALL] Call failed: {response.status} - {error_text}")
                    raise Exception(f"VAPI call failed: {response.status} - {error_text}")

    except Exception as error:
        print(f"❌ [VAPI_CALL] Call initiation failed: {error}")
        raise error

@mcp.tool
def get_server_info() -> dict:
    """Get information about the Calli Poke MCP server"""
    return {
        "name": "Calli Poke MCP Server",
        "version": "1.0.0",
        "description": "AI scheduling assistant that integrates Poke automations with VAPI voice AI",
        "capabilities": ["phone_calls", "restaurant_reservations", "appointment_scheduling"],
        "status": "active",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("🚀 [CALLI_POKE] Starting Calli Poke MCP Server (Python FastMCP)...")
    print(f"🔑 [CONFIG] VAPI Key: {'Present' if VAPI_API_KEY else 'Missing'}")
    print(f"📞 [CONFIG] VAPI Phone: {'Present' if VAPI_PHONE_ID else 'Missing'}")
    print(f"🤖 [CONFIG] VAPI Assistant: {'Present' if VAPI_ASSISTANT_ID else 'Missing'}")
    print(f"🌐 [CONFIG] Poke Key: {'Present' if POKE_API_KEY else 'Missing'}")

    # Get host and port from environment
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"

    print(f"🌐 [SERVER] Starting FastMCP HTTP server on {host}:{port}")
    mcp.run(
        transport="http",
        host=host,
        port=port,
        stateless_http=True
    )