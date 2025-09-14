import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

async function testPokeCallback() {
  console.log('🧪 Testing Poke Callback Integration\n');

  const POKE_API_KEY = process.env.POKE_API_KEY;
  console.log(`API Key: ${POKE_API_KEY ? '✅ Present' : '❌ Missing'}`);

  if (!POKE_API_KEY) {
    console.error('❌ POKE_API_KEY not found in environment variables');
    return;
  }

  const testMessage = `🧪 **Calli Poke Test Message**

This is a test message from your Calli Poke system to verify that callback integration is working properly.

📞 **Test Status**: WORKING
🔗 **Integration**: Poke API → Calli → VAPI → Poke Callback
✅ **Result**: You should receive this message in your Poke interface

If you see this message, your system is ready to automatically send call results back to Poke after each appointment booking attempt!

🚀 **Next Steps**: Deploy to Render and start booking appointments`;

  try {
    console.log('📧 Sending test message to Poke...');

    const response = await axios.post('https://poke.com/api/v1/inbound-sms/webhook', {
      message: testMessage
    }, {
      headers: {
        'Authorization': `Bearer ${POKE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Test message sent successfully!');
    console.log('Response:', response.data);
    console.log('\n🎯 Check your Poke interface - you should see the test message!');

  } catch (error) {
    console.error('❌ Failed to send test message to Poke:');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Error: ${error.response?.data?.error || error.message}`);
    console.error(`Details:`, error.response?.data);

    if (error.response?.status === 400) {
      console.error('\n💡 This might be a JSON formatting issue in the curl test.');
      console.error('The Node.js implementation should handle JSON properly.');
    } else if (error.response?.status === 401) {
      console.error('\n💡 API key might be invalid or expired.');
      console.error('Check your Poke API key at https://poke.com/settings/advanced');
    }
  }
}

testPokeCallback();