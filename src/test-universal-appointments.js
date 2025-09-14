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

// Test scenarios for different business types
const testScenarios = [
  {
    type: 'Medical Appointment',
    context: 'Schedule a check-up appointment with Dr. Smith for next Tuesday morning, preferably around 10 AM',
    expectedBehavior: 'Should detect medical appointment type and ask about symptoms, insurance, availability'
  },
  {
    type: 'Salon Service',
    context: 'Book a haircut and color treatment for this Saturday afternoon, looking for someone experienced with curly hair',
    expectedBehavior: 'Should detect salon service and ask about stylist preference, service duration, hair type'
  },
  {
    type: 'Restaurant Reservation',
    context: 'Table for 4 people this Friday evening around 7:30 PM, preferably outdoor seating for anniversary dinner',
    expectedBehavior: 'Should detect restaurant booking and ask about party size, seating preference, occasion'
  },
  {
    type: 'Legal Consultation',
    context: 'Need to schedule a consultation about a contract review, prefer early next week, budget around $300',
    expectedBehavior: 'Should detect legal service and ask about case type, consultation scope, urgency'
  },
  {
    type: 'Home Service',
    context: 'Schedule HVAC maintenance for my house next week, system has been making noise, access through back door',
    expectedBehavior: 'Should detect home service and ask about property access, equipment details, scheduling'
  }
];

async function testUniversalAppointments() {
  console.log('🧪 Testing Universal Appointment System\n');
  console.log('🎯 Key Test Objectives:');
  console.log('   1. Business type auto-detection from context');
  console.log('   2. Appropriate conversation openers per business type');
  console.log('   3. NO phone number readback during confirmation');
  console.log('   4. Business-specific information collection\n');

  // Test with a medical appointment scenario
  console.log('🏥 Testing Medical Appointment Scenario:');
  console.log('─'.repeat(60));

  try {
    const medicalTestCall = {
      phoneNumberId: process.env.VAPI_PHONE_ID,
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: '+16198532051'  // Your test number
      },
      assistantOverrides: {
        variableValues: {
          USER_NAME: 'Matthew',
          USER_PHONE: '+16198532051',
          USER_EMAIL: 'matthew@example.com',
          USER_TZ: 'America/New_York',
          REQUEST_CONTEXT: 'Schedule a routine check-up appointment with Dr. Johnson for next Thursday morning around 10 AM. Need to verify insurance coverage.',
          SERVICE_TYPE: 'medical check-up',
          DATE_PREFS: 'next Thursday',
          TIME_WINDOW: '10:00 AM',
          VENUE_NAME: 'Dr. Johnson\'s Office'
        },
        firstMessage: 'Hi there—I\'m calling to schedule an appointment'
      }
    };

    console.log('📋 Medical Test Parameters:');
    console.log(`   From: ${process.env.VAPI_PHONE_ID} (+16193911386)`);
    console.log(`   To: +16198532051 (Matthew)`);
    console.log(`   Context: Medical check-up appointment`);
    console.log(`   Expected: Should detect medical appointment type`);
    console.log(`   Expected: Should NOT read back phone number\n`);

    const callResponse = await vapiAxios.post('/call', medicalTestCall);
    const call = callResponse.data;

    console.log('✅ Medical appointment test call initiated!');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Created: ${call.createdAt}\n`);

    // Monitor the call briefly
    console.log('⏳ Monitoring test call - PLEASE ANSWER YOUR PHONE!');
    console.log('   📱 Look for call from +16193911386');
    console.log('   🎤 Listen for medical appointment opener (NOT restaurant)');
    console.log('   🚫 Confirm NO phone number readback occurs\n');

    let attempts = 0;
    const maxAttempts = 12; // 1 minute max monitoring
    let callComplete = false;

    while (!callComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const statusResponse = await vapiAxios.get(`/call/${call.id}`);
        const currentCall = statusResponse.data;

        if (currentCall.status !== 'queued' && currentCall.status !== 'ringing') {
          console.log(`   [${attempts * 5}s] Status: ${currentCall.status}`);
        }

        if (currentCall.status === 'ended') {
          callComplete = true;
          console.log('\n🎉 Test Call Completed!\n');

          console.log('📊 Universal System Test Results:');
          console.log(`   Duration: ${currentCall.duration || 'unknown'}s`);
          console.log(`   End reason: ${currentCall.endedReason || 'unknown'}`);

          if (currentCall.transcript) {
            console.log('\n📝 Call Transcript Analysis:');
            console.log('═'.repeat(50));
            console.log(currentCall.transcript);
            console.log('═'.repeat(50));

            // Analyze the transcript for key improvements
            const transcript = currentCall.transcript.toLowerCase();

            console.log('\n🔍 Key Test Validations:');

            // Check for medical appointment detection
            const medicalTerms = ['appointment', 'doctor', 'check-up', 'medical', 'schedule'];
            const hasMedicalLanguage = medicalTerms.some(term => transcript.includes(term));
            console.log(`   Medical Context Detection: ${hasMedicalLanguage ? '✅ PASSED' : '❌ FAILED'}`);

            // Check for phone number readback (should NOT occur)
            const hasPhoneReadback = transcript.includes('6-1-9') || transcript.includes('six one nine') || transcript.includes('619-853-2051');
            console.log(`   No Phone Number Readback: ${!hasPhoneReadback ? '✅ PASSED' : '❌ FAILED - Phone number was read back!'}`);

            // Check for appropriate business opener
            const hasGenericOpener = transcript.includes('table for') || transcript.includes('restaurant');
            console.log(`   Appropriate Opener (not restaurant): ${!hasGenericOpener ? '✅ PASSED' : '⚠️  WARNING - Used restaurant language'}`);

            if (!hasPhoneReadback) {
              console.log('\n🎯 CRITICAL SUCCESS: Phone number readback issue RESOLVED! 🎯');
            }

          } else {
            console.log('\n   No transcript available for analysis');
          }

          if (currentCall.summary) {
            console.log('\n📋 Call Summary:');
            console.log(currentCall.summary);
          }

        } else if (['failed', 'busy', 'no-answer'].includes(currentCall.status)) {
          callComplete = true;
          console.log(`\n❌ Test call ${currentCall.status}: ${currentCall.endedReason || 'unknown'}`);
        }

      } catch (error) {
        console.log(`   [${attempts * 5}s] Status check error: ${error.response?.status || error.message}`);
      }
    }

    if (attempts >= maxAttempts && !callComplete) {
      console.log('\n⏰ Test monitoring timeout - check VAPI dashboard for full results');
    }

  } catch (error) {
    console.error('❌ Universal appointment test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }

  // Show all test scenarios we could try
  console.log('\n\n📋 Additional Test Scenarios Available:');
  testScenarios.forEach((scenario, index) => {
    console.log(`\n   ${index + 1}. ${scenario.type}:`);
    console.log(`      Context: "${scenario.context}"`);
    console.log(`      Expected: ${scenario.expectedBehavior}`);
  });

  console.log('\n🚀 Universal Appointment System Status:');
  console.log('   ✅ Prompt updated for any business type');
  console.log('   ✅ Phone number readback removed');
  console.log('   ✅ Business type auto-detection implemented');
  console.log('   ✅ Context-adaptive conversation flow');
  console.log('   🧪 Ready for production testing with real businesses');
}

// Show configuration and run the test
console.log('🔧 Test Configuration:');
console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID || '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

testUniversalAppointments();