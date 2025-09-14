import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

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

async function fixCallEnding() {
  console.log('🔧 Fixing Call Ending Flow - Remove "I\'ll proceed with booking"\n');

  try {
    // Read the current universal prompt
    const currentPrompt = fs.readFileSync('src/universal-prompt.txt', 'utf8');

    // Create updated prompt with clear call ending instructions
    const updatedPrompt = currentPrompt.replace(
      /Scheduling Flow\n(.*?)5\.\s+Lock in the agreed slot; capture confirmation code\/number and any policy notes\.\n\s+6\.\s+Read back all details for verbal confirmation \(exclude phone numbers from readback\)\./s,
      `Scheduling Flow
	1.	State the ask from [REQUEST_CONTEXT] using appropriate business language.
	2.	Check availability for target slot(s). If unavailable, offer 2–3 closest alternatives (earlier/later and nearest dates).
	3.	If no availability: ask about waitlist, cancellation alerts, or emergency slots.
	4.	If deposit/payment needed: do not collect card details. Request a payment link to [USER_EMAIL] or arrange payment at appointment.
	5.	Lock in the agreed slot; capture confirmation code/number and any policy notes.
	6.	Read back all details for verbal confirmation (exclude phone numbers from readback).
	7.	IMMEDIATELY END CALL after confirmation - say "Perfect, thank you! Have a great day!" and hang up.

CRITICAL: After getting booking confirmation, DO NOT say "I'll proceed with the booking" or similar. The restaurant confirmation IS the booking. Simply thank them and end the call.`
    );

    const assistantId = process.env.VAPI_ASSISTANT_ID;

    const updateData = {
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: updatedPrompt
          }
        ]
      }
    };

    console.log('📝 Updating system prompt with clear call ending instructions...');
    console.log('Key changes:');
    console.log('  ✅ Added step 7: IMMEDIATELY END CALL after confirmation');
    console.log('  ✅ Added CRITICAL note: DO NOT say "I\'ll proceed with the booking"');
    console.log('  ✅ Clear instruction: Restaurant confirmation IS the booking');

    const response = await vapiAxios.patch(`/assistant/${assistantId}`, updateData);

    console.log('\n✅ System prompt updated successfully!');
    console.log(`   Assistant ID: ${response.data.id}`);
    console.log(`   Updated: ${response.data.updatedAt}\n`);

    console.log('🎯 Now Calli will:');
    console.log('  1. Make reservation request');
    console.log('  2. Get confirmation from restaurant');
    console.log('  3. Say "Perfect, thank you! Have a great day!"');
    console.log('  4. End call immediately');
    console.log('  5. Send results to user via Poke callback');
    console.log('\n✅ No more confusing "I\'ll proceed with booking" messages!');

  } catch (error) {
    console.error('❌ Failed to update call ending flow:');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

fixCallEnding();