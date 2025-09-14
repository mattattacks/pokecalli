import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const VAPI_API_BASE = 'https://api.vapi.ai';
const API_KEY = process.env.VAPI_API_KEY;

async function testVapiConnectivity() {
  console.log('🔍 Testing VAPI API Connectivity...\n');

  // Setup axios with authentication
  const vapiAxios = axios.create({
    baseURL: VAPI_API_BASE,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // Test 1: Basic API connectivity - check assistants
    console.log('1. Testing basic API connectivity...');
    const assistantsResponse = await vapiAxios.get('/assistant?limit=10');
    const assistants = assistantsResponse.data;
    console.log('✅ API connectivity successful');
    console.log(`   Found ${assistants.length} assistants\n`);

    // Test 2: Validate existing assistant
    console.log('2. Checking existing assistant...');
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    try {
      const assistantResponse = await vapiAxios.get(`/assistant/${assistantId}`);
      const assistant = assistantResponse.data;
      console.log('✅ Assistant found:');
      console.log(`   Name: ${assistant.name || 'Unnamed'}`);
      console.log(`   ID: ${assistant.id}`);
      console.log(`   Voice: ${assistant.voice?.provider || 'unknown'} - ${assistant.voice?.voiceId || 'unknown'}`);
      console.log(`   Model: ${assistant.model?.provider || 'unknown'} - ${assistant.model?.model || 'unknown'}\n`);
    } catch (error) {
      console.log('❌ Assistant not found or inaccessible');
      console.log(`   Error: ${error.response?.status} - ${error.response?.data?.message || error.message}\n`);
    }

    // Test 3: Validate phone number
    console.log('3. Checking phone numbers...');
    try {
      const phoneResponse = await vapiAxios.get('/phone-number');
      const phoneNumbers = phoneResponse.data;
      const phoneId = process.env.VAPI_PHONE_ID;
      const phoneNumber = phoneNumbers.find(p => p.id === phoneId);

      if (phoneNumber) {
        console.log('✅ Phone number found:');
        console.log(`   Number: ${phoneNumber.number}`);
        console.log(`   ID: ${phoneNumber.id}`);
        console.log(`   Provider: ${phoneNumber.provider || 'unknown'}\n`);
      } else {
        console.log('⚠️  Specific phone number not found');
        console.log(`   Looking for ID: ${phoneId}`);
        console.log('   Available phone numbers:');
        phoneNumbers.slice(0, 3).forEach(p => {
          console.log(`   - ${p.number} (${p.id})`);
        });
        console.log();
      }
    } catch (error) {
      console.log('❌ Could not fetch phone numbers');
      console.log(`   Error: ${error.response?.status} - ${error.response?.data?.message || error.message}\n`);
    }

    // Test 4: List recent calls (if any)
    console.log('4. Checking recent calls...');
    try {
      const callsResponse = await vapiAxios.get('/call?limit=5');
      const calls = callsResponse.data;
      console.log(`✅ Found ${calls.length} recent calls`);
      if (calls.length > 0) {
        calls.forEach((call, index) => {
          console.log(`   Call ${index + 1}: ${call.status} - ${call.customer?.number || 'unknown'} - ${call.createdAt?.slice(0, 16) || 'unknown time'}`);
        });
      }
      console.log();
    } catch (error) {
      console.log('⚠️  Could not fetch calls (this may be normal for new accounts)');
      console.log(`   Error: ${error.response?.status} - ${error.response?.data?.message || error.message}\n`);
    }

    console.log('🎉 VAPI connectivity test completed successfully!');
    console.log('✨ Ready to proceed with call testing.');
    console.log('\n📋 Environment Status:');
    console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Phone ID: ${process.env.VAPI_PHONE_ID ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID ? '✅ Present' : '❌ Missing'}`);

  } catch (error) {
    console.error('❌ VAPI connectivity test failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('   🔑 Check your API key in .env file');
      } else if (error.response.status === 403) {
        console.error('   🚫 Check your account permissions');
      }
    }

    console.error('\n💡 Make sure your .env file contains the correct VAPI_API_KEY');
    process.exit(1);
  }
}

// Run the test
testVapiConnectivity();