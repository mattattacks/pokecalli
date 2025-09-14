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

async function examineAssistant() {
  console.log('🔍 Examining Existing VAPI Assistant Configuration\n');

  try {
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const response = await vapiAxios.get(`/assistant/${assistantId}`);
    const assistant = response.data;

    console.log('📋 Assistant Overview:');
    console.log(`   Name: ${assistant.name || 'Unnamed'}`);
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Created: ${assistant.createdAt}\n`);

    console.log('🎤 Voice Configuration:');
    if (assistant.voice) {
      console.log(`   Provider: ${assistant.voice.provider}`);
      console.log(`   Voice ID: ${assistant.voice.voiceId}`);
      console.log(`   Speed: ${assistant.voice.speed || 'default'}`);
      console.log(`   Pitch: ${assistant.voice.pitch || 'default'}`);
      console.log(`   Volume: ${assistant.voice.volume || 'default'}\n`);
    } else {
      console.log('   No voice configuration found\n');
    }

    console.log('🤖 Model Configuration:');
    if (assistant.model) {
      console.log(`   Provider: ${assistant.model.provider}`);
      console.log(`   Model: ${assistant.model.model}`);
      console.log(`   Temperature: ${assistant.model.temperature || 'default'}`);
      console.log(`   Max Tokens: ${assistant.model.maxTokens || 'default'}`);
      console.log(`   Emotion Recognition: ${assistant.model.emotionRecognitionEnabled || false}\n`);
    } else {
      console.log('   No model configuration found\n');
    }

    console.log('💬 System Messages:');
    if (assistant.model && assistant.model.messages) {
      assistant.model.messages.forEach((message, index) => {
        console.log(`   Message ${index + 1} (${message.role}):`);
        console.log(`   ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}\n`);
      });
    } else {
      console.log('   No system messages found\n');
    }

    console.log('📞 First Message:');
    console.log(`   ${assistant.firstMessage || 'No first message configured'}\n`);

    console.log('🔧 Advanced Settings:');
    console.log(`   Background Sound: ${assistant.backgroundSound || 'none'}`);
    console.log(`   Background Denoising: ${assistant.backgroundDenoisingEnabled || false}`);
    console.log(`   Model Output: ${assistant.modelOutputInMessagesEnabled || false}`);
    console.log(`   Transport Configuration: ${assistant.transportConfigurations ? 'Present' : 'None'}\n`);

    console.log('📊 Tools and Functions:');
    if (assistant.model && assistant.model.tools && assistant.model.tools.length > 0) {
      assistant.model.tools.forEach((tool, index) => {
        console.log(`   Tool ${index + 1}: ${tool.type || 'Unknown type'}`);
        if (tool.function && tool.function.name) {
          console.log(`     Name: ${tool.function.name}`);
          console.log(`     Description: ${tool.function.description || 'No description'}`);
        }
      });
    } else {
      console.log('   No tools configured');
    }

    console.log('\n✅ Assistant examination complete!');
    console.log('\n💡 Analysis:');
    console.log(`   - Voice: ${assistant.voice ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   - Model: ${assistant.model ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   - System Prompt: ${assistant.model && assistant.model.messages && assistant.model.messages.length > 0 ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - First Message: ${assistant.firstMessage ? '✅ Present' : '⚠️  Using default'}`);

  } catch (error) {
    console.error('❌ Failed to examine assistant:');
    console.error(`   Error: ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the examination
examineAssistant();