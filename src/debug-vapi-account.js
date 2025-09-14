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

async function debugVapiAccount() {
  console.log('🔍 Comprehensive VAPI Account Debug\n');

  try {
    // Check recent calls with detailed information
    console.log('📞 Recent Calls Analysis:');
    const callsResponse = await vapiAxios.get('/call?limit=5');
    const calls = callsResponse.data;

    if (calls.length === 0) {
      console.log('   No recent calls found');
    } else {
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        console.log(`\n   Call ${i + 1}:`);
        console.log(`   ID: ${call.id}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   Customer: ${call.customer?.number || 'unknown'}`);
        console.log(`   Duration: ${call.duration || 'unknown'}s`);
        console.log(`   Created: ${call.createdAt}`);
        console.log(`   Ended: ${call.endedAt || 'N/A'}`);
        console.log(`   End Reason: ${call.endedReason || 'N/A'}`);

        if (call.transcript) {
          console.log(`   Transcript: ${call.transcript.substring(0, 100)}${call.transcript.length > 100 ? '...' : ''}`);
        }

        if (call.cost) {
          console.log(`   Cost: $${call.cost}`);
        }

        // Check if this was the call to Matthew
        if (call.customer?.number === '+18125505590') {
          console.log(`   🎯 THIS WAS THE CALL TO MATTHEW!`);
          console.log(`   Analysis: ${JSON.stringify(call.analysis || {}, null, 4)}`);
        }
      }
    }

    // Check phone numbers in detail
    console.log('\n\n📱 Phone Number Configuration:');
    const phoneResponse = await vapiAxios.get('/phone-number');
    const phones = phoneResponse.data;

    phones.forEach((phone, index) => {
      console.log(`\n   Phone ${index + 1}:`);
      console.log(`   Number: ${phone.number}`);
      console.log(`   ID: ${phone.id}`);
      console.log(`   Provider: ${phone.provider}`);
      console.log(`   Country: ${phone.country || 'unknown'}`);
      console.log(`   Type: ${phone.type || 'unknown'}`);
      console.log(`   Capabilities: ${JSON.stringify(phone.capabilities || {})}`);

      // Check if this is the phone we're using
      if (phone.id === process.env.VAPI_PHONE_ID) {
        console.log(`   🎯 THIS IS OUR CONFIGURED PHONE NUMBER`);
      }
    });

    // Check assistants
    console.log('\n\n🤖 Assistant Configuration:');
    const assistantsResponse = await vapiAxios.get('/assistant');
    const assistants = assistantsResponse.data;

    assistants.forEach((assistant, index) => {
      console.log(`\n   Assistant ${index + 1}:`);
      console.log(`   Name: ${assistant.name}`);
      console.log(`   ID: ${assistant.id}`);

      if (assistant.id === process.env.VAPI_ASSISTANT_ID) {
        console.log(`   🎯 THIS IS OUR CONFIGURED ASSISTANT`);
        console.log(`   Voice: ${assistant.voice?.provider} - ${assistant.voice?.voiceId}`);
        console.log(`   Model: ${assistant.model?.provider} - ${assistant.model?.model}`);
      }
    });

    // Try to get organization/account info if available
    console.log('\n\n🏢 Account Information:');
    try {
      const orgResponse = await vapiAxios.get('/organization');
      console.log(`   Organization: ${JSON.stringify(orgResponse.data, null, 2)}`);
    } catch (error) {
      console.log('   Organization info not available or accessible');
    }

    // Summary
    console.log('\n\n📋 Debug Summary:');
    console.log(`   Total recent calls: ${calls.length}`);
    console.log(`   Total phone numbers: ${phones.length}`);
    console.log(`   Total assistants: ${assistants.length}`);

    const matthewCall = calls.find(c => c.customer?.number === '+18125505590');
    if (matthewCall) {
      console.log(`   Matthew's call found: ${matthewCall.id}`);
      console.log(`   Call status: ${matthewCall.status}`);
      console.log(`   Call end reason: ${matthewCall.endedReason}`);
    } else {
      console.log('   ❌ No call to Matthew found in recent calls');
    }

  } catch (error) {
    console.error('\n❌ Debug failed:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the debug
debugVapiAccount();