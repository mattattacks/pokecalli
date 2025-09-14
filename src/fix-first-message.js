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

async function fixFirstMessage() {
  console.log('🔧 Fixing VAPI Assistant First Message to Use Context Variables\n');

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    // The first message should use the context variables so Calli immediately
    // states what the user wants instead of asking generic questions
    const updateData = {
      firstMessage: "Hi! I'm Calli calling for [USER_NAME]. [REQUEST_CONTEXT]. Could you help me with this?"
    };

    console.log('📝 Updating first message to use context variables...');
    console.log('Old: "Hi there—I\'m calling to schedule an appointment"');
    console.log('New: "Hi! I\'m Calli calling for [USER_NAME]. [REQUEST_CONTEXT]. Could you help me with this?"');

    const response = await vapiAxios.patch(`/assistant/${assistantId}`, updateData);

    console.log('✅ First message updated successfully!');
    console.log(`   Assistant ID: ${response.data.id}`);
    console.log(`   Updated: ${response.data.updatedAt}\n`);

    console.log('🎯 Now when Calli calls, it will say:');
    console.log('   "Hi! I\'m Calli calling for Matthew. Call 6193892600 to schedule a pizza date at 2am tomorrow for 2. Could you help me with this?"');
    console.log('\n✅ This should fix the backwards conversation flow!');

  } catch (error) {
    console.error('❌ Failed to update first message:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

fixFirstMessage();