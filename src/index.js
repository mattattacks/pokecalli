import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// VAPI configuration
const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_ID = process.env.VAPI_PHONE_ID;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

// Setup VAPI axios instance
const vapiAxios = axios.create({
  baseURL: VAPI_API_BASE,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Phone number extraction utility
function extractPhoneNumber(text) {
  // Regex patterns for various phone number formats
  const patterns = [
    /\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g, // US format
    /\+?([0-9]{1,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{4})/g, // International
    /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*)?(?:[2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*(?:\)\s*)?(?:[.-]\s*)?)?(?:[2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?(?:[0-9]{4})/g
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let phone = matches[0].replace(/[^\d+]/g, '');

      // Add country code if missing
      if (!phone.startsWith('+')) {
        if (phone.length === 10) {
          phone = '+1' + phone; // Assume US number
        } else if (phone.length === 11 && phone.startsWith('1')) {
          phone = '+' + phone;
        }
      }

      return phone;
    }
  }

  return null;
}

// Parse reservation request utility
function parseReservationRequest(text, userName = 'User') {
  // Extract key information from the request text
  const request = {
    userName,
    originalText: text,
    phoneNumber: extractPhoneNumber(text),
    veneName: null,
    partySize: null,
    date: null,
    time: null,
    specialRequests: []
  };

  // Extract venue name (look for restaurant names, "at", etc.)
  const venueMatch = text.match(/(?:at|restaurant|place called)\s+([A-Za-z0-9'\s]+?)(?:\s|,|\.|\?|for|$)/i);
  if (venueMatch) {
    request.venueName = venueMatch[1].trim();
  }

  // Extract party size
  const partySizeMatch = text.match(/(?:for|table for|party of|group of)\s+(\d+)/i);
  if (partySizeMatch) {
    request.partySize = parseInt(partySizeMatch[1]);
  }

  // Extract time references
  const timeMatches = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)|(\d{1,2})\s*(am|pm|AM|PM)/i);
  if (timeMatches) {
    request.time = timeMatches[0];
  }

  // Extract date references (basic patterns)
  const datePatterns = [
    /(?:today|tonight)/i,
    /(?:tomorrow|tmrw)/i,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
    /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      request.date = match[0];
      break;
    }
  }

  return request;
}

// MCP endpoint for Poke integration
app.post('/mcp', async (req, res) => {
  console.log('📨 Received MCP request from Poke:', JSON.stringify(req.body, null, 2));

  try {
    // Extract request information
    const { body, user, metadata } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'No request body provided' });
    }

    // Parse the reservation request
    const userName = user?.name || user?.email || 'User';
    const request = parseReservationRequest(body, userName);

    console.log('🔍 Parsed request:', request);

    if (!request.phoneNumber) {
      return res.status(400).json({
        error: 'No valid phone number found in request',
        message: 'Please include a phone number in your reservation request (e.g., "Call 555-123-4567 to book...")'
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

    console.log('📞 Initiating VAPI call with variables:', variableValues);

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

    console.log('✅ VAPI call initiated:', call.id);

    // Return immediate response to Poke
    res.json({
      success: true,
      message: `📞 Calling ${request.phoneNumber} to make your reservation...`,
      callId: call.id,
      status: 'initiated',
      details: {
        venue: request.venueName || 'restaurant',
        partySize: request.partySize,
        requestedDate: request.date,
        requestedTime: request.time
      }
    });

    // TODO: Set up webhook to monitor call completion and send results back to Poke
    // For now, we'll implement basic polling in a separate endpoint

  } catch (error) {
    console.error('❌ MCP request failed:', error.message);
    console.error('Response data:', error.response?.data);

    res.status(500).json({
      success: false,
      error: 'Failed to process reservation request',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Endpoint to check call status (for testing/monitoring)
app.get('/call-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
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
    console.error('❌ Failed to get call status:', error.message);
    res.status(500).json({ error: 'Failed to get call status', message: error.message });
  }
});

// Demo web interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🤖 Calli Poke - AI Appointment Scheduler</title>
        <style>
            body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
            .demo-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            .button:hover { background: #0056b3; }
            .success { color: #28a745; }
            .error { color: #dc3545; }
            input, textarea { width: 100%; padding: 8px; margin: 5px 0; }
            #result { margin-top: 20px; padding: 15px; border-radius: 4px; display: none; }
        </style>
    </head>
    <body>
        <h1>🤖 Calli Poke - Universal AI Appointment Scheduler</h1>
        <p><strong>Live Demo:</strong> AI voice assistant that calls any business to book appointments</p>

        <div class="demo-box">
            <h3>✨ What Calli Can Do:</h3>
            <ul>
                <li>📱 <strong>Restaurants:</strong> "Table for 4 at Olive Garden tonight at 7 PM"</li>
                <li>🏥 <strong>Medical:</strong> "Schedule check-up with Dr. Smith next Tuesday at 10 AM"</li>
                <li>💇 <strong>Beauty/Salon:</strong> "Book haircut and color for Saturday afternoon"</li>
                <li>⚖️ <strong>Legal:</strong> "Need consultation about contract review next week"</li>
                <li>🔧 <strong>Home Services:</strong> "Schedule HVAC maintenance, system making noise"</li>
                <li>🏢 <strong>Any Business:</strong> Just describe what you need!</li>
            </ul>
        </div>

        <div class="demo-box">
            <h3>🧪 Try It Now:</h3>
            <form id="demoForm">
                <label><strong>Your Request:</strong></label>
                <textarea id="message" placeholder="Call (619) 853-2051 to book a table for 2 at Luigi's tonight at 7:30 PM for our anniversary" rows="3"></textarea>

                <label><strong>Your Name:</strong></label>
                <input type="text" id="userName" value="Demo User" />

                <label><strong>Your Email:</strong></label>
                <input type="email" id="userEmail" value="demo@example.com" />

                <button type="submit" class="button">📞 Make Call with Calli</button>
            </form>

            <div id="result"></div>
        </div>

        <div class="demo-box">
            <h3>🎯 Key Features:</h3>
            <ul>
                <li>✅ <strong>Universal:</strong> Works with any business type</li>
                <li>✅ <strong>Smart:</strong> Auto-detects appointment type from context</li>
                <li>✅ <strong>Professional:</strong> No awkward phone number readbacks</li>
                <li>✅ <strong>Adaptive:</strong> Uses business-appropriate language</li>
                <li>✅ <strong>Real-time:</strong> Monitor calls in progress</li>
            </ul>
        </div>

        <div class="demo-box">
            <h3>🔗 API Endpoints:</h3>
            <ul>
                <li><code>POST /mcp</code> - Main Poke integration endpoint</li>
                <li><code>GET /call-status/:callId</code> - Monitor call progress</li>
                <li><code>GET /health</code> - System health check</li>
                <li><code>POST /test</code> - Manual testing endpoint</li>
            </ul>
        </div>

        <script>
            document.getElementById('demoForm').addEventListener('submit', async (e) => {
                e.preventDefault();

                const resultDiv = document.getElementById('result');
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '⏳ Processing your request...';
                resultDiv.className = '';

                try {
                    const response = await fetch('/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: document.getElementById('message').value,
                            userName: document.getElementById('userName').value,
                            userEmail: document.getElementById('userEmail').value
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        resultDiv.innerHTML = '✅ <strong>Call Initiated Successfully!</strong><br>' +
                                            'Call ID: ' + data.result.callId + '<br>' +
                                            'Status: ' + data.result.status + '<br>' +
                                            'Message: ' + data.result.message;
                        resultDiv.className = 'success';

                        // Monitor call status
                        if (data.result.callId) {
                            setTimeout(() => monitorCall(data.result.callId), 5000);
                        }
                    } else {
                        throw new Error(data.error || 'Unknown error');
                    }
                } catch (error) {
                    resultDiv.innerHTML = '❌ <strong>Error:</strong> ' + error.message;
                    resultDiv.className = 'error';
                }
            });

            async function monitorCall(callId) {
                try {
                    const response = await fetch('/call-status/' + callId);
                    const data = await response.json();

                    const resultDiv = document.getElementById('result');
                    resultDiv.innerHTML += '<br><br><strong>📊 Call Status:</strong> ' + data.status;

                    if (data.status === 'ended') {
                        resultDiv.innerHTML += '<br><strong>⏱️ Duration:</strong> ' + (data.duration || 0) + 's';
                        resultDiv.innerHTML += '<br><strong>🎯 End Reason:</strong> ' + (data.endedReason || 'unknown');
                        if (data.transcript) {
                            resultDiv.innerHTML += '<br><br><strong>📝 Transcript:</strong><br>' +
                                                  '<div style="background: white; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap;">' +
                                                  data.transcript + '</div>';
                        }
                    } else if (!['failed', 'busy', 'no-answer'].includes(data.status)) {
                        setTimeout(() => monitorCall(callId), 5000);
                    }
                } catch (error) {
                    console.error('Error monitoring call:', error);
                }
            }
        </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Calli Poke MCP Server',
    timestamp: new Date().toISOString(),
    config: {
      vapiConfigured: !!VAPI_API_KEY,
      phoneConfigured: !!VAPI_PHONE_ID,
      assistantConfigured: !!VAPI_ASSISTANT_ID
    }
  });
});

// Test endpoint for manual testing
app.post('/test', async (req, res) => {
  console.log('🧪 Test request received:', req.body);

  const testRequest = {
    body: req.body.message || "Call 555-123-4567 to book a table for 2 at Turoni's tonight at 7:30pm",
    user: {
      name: req.body.userName || "Test User",
      email: req.body.userEmail || "test@example.com"
    }
  };

  // Forward to MCP endpoint
  try {
    const response = await axios.post(`http://localhost:${PORT}/mcp`, testRequest, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json({ success: true, result: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Calli Poke MCP Server started');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('📋 Available endpoints:');
  console.log('   POST /mcp - Main MCP integration endpoint');
  console.log('   GET  /call-status/:callId - Check call status');
  console.log('   GET  /health - Health check');
  console.log('   POST /test - Manual testing endpoint');
  console.log();
  console.log('⚡ Ready to handle Poke automation requests!');
});