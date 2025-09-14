import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const VAPI_API_BASE = 'https://api.vapi.ai';
const API_KEY = process.env.VAPI_API_KEY;

// Setup axios with authentication
const vapiAxios = axios.create({
  baseURL: VAPI_API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function callMatthew() {
  console.log('📞 Calling Matthew at 812-550-5590...\n');

  try {
    // Create the call with restaurant reservation context
    const callData = {
      phoneNumberId: process.env.VAPI_PHONE_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: '+18125505590'
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: 'Matthew',
          USER_PHONE: '+18125505590',
          USER_EMAIL: 'matthew@example.com',
          USER_TZ: 'America/New_York',
          REQUEST_CONTEXT: 'Test call to validate Calli\'s voice capabilities and conversation flow for restaurant reservations',
          VENUE_NAME: 'Test Restaurant',
          PARTY_SIZE: '2',
          DATE_PREFS: 'this evening',
          TIME_WINDOW: '7:30 PM'
        },
        firstMessage: 'Hi Matthew! This is Calli calling to test the voice reservation system. I\'m going to simulate making a restaurant reservation to validate the conversation flow. This should only take about 30 seconds to a minute.'
      }
    };

    console.log('📋 Call parameters:');
    console.log(`   From: Phone ID ${process.env.VAPI_PHONE_ID}`);
    console.log(`   To: +18125505590 (Matthew)`);
    console.log(`   Assistant: ${process.env.VAPI_ASSISTANT_ID}`);
    console.log(`   Test context: Restaurant reservation simulation\n`);

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ Call initiated successfully!');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Created: ${call.createdAt}\n`);

    // Monitor call status
    console.log('⏳ Monitoring call status (answer your phone!)...');
    let callComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // 3+ minutes max

    while (!callComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      try {
        const statusResponse = await vapiAxios.get(`/call/${call.id}`);
        const currentCall = statusResponse.data;

        console.log(`   [${attempts * 10}s] Status: ${currentCall.status}`);

        if (currentCall.status === 'ended') {
          callComplete = true;
          console.log('\n📞 Call completed!');
          console.log(`   Duration: ${currentCall.duration || 'unknown'}s`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.transcript) {
            console.log('\n📝 Call transcript:');
            console.log(currentCall.transcript);
          }

          if (currentCall.summary) {
            console.log('\n📋 Call summary:');
            console.log(currentCall.summary);
          }

          if (currentCall.analysis) {
            console.log('\n🔍 Call analysis:');
            console.log(JSON.stringify(currentCall.analysis, null, 2));
          }

        } else if (['failed', 'busy', 'no-answer'].includes(currentCall.status)) {
          callComplete = true;
          console.log(`\n❌ Call ${currentCall.status}`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.status === 'no-answer') {
            console.log('   💡 Make sure to answer the phone quickly for testing!');
          }
        }

      } catch (error) {
        console.log(`   [${attempts * 10}s] Error checking status: ${error.response?.status || error.message}`);
      }
    }

    if (attempts >= maxAttempts && !callComplete) {
      console.log('\n⏰ Monitoring timeout reached. Call may still be in progress.');
      console.log('   You can check the VAPI dashboard for final results.');
    }

    console.log('\n🎯 Call test summary:');
    console.log('   - Voice quality assessment');
    console.log('   - Conversation flow validation');
    console.log('   - Variable injection verification');
    console.log('   - Assistant response appropriateness');

  } catch (error) {
    console.error('\n❌ Call test failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 400) {
        console.error('   💡 Check phone number format and assistant/phone IDs');
      } else if (error.response.status === 402) {
        console.error('   💳 Insufficient credits or billing issue');
      }
    }
  }
}

// Show configuration and run the call
console.log('🔧 Current configuration:');
console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID || '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

// Run the test call
callMatthew();