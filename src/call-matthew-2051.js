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

async function callMatthew2051() {
  console.log('📞 Calling Matthew at: (619) 853-2051\n');

  try {
    // Create the call to the new number
    const callData = {
      phoneNumberId: process.env.VAPI_PHONE_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: '+16198532051'  // Matthew's number in E.164 format
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: 'Matthew',
          USER_PHONE: '+16198532051',
          USER_EMAIL: 'matthew@example.com',
          USER_TZ: 'America/New_York',
          REQUEST_CONTEXT: 'Third test call to validate Calli voice system - confirming call delivery and voice quality',
          VENUE_NAME: 'Test Restaurant',
          PARTY_SIZE: '2',
          DATE_PREFS: 'this evening',
          TIME_WINDOW: '7:30 PM'
        },
        firstMessage: 'Hi Matthew! This is Calli calling (619) 853-2051 to test our voice reservation system. Please stay on the line and talk back to me so we can confirm everything is working perfectly. Can you hear me clearly?'
      }
    };

    console.log('📋 Call parameters:');
    console.log(`   From: Phone ID ${process.env.VAPI_PHONE_ID}`);
    console.log(`   From Number: +16193911386 (VAPI caller ID)`);
    console.log(`   To: +16198532051 (Matthew's test number)`);
    console.log(`   Assistant: ${process.env.VAPI_ASSISTANT_ID}`);
    console.log(`   Expected: Matthew should answer and talk back to Calli\n`);

    const callResponse = await vapiAxios.post('/call', callData);
    const call = callResponse.data;

    console.log('✅ Call initiated successfully!');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Created: ${call.createdAt}\n`);

    // Monitor call status with detailed updates
    console.log('⏳ Monitoring call status - ANSWER YOUR PHONE!');
    console.log('   📱 Incoming call should show: +16193911386');
    console.log('   🗣️  Please have a brief conversation with Calli');
    console.log('   ⏱️  Call will timeout after ~1 minute if silent\n');

    let callComplete = false;
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max (5-second intervals)
    let lastStatus = '';
    let statusHistory = [];

    while (!callComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      attempts++;

      try {
        const statusResponse = await vapiAxios.get(`/call/${call.id}`);
        const currentCall = statusResponse.data;

        // Track status changes
        if (currentCall.status !== lastStatus) {
          const timestamp = new Date().toLocaleTimeString();
          statusHistory.push({ time: timestamp, status: currentCall.status });
          console.log(`   [${timestamp}] Status: ${lastStatus || 'queued'} → ${currentCall.status}`);
          lastStatus = currentCall.status;
        } else {
          process.stdout.write('.');  // Show heartbeat
        }

        if (currentCall.status === 'ended') {
          callComplete = true;
          console.log('\n\n📞 Call Completed!\n');

          // Show status timeline
          console.log('📊 Call Timeline:');
          statusHistory.forEach(s => console.log(`   ${s.time}: ${s.status}`));
          console.log();

          console.log('📋 Call Results:');
          console.log(`   Duration: ${currentCall.duration || 'unknown'}s`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);
          console.log(`   Cost: $${currentCall.cost || 'unknown'}`);

          if (currentCall.transcript) {
            console.log('\n📝 Full Conversation Transcript:');
            console.log('═'.repeat(60));
            console.log(currentCall.transcript);
            console.log('═'.repeat(60));

            // Analyze transcript for interaction
            const transcript = currentCall.transcript.toLowerCase();
            const hasUserResponse = transcript.includes('user:') && transcript.split('user:').length > 1;

            console.log('\n🎯 Conversation Analysis:');
            if (hasUserResponse) {
              console.log('   ✅ INTERACTIVE CONVERSATION DETECTED!');
              console.log('   ✅ Matthew responded to Calli');
              console.log('   ✅ Two-way conversation confirmed');
            } else {
              console.log('   ⚠️  Only AI speech detected in transcript');
              console.log('   ❓ User may not have spoken back');
            }
          }

          if (currentCall.summary) {
            console.log('\n📄 Call Summary:');
            console.log(currentCall.summary);
          }

          if (currentCall.analysis) {
            console.log('\n🔍 AI Analysis:');
            const analysis = currentCall.analysis;
            console.log(`   Success Evaluation: ${analysis.successEvaluation || 'unknown'}`);
            console.log(`   Summary: ${analysis.summary || 'No summary'}`);
          }

          // Final assessment
          console.log('\n🎯 Final Assessment:');
          const duration = parseInt(currentCall.duration || '0');
          if (currentCall.endedReason === 'customer-ended-call' && duration > 15) {
            console.log('   🎉 EXCELLENT! Call was answered and lasted >15 seconds');
            console.log('   🎉 System is fully functional for real use');
          } else if (currentCall.endedReason === 'silence-timed-out') {
            console.log('   ⚠️  Call answered but ended due to silence');
            console.log('   💡 Phone may have auto-answered or gone to voicemail');
          } else if (duration > 0) {
            console.log('   ✅ Call connected successfully');
          } else {
            console.log('   ❌ Call may not have been properly delivered');
          }

        } else if (['failed', 'busy', 'no-answer'].includes(currentCall.status)) {
          callComplete = true;
          console.log(`\n\n❌ Call Failed: ${currentCall.status}`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.status === 'no-answer') {
            console.log('   💡 Phone did not answer - may be off or blocking calls');
          } else if (currentCall.status === 'busy') {
            console.log('   📞 Line was busy - phone number is definitely valid!');
          } else if (currentCall.status === 'failed') {
            console.log('   ⚠️  Technical failure - check number format or carrier issues');
          }
        }

      } catch (error) {
        console.log(`\n   [Error] Status check failed: ${error.response?.status || error.message}`);
      }
    }

    if (attempts >= maxAttempts && !callComplete) {
      console.log('\n\n⏰ Monitoring timeout - checking final status...');
      try {
        const finalCheck = await vapiAxios.get(`/call/${call.id}`);
        console.log(`   Final status: ${finalCheck.data.status}`);
        console.log(`   Final duration: ${finalCheck.data.duration || 0}s`);
      } catch (e) {
        console.log('   Could not retrieve final status');
      }
    }

  } catch (error) {
    console.error('\n❌ Call initiation failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Error Details: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 400) {
        console.error('\n💡 Phone number format issue:');
        console.error('   ✓ Check: +16198532051 is correct E.164 format');
        console.error('   ✓ Verify: Number is valid and reachable');
      } else if (error.response.status === 402) {
        console.error('\n💳 Billing/credit issue:');
        console.error('   ✓ Check VAPI account has sufficient credits');
        console.error('   ✓ Verify billing information is current');
      } else if (error.response.status === 401) {
        console.error('\n🔑 Authentication issue:');
        console.error('   ✓ Check API key is valid and active');
      }
    }
  }
}

// Show test setup
console.log('🕐 Test started at:', new Date().toLocaleString());
console.log('🔧 Configuration check:');
console.log(`   VAPI API Key: ${API_KEY ? '✅ Loaded' : '❌ Missing'}`);
console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID || '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

// Execute test
callMatthew2051();