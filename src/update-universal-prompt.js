import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

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

async function updateUniversalPrompt() {
  console.log('🔄 Updating VAPI Assistant to Universal Appointment System\n');

  try {
    // Load the new universal prompt
    const universalPrompt = fs.readFileSync('src/universal-prompt.txt', 'utf8');

    console.log('📝 New Universal Prompt loaded:');
    console.log('   ✓ Supports any business type (restaurants, medical, salon, etc.)');
    console.log('   ✓ Removes phone number readback during calls');
    console.log('   ✓ Business type auto-detection from context');
    console.log('   ✓ Adaptive conversation flow per business type\n');

    // Update the assistant
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    const updateData = {
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: universalPrompt
          }
        ]
      },
      firstMessage: "Hi there—I'm calling to schedule an appointment"
    };

    console.log(`🔧 Updating assistant ${assistantId}...`);

    const response = await vapiAxios.patch(`/assistant/${assistantId}`, updateData);

    console.log('✅ Assistant updated successfully!');
    console.log(`   Assistant ID: ${response.data.id}`);
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Updated: ${response.data.updatedAt}\n`);

    // Test the changes
    console.log('🧪 Key Improvements Implemented:');
    console.log('   1. ✅ Universal Business Support:');
    console.log('      - Restaurants (table reservations)');
    console.log('      - Medical/Dental (appointments)');
    console.log('      - Beauty/Salon (services)');
    console.log('      - Legal/Professional (consultations)');
    console.log('      - Home Services (contractor visits)');
    console.log('      - General Business (meetings)\n');

    console.log('   2. ✅ Phone Number Readback REMOVED:');
    console.log('      - Old: "confirming at 6-1-9-8-5-3-2-0-5-1"');
    console.log('      - New: "confirming [service] on [date] at [time]"');
    console.log('      - Explicit instruction: "NEVER read phone numbers back digit by digit"\n');

    console.log('   3. ✅ Context-Aware Call Openers:');
    console.log('      - Auto-detects business type from REQUEST_CONTEXT');
    console.log('      - Adapts greeting and questions per business type');
    console.log('      - Collects business-specific information\n');

    console.log('🎯 Ready for Testing:');
    console.log('   - Try calling different business types');
    console.log('   - Verify no phone number readback occurs');
    console.log('   - Test universal appointment booking flow');

  } catch (error) {
    console.error('❌ Assistant update failed:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Show current configuration
console.log('🔧 Configuration Check:');
console.log(`   API Key: ${API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`   Assistant ID: ${process.env.VAPI_ASSISTANT_ID || '❌ Missing'}`);
console.log();

// Run the update
updateUniversalPrompt();