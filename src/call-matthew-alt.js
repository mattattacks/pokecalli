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

async function callMatthewAlt() {
  console.log('📞 Calling Matthew at Alternative Number: (619) 853-2053\n');

  try {
    // Create the call to the alternative number
    const callData = {
      phoneNumberId: process.env.VAPI_PHONE_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: '+16198532053'  // Matthew's alternative number in E.164 format
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: 'Matthew',
          USER_PHONE: '+16198532053',
          USER_EMAIL: 'matthew@example.com',
          USER_TZ: 'America/New_York',
          REQUEST_CONTEXT: 'Second test call to validate Calli voice system - please answer to confirm system is working',
          VENUE_NAME: 'Test Restaurant',
          PARTY_SIZE: '2',
          DATE_PREFS: 'this evening',
          TIME_WINDOW: '7:30 PM'
        },
        firstMessage: 'Hi Matthew! This is Calli calling your second phone number to test the voice system. Please stay on the line for about 30 seconds so we can validate the conversation works properly. Can you hear me clearly?'
      }
    };

    console.log('📋 Call parameters:');
    console.log(`   From: Phone ID ${process.env.VAPI_PHONE_ID}`);
    console.log(`   From Number: +16193911386 (VAPI caller ID)`);
    console.log(`   To: +16198532053 (Matthew's alt number)`);
    console.log(`   Assistant: ${process.env.VAPI_ASSISTANT_ID}`);
    console.log(`   Test message: Asking Matthew to confirm voice quality\n`);

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ Call initiated successfully!');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Created: ${call.createdAt}\n`);

    // Monitor call status with more frequent updates
    console.log('⏳ Monitoring call status - PLEASE ANSWER YOUR PHONE!');
    console.log('   📱 Look for incoming call from +16193911386');
    console.log('   🎤 Please talk back to Calli to test conversation\n');

    let callComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    let lastStatus = '';

    while (!callComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds for responsiveness
      attempts++;

      try {
        const statusResponse = await vapiAxios.get(`/call/${call.id}`);
        const currentCall = statusResponse.data;

        // Only log status changes to reduce noise
        if (currentCall.status !== lastStatus) {
          console.log(`   [${attempts * 5}s] Status: ${lastStatus} → ${currentCall.status}`);
          lastStatus = currentCall.status;
        } else {
          process.stdout.write('.');  // Show activity without new line
        }

        if (currentCall.status === 'ended') {
          callComplete = true;
          console.log('\n\n📞 Call completed!');
          console.log(`   Duration: ${currentCall.duration || 'unknown'}s`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.transcript) {
            console.log('\n📝 Full call transcript:');
            console.log('─'.repeat(50));
            console.log(currentCall.transcript);
            console.log('─'.repeat(50));
          }

          if (currentCall.summary) {
            console.log('\n📋 Call summary:');
            console.log(currentCall.summary);
          }

          if (currentCall.analysis) {
            console.log('\n🔍 Call analysis:');
            console.log(JSON.stringify(currentCall.analysis, null, 2));
          }

          if (currentCall.cost) {
            console.log(`\n💰 Call cost: $${currentCall.cost}`);
          }

          // Analyze the results
          console.log('\n🎯 Test Results Analysis:');
          if (currentCall.endedReason === 'silence-timed-out') {
            console.log('   ⚠️  Call ended due to silence - phone may not have been answered');
          } else if (currentCall.endedReason === 'customer-ended-call') {
            console.log('   ✅ Customer (Matthew) ended the call - PHONE CALL WAS RECEIVED!');
          } else if (currentCall.duration && parseInt(currentCall.duration) > 10) {
            console.log('   ✅ Call lasted >10 seconds - likely received and answered');
          } else {
            console.log('   ❓ Unclear if call was received based on end reason');
          }

        } else if (['failed', 'busy', 'no-answer'].includes(currentCall.status)) {
          callComplete = true;
          console.log(`\n\n❌ Call ${currentCall.status}`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.status === 'no-answer') {
            console.log('   💡 Phone may be turned off, out of service, or blocking calls');
          } else if (currentCall.status === 'busy') {
            console.log('   📞 Phone line was busy - this means the number is valid!');
          }
        }

      } catch (error) {
        console.log(`\n   [${attempts * 5}s] Error checking status: ${error.response?.status || error.message}`);
      }
    }

    if (attempts >= maxAttempts && !callComplete) {
      console.log('\n\n⏰ Monitoring timeout reached. Checking final status...');
      try {
        const finalStatus = await vapiAxios.get(`/call/${call.id}`);
        console.log(`   Final status: ${finalStatus.data.status}`);
      } catch (e) {
        console.log('   Could not get final status');
      }
    }

  } catch (error) {
    console.error('\n❌ Call test failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 400) {
        console.error('   💡 Check phone number format: +16198532053');
      } else if (error.response.status === 402) {
        console.error('   💳 Insufficient credits or billing issue');
      }
    }
  }
}

// Show current time and configuration
console.log('🕐 Current time:', new Date().toLocaleString());
console.log('🔧 Configuration:');
console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID || '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

// Run the test call
callMatthewAlt();