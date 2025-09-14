import dotenv from 'dotenv';
import axios from 'axios';
import readline from 'readline';

// Load environment variables
dotenv.config();

const VAPI_API_BASE = 'https://api.vapi.ai';
const API_KEY = process.env.VAPI_API_KEY;

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Setup axios with authentication
const vapiAxios = axios.create({
  baseURL: VAPI_API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testOutboundCall() {
  console.log('📞 VAPI Outbound Call Test\n');

  try {
    // Get user confirmation and phone number
    console.log('⚠️  This will make a real phone call using VAPI credits.');
    const consent = await askQuestion('Do you want to proceed? (y/N): ');

    if (consent.toLowerCase() !== 'y' && consent.toLowerCase() !== 'yes') {
      console.log('❌ Test cancelled by user');
      process.exit(0);
    }

    const phoneNumber = await askQuestion('Enter phone number to call (with country code, e.g., +1234567890): ');

    if (!phoneNumber.startsWith('+')) {
      console.log('❌ Phone number must include country code (start with +)');
      process.exit(1);
    }

    console.log('\n🚀 Initiating test call...');

    // Create the call
    const callData = {
      phoneNumberId: process.env.VAPI_PHONE_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: phoneNumber
      },
      // Add basic context for testing
      assistantOverrides: {
        variableValues: {
          userName: 'Test User',
          requestContext: 'This is a test call to verify VAPI functionality'
        },
        firstMessage: 'Hi! This is a test call from Calli. I\'m just checking that the voice system is working correctly. This should only take a moment.'
      }
    };

    console.log('📋 Call parameters:');
    console.log(`   From: Phone ID ${process.env.VAPI_PHONE_ID}`);
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Assistant: ${process.env.VAPI_ASSISTANT_ID}`);
    console.log(`   Test message: "${callData.assistantOverrides.firstMessage}"\n`);

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ Call initiated successfully!');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Created: ${call.createdAt}\n`);

    // Monitor call status
    console.log('⏳ Monitoring call status...');
    let callComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

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
            console.log(`   ${currentCall.transcript}`);
          }

          if (currentCall.summary) {
            console.log('\n📋 Call summary:');
            console.log(`   ${currentCall.summary}`);
          }

        } else if (['failed', 'busy', 'no-answer'].includes(currentCall.status)) {
          callComplete = true;
          console.log(`\n❌ Call failed with status: ${currentCall.status}`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);
        }

      } catch (error) {
        console.log(`   [${attempts * 10}s] Error checking status: ${error.response?.status || error.message}`);
      }
    }

    if (attempts >= maxAttempts && !callComplete) {
      console.log('\n⏰ Monitoring timeout reached. Call may still be in progress.');
      console.log('   You can check the VAPI dashboard for final results.');
    }

  } catch (error) {
    console.error('\n❌ Call test failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 400) {
        console.error('   💡 Check your phone number format and assistant/phone IDs');
      } else if (error.response.status === 402) {
        console.error('   💳 Insufficient credits or billing issue');
      }
    }
  } finally {
    rl.close();
  }
}

// Show current configuration
console.log('🔧 Current configuration:');
console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID || '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

// Run the test
testOutboundCall();