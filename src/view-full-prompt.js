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

async function viewFullPrompt() {
  console.log('📝 Full Assistant System Prompt\n');

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const response = await vapiAxios.get(`/assistant/${assistantId}`);
    const assistant = response.data;

    console.log('='.repeat(80));
    console.log('SYSTEM PROMPT FOR ASSISTANT: ' + (assistant.name || 'Unnamed'));
    console.log('='.repeat(80));
    console.log();

    if (assistant.model && assistant.model.messages) {
      assistant.model.messages.forEach((message, index) => {
        console.log(`[${message.role.toUpperCase()}] Message ${index + 1}:`);
        console.log('-'.repeat(40));
        console.log(message.content);
        console.log();
        console.log('-'.repeat(80));
        console.log();
      });
    } else {
      console.log('No system messages found.');
    }

    console.log('FIRST MESSAGE:');
    console.log('-'.repeat(40));
    console.log(assistant.firstMessage || 'No first message configured');
    console.log();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Failed to retrieve full prompt:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the examination
viewFullPrompt();