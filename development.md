# Calli Poke Development Plan

## Project Overview
AI scheduling assistant that integrates Poke automations with VAPI voice AI to make restaurant reservations via phone calls. Designed for HackMIT competition with focus on conversation quality over technical complexity.

## Strategic Approach
**Core Philosophy**: Conversation-quality-first development with lean technical architecture
**Key Insight**: Voice interaction quality will differentiate this project more than perfect system integration
**Resource Allocation**: 40% prompt engineering, 25% integration, 20% testing, 15% demo prep

## Architecture Flow
```
Email Request -> Poke Platform -> MCP Integration -> VAPI Call -> Restaurant -> AI Conversation -> Structured Results -> User Confirmation
```

## Development Phases

### Phase 1: Foundation Setup
**Focus**: API setup and basic infrastructure

#### 1.1 API Setup & Authentication
- [ ] Set up VAPI account and validate API key from secrets.rtf
- [ ] Configure Poke integration credentials
- [ ] Test basic API connectivity with simple requests
- [ ] Set up secure environment variable management
- [ ] Document API endpoints and authentication methods

#### 1.2 VAPI Assistant Creation
- [ ] Create "Calli" voice assistant in VAPI dashboard
- [ ] Configure voice settings (select appropriate voice like "Elliot")
- [ ] Set up basic system prompt framework
- [ ] Test assistant creation and basic response functionality
- [ ] Document assistant ID for integration use

#### 1.3 Phone Infrastructure
- [ ] Obtain VAPI phone number for outbound calls
- [ ] Configure caller ID and number settings
- [ ] Test outbound call capability to personal number
- [ ] Document phone number ID for API calls
- [ ] Verify call quality and audio clarity

### Phase 2: Prompt Engineering Focus
**Focus**: Core conversation quality (PRIMARY SUCCESS FACTOR)

#### 2.1 Conversation Flow Design
- [ ] Map restaurant conversation scenarios and decision trees
- [ ] Design conversation flow for common responses:
  - Available time slot confirmation
  - Alternative time suggestions
  - Waitlist scenarios
  - Special requests (dietary, seating)
  - No availability situations
- [ ] Create variable injection points for user context
- [ ] Plan structured JSON output format for results
- [ ] Document conversation patterns and expected responses

#### 2.2 Prompt Development & Testing
- [ ] Write comprehensive system prompt for restaurant calls
- [ ] Implement variable placeholders ({{userName}}, {{requestContext}})
- [ ] Create conversation testing framework with sample scenarios
- [ ] Test prompts with personal phone numbers initially
- [ ] Iterate on prompt based on actual conversation outcomes
- [ ] Refine conversation handling for edge cases
- [ ] Document successful prompt variations and patterns

### Phase 3: Integration Development
**Focus**: MCP server and call orchestration

#### 3.1 MCP Server Setup
- [ ] Configure connection to VAPI hosted MCP server (https://mcp.vapi.ai/mcp)
- [ ] Set up Poke integration endpoint configuration
- [ ] Implement request parsing for email content and phone numbers
- [ ] Create phone number extraction logic (regex patterns)
- [ ] Test basic request/response flow with sample data
- [ ] Validate MCP protocol compliance

#### 3.2 Call Orchestration
- [ ] Implement create_call function with assistantOverrides
- [ ] Set up variable injection for user context (userName, requestContext)
- [ ] Configure call result monitoring and parsing
- [ ] Test end-to-end call initiation from parsed requests
- [ ] Implement call status tracking and completion detection
- [ ] Create result extraction from conversation transcripts

### Phase 4: Testing & Refinement
**Focus**: Real-world conversation testing and iteration

#### 4.1 Conversation Testing
- [ ] Test calls with different restaurant scenarios
- [ ] Test during various times of day and business conditions
- [ ] Refine prompts based on actual conversation outcomes
- [ ] Test edge cases:
  - Busy signals and call failures
  - Voicemail systems
  - Multiple hold/transfer scenarios
  - Difficult or uncooperative staff
  - Background noise and poor connections
- [ ] Document conversation patterns and success rates
- [ ] Create conversation quality metrics and tracking

#### 4.2 Result Processing
- [ ] Parse and structure assistant output JSON
- [ ] Format user-friendly confirmation messages
- [ ] Test result delivery back to Poke platform
- [ ] Verify complete request/response cycle
- [ ] Handle partial success and failure scenarios
- [ ] Create structured data validation

### Phase 5: Demo Preparation
**Focus**: Error handling, fallbacks, and presentation

#### 5.1 Error Handling & Fallbacks
- [ ] Implement basic error handling for failed calls
- [ ] Create manual override/wizard-of-oz system for demo
- [ ] Test failure scenarios and recovery paths
- [ ] Prepare fallback prompts for difficult conversations
- [ ] Create demo safety net (recorded backup)
- [ ] Document common failure modes and solutions

#### 5.2 Demo Setup & Documentation
- [ ] Prepare demo script and test restaurant scenarios
- [ ] Create presentation materials and flow diagrams
- [ ] Test complete demo run multiple times
- [ ] Document deployment and API configuration
- [ ] Prepare live demo environment
- [ ] Create contingency plans for demo failures

## Priority Matrix

### P0 (Must Have)
- [ ] Basic call flow working end-to-end
- [ ] Voice conversation quality acceptable for restaurant interactions
- [ ] Request parsing from Poke integration
- [ ] Basic result confirmation to user

### P1 (Should Have)
- [ ] Structured result parsing with JSON output
- [ ] User confirmation delivery through Poke
- [ ] Error handling for common call failures
- [ ] Multiple conversation scenarios working

### P2 (Nice to Have)
- [ ] Advanced error handling and recovery
- [ ] Complex conversation edge case handling
- [ ] Production-ready scaling considerations
- [ ] Advanced analytics and monitoring

## Risk Mitigation Strategies

### Conversation Quality Risk (HIGH)
- **Mitigation**: Allocate extra time for prompt iteration
- **Fallback**: Wizard-of-oz manual override for demo
- **Validation**: 70%+ conversation success rate target

### API Integration Risk (MEDIUM)
- **Mitigation**: Start with simple test cases, validate connectivity early
- **Fallback**: Direct API calls if MCP integration fails
- **Validation**: End-to-end flow testing with real data

### Time Constraints Risk (HIGH)
- **Mitigation**: Focus on single success path rather than comprehensive coverage
- **Fallback**: Recorded demo if live demo fails
- **Validation**: Core demo story working reliably

### Demo Failure Risk (MEDIUM)
- **Mitigation**: Prepare recorded demo backup, test multiple scenarios
- **Fallback**: Manual demonstration with conversation examples
- **Validation**: Multiple successful demo run-throughs

## Success Metrics

### Technical Success
- [ ] End-to-end call flow working without errors
- [ ] API integration handling requests reliably
- [ ] Structured result parsing functioning correctly

### Quality Success
- [ ] 70%+ conversation success rate in testing
- [ ] Clear, professional voice interaction quality
- [ ] Accurate information capture and confirmation

### Demo Success
- [ ] Complete user story demo (email -> call -> confirmation) working live
- [ ] Compelling presentation of AI voice capabilities
- [ ] Reliable demo performance under presentation conditions

## Development Environment

### Required Credentials
- Use existing API keys from secrets.rtf:
  - VAPI API key: `8556bec9-72d2-4ef6-8239-92d07780088e`
  - VAPI phone ID: `328097e2-8e76-433e-b900-d9b4ac3ad88b`
  - VAPI assistant ID: `dca10f6b-d35f-4b9f-b2cd-05faa8671269`
  - Poke API key: `pk_VkD60f27TcHRdSwjY4dXUPvHeCssuM76Vzr71yPfkOI`

### Testing Strategy
- Test with personal phone numbers initially
- Use friendly restaurants or test scenarios
- Deploy to simple hosting for Poke integration
- Document all configurations for reproducibility

## Final Deliverables

### Core System
- [ ] Working VAPI assistant with restaurant conversation prompts
- [ ] Functional MCP integration handling Poke requests
- [ ] Demo-ready system with fallback mechanisms
- [ ] Complete end-to-end user flow working

### Documentation
- [ ] Setup and operation documentation
- [ ] API configuration guide
- [ ] Conversation prompt templates
- [ ] Demo presentation materials

---

## Execution Notes
- **Start with**: API validation and basic connectivity testing
- **Focus heavily on**: Prompt engineering and conversation quality
- **Demo preparation**: Multiple test runs and fallback systems
- **Success criteria**: Working live demo of complete user story

*Optimized for hackathon constraints with conversation quality as primary success differentiator.*