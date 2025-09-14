import axios from 'axios';

const SERVER_URL = 'http://localhost:4000';

// Test cases for the MCP server
const testCases = [
  {
    name: 'Basic restaurant reservation',
    data: {
      message: "Call 212-555-0123 to book a table for 4 at Joe's Pizza tonight at 8pm",
      userName: 'Alice Johnson',
      userEmail: 'alice@example.com'
    }
  },
  {
    name: 'Reservation with date',
    data: {
      message: "Please call Turoni's at 812-424-9291 to make a reservation for 2 people on Friday at 7:30 PM",
      userName: 'Bob Smith',
      userEmail: 'bob@example.com'
    }
  },
  {
    name: 'Simple appointment booking',
    data: {
      message: "Call the salon at +1-555-867-5309 to book an appointment for next Tuesday",
      userName: 'Carol Davis',
      userEmail: 'carol@example.com'
    }
  }
];

async function testMCPServer() {
  console.log('🧪 Testing Calli Poke MCP Server\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log('✅ Health check passed');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   VAPI configured: ${healthResponse.data.config.vapiConfigured}`);
    console.log(`   Phone configured: ${healthResponse.data.config.phoneConfigured}`);
    console.log(`   Assistant configured: ${healthResponse.data.config.assistantConfigured}\n`);

    // Test 2: Run test cases
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`${i + 2}. Testing: ${testCase.name}`);
      console.log(`   Input: "${testCase.data.message}"`);

      try {
        const response = await axios.post(`${SERVER_URL}/test`, testCase.data);

        if (response.data.success) {
          console.log('✅ Request processed successfully');
          console.log(`   Response: ${response.data.result.message}`);
          if (response.data.result.callId) {
            console.log(`   Call ID: ${response.data.result.callId}`);
            console.log(`   Status: ${response.data.result.status}`);

            if (response.data.result.details) {
              console.log('   Parsed details:');
              Object.entries(response.data.result.details).forEach(([key, value]) => {
                if (value) console.log(`     ${key}: ${value}`);
              });
            }
          }
        } else {
          console.log('❌ Request failed');
          console.log(`   Error: ${response.data.error}`);
        }

      } catch (error) {
        console.log('❌ Request failed with error');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Error: ${error.response?.data?.error || error.message}`);
      }

      console.log();
    }

    console.log('🎉 MCP server testing completed!');
    console.log('\n💡 To test with real calls, use the npm run test-call script');
    console.log('   Make sure to provide a real phone number you control.');

  } catch (error) {
    console.error('❌ Failed to test MCP server');
    console.error(`   Error: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the server is running:');
      console.error('   npm start');
      console.error('   # Then in another terminal:');
      console.error('   npm run test-mcp');
    }
  }
}

// Run the tests
testMCPServer();