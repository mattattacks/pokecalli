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

// Different formats to test for 812-550-5590
const phoneFormats = [
  '+18125505590',           // Standard E.164
  '+1-812-550-5590',        // E.164 with dashes
  '+1 812 550 5590',        // E.164 with spaces
  '+1 (812) 550-5590',      // E.164 with parentheses
  '18125505590',            // Without +
  '8125505590',             // Without country code
  '+1.812.550.5590'         // E.164 with dots
];

async function testPhoneFormats() {
  console.log('📞 Testing Different Phone Number Formats for 812-550-5590\n');

  // First, let's check VAPI account info
  console.log('🔍 Checking VAPI Account Status...');
  try {
    const accountResponse = await vapiAxios.get('/assistant');
    console.log(`✅ Account accessible - Found ${accountResponse.data.length} assistants`);

    // Check phone numbers
    const phoneResponse = await vapiAxios.get('/phone-number');
    console.log(`✅ Phone numbers accessible - Found ${phoneResponse.data.length} numbers`);

    phoneResponse.data.forEach((phone, index) => {
      console.log(`   Phone ${index + 1}: ${phone.number} (${phone.id}) - Provider: ${phone.provider}`);
    });
    console.log();

  } catch (error) {
    console.log('❌ Account check failed:', error.response?.data || error.message);
    return;
  }

  // Test each phone format with a simple validation call
  console.log('🧪 Testing Phone Number Formats (validation only)...\n');

  for (let i = 0; i < phoneFormats.length; i++) {
    const format = phoneFormats[i];
    console.log(`${i + 1}. Testing format: "${format}"`);

    try {
      // Create a minimal call request to test validation (we'll cancel it immediately)
      const testCall = {
        phoneNumberId: process.env.VAPI_PHONE_ID,
        assistantId: process.env.VAPI_ASSISTANT_ID,
        customer: {
          number: format
        },
        // Add a very short message to minimize cost/impact
        assistantOverrides: {
          firstMessage: 'Test call - please hang up',
          variableValues: {
            USER_NAME: 'Test'
          }
        }
      };

      const response = await vapiAxios.post('/call', testCall);
      console.log(`   ✅ Format accepted - Call ID: ${response.data.id}`);

      // Immediately try to end/cancel the call if possible
      setTimeout(async () => {
        try {
          await vapiAxios.patch(`/call/${response.data.id}`, { status: 'ended' });
          console.log(`   🛑 Call ${response.data.id} cancelled`);
        } catch (e) {
          // Ignore cancellation errors
        }
      }, 1000);

    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`   ❌ Format rejected: ${error.response.data.message || 'Invalid format'}`);
      } else {
        console.log(`   ⚠️  Unexpected error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }

    // Wait a bit between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📋 Phone Format Testing Summary:');
  console.log('   - Standard E.164 format is usually: +[country code][area code][number]');
  console.log('   - For US numbers: +1 followed by 10 digits');
  console.log('   - Your number 812-550-5590 should be +18125505590');
  console.log('\n💡 Next step: Check if any format was accepted and actually made a call');
}

// Run the test
testPhoneFormats();