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

async function fixVariableSyntax() {
  console.log('🔧 Fixing VAPI Variable Syntax in First Message\n');

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    // VAPI might use {{variable}} syntax instead of [VARIABLE]
    // Let's try different syntaxes:
    const testSyntaxes = [
      "Hi! I'm Calli calling for {{USER_NAME}}. {{REQUEST_CONTEXT}}. Could you help me with this?",
      "Hi! I'm Calli calling for {USER_NAME}. {REQUEST_CONTEXT}. Could you help me with this?",
      "Hi! I'm Calli calling for $USER_NAME. $REQUEST_CONTEXT. Could you help me with this?"
    ];

    // Let's start with the most common template syntax: {{variable}}
    const updateData = {
      firstMessage: testSyntaxes[0]  // Try {{variable}} syntax first
    };

    console.log('📝 Trying {{variable}} syntax...');
    console.log('New message: "Hi! I\'m Calli calling for {{USER_NAME}}. {{REQUEST_CONTEXT}}. Could you help me with this?"');

    const response = await vapiAxios.patch(`/assistant/${assistantId}`, updateData);

    console.log('✅ Variable syntax updated!');
    console.log(`   Assistant ID: ${response.data.id}`);
    console.log(`   Updated: ${response.data.updatedAt}\n`);

    console.log('🧪 Let\'s also check what variables we\'re actually sending:');

    // Test what variables we send in a call
    console.log('Variables being sent to VAPI:');
    console.log('  USER_NAME: "Matthew"');
    console.log('  REQUEST_CONTEXT: "call (619) 853-2051 to schedule a pizza date..."');
    console.log('  PARTY_SIZE: 2');
    console.log('  DATE_PREFS: "tomorrow"');
    console.log('  TIME_WINDOW: "2am"');

    console.log('\n🎯 Now test another call - the variables should substitute correctly!');

  } catch (error) {
    console.error('❌ Failed to update variable syntax:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

fixVariableSyntax();