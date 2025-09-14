import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const VAPI_API_BASE = 'https://api.vapi.ai';
const API_KEY = process.env.VAPI_API_KEY;

const vapiAxios = axios.create({
  baseURL: VAPI_API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function fixPhoneReadback() {
  console.log('🔧 Fixing Phone Number Readback in First Message\n');

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    // Use specific parsed variables instead of REQUEST_CONTEXT to avoid phone number readback
    const updateData = {
      firstMessage: "Hi! I'm Calli calling for {{USER_NAME}}. I'd like to schedule {{VENUE_NAME}} for {{PARTY_SIZE}} people on {{DATE_PREFS}} around {{TIME_WINDOW}}. Do you have availability?"
    };

    console.log('📝 Updating first message to avoid phone readback...');
    console.log('Old: "Hi! I\'m Calli calling for {{USER_NAME}}. {{REQUEST_CONTEXT}}. Could you help me with this?"');
    console.log('New: "Hi! I\'m Calli calling for {{USER_NAME}}. I\'d like to schedule {{VENUE_NAME}} for {{PARTY_SIZE}} people on {{DATE_PREFS}} around {{TIME_WINDOW}}. Do you have availability?"');

    const response = await vapiAxios.patch(`/assistant/${assistantId}`, updateData);

    console.log('✅ First message updated successfully!');
    console.log(`   Assistant ID: ${response.data.id}`);
    console.log(`   Updated: ${response.data.updatedAt}\n`);

    console.log('🎯 Now when Calli calls, it will say:');
    console.log('   "Hi! I\'m Calli calling for Matthew. I\'d like to schedule mateos for 2 people on tomorrow around 2am. Do you have availability?"');
    console.log('\n✅ No more phone number readback!');
    console.log('✅ Professional restaurant-style opener');

  } catch (error) {
    console.error('❌ Failed to update first message:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

fixPhoneReadback();