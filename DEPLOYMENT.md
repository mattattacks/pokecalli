# 🚀 Calli Poke Deployment Guide

## Option 1: Render Cloud Hosting (Recommended for Demos)

### Quick Deploy Button
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/calli-poke)

### Manual Render Deployment

1. **Push to GitHub** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial Calli Poke deployment"
   git remote add origin https://github.com/yourusername/calli-poke.git
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [render.com](https://render.com)
   - Connect your GitHub account
   - Create new Web Service
   - Select your `calli-poke` repository
   - Render will auto-detect Node.js and use our `render.yaml`

3. **Set Environment Variables**:
   ```
   VAPI_API_KEY=your_vapi_key_here
   VAPI_PHONE_ID=your_phone_id_here
   VAPI_ASSISTANT_ID=your_assistant_id_here
   POKE_API_KEY=your_poke_key_here
   NODE_ENV=production
   ```

4. **Deploy**: Render will build and deploy automatically
5. **Access**: Your demo will be live at `https://your-app-name.onrender.com`

### ✅ Render Advantages:
- ✅ Free tier available
- ✅ Auto-deploys from GitHub
- ✅ Built-in SSL certificates
- ✅ Easy environment variable management
- ✅ Perfect for demos and sharing

---

## Option 2: Claude Desktop Local Integration

### Prerequisites
- Claude Desktop app installed
- Node.js 18+ installed locally

### Setup Steps

1. **Install Claude Desktop MCP Integration**:
   ```bash
   # Install the MCP SDK
   npm install @modelcontextprotocol/sdk-typescript
   ```

2. **Create Claude Desktop Configuration**:
   ```json
   // Add to ~/.claude_desktop_config.json
   {
     "mcpServers": {
       "calli-poke": {
         "command": "node",
         "args": ["path/to/your/calli-poke/src/mcp-server.js"],
         "env": {
           "VAPI_API_KEY": "your_vapi_key_here",
           "VAPI_PHONE_ID": "your_phone_id_here",
           "VAPI_ASSISTANT_ID": "your_assistant_id_here"
         }
       }
     }
   }
   ```

3. **Create MCP Server Bridge**:
   ```bash
   npm run create-mcp-bridge
   ```

4. **Restart Claude Desktop** - The MCP server will be available

### ✅ Claude Desktop Advantages:
- ✅ Direct integration with Claude Desktop
- ✅ Local processing (more secure)
- ✅ No hosting costs
- ✅ Perfect for personal use

---

## Option 3: Railway Deployment

### One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

### Manual Railway Deployment
1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub
3. Select your repository
4. Set environment variables
5. Deploy!

---

## Option 4: Vercel Deployment

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/calli-poke)

### Manual Vercel Setup
```bash
npm install -g vercel
vercel
# Follow the prompts
vercel --prod
```

---

## 🧪 Testing Your Deployment

### Health Check
Visit: `https://your-deployment-url/health`

Should return:
```json
{
  "status": "healthy",
  "service": "Calli Poke MCP Server",
  "config": {
    "vapiConfigured": true,
    "phoneConfigured": true,
    "assistantConfigured": true
  }
}
```

### Demo Interface
Visit: `https://your-deployment-url/`

You'll see the interactive demo interface where you can:
- Test different appointment types
- Monitor calls in real-time
- See conversation transcripts
- Verify the universal system works

### API Testing
```bash
# Test the MCP endpoint
curl -X POST https://your-deployment-url/test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Call (619) 853-2051 to book a table for 2 at Luigi'\''s tonight at 7:30 PM",
    "userName": "Demo User",
    "userEmail": "demo@example.com"
  }'
```

---

## 🔧 Environment Variables Required

```env
# VAPI Configuration
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_ID=your_vapi_phone_number_id
VAPI_ASSISTANT_ID=your_universal_assistant_id

# Poke Integration (optional)
POKE_API_KEY=your_poke_api_key_here

# Deployment
NODE_ENV=production
PORT=10000
```

---

## 🎯 Demo Script for Presentations

1. **Show the homepage**: Explain universal appointment booking
2. **Demo medical appointment**: "Schedule check-up with Dr. Johnson next Tuesday at 10 AM"
3. **Show real-time monitoring**: Watch call status updates
4. **Highlight key features**:
   - No phone number readback
   - Business-type auto-detection
   - Professional conversation flow
5. **Show API integration**: Demonstrate Poke MCP endpoint

---

## 🚀 Recommended: Render Deployment

**For your demo, I recommend Render because:**
- ✅ Free tier perfect for demos
- ✅ Easy to share URLs
- ✅ Automatic HTTPS
- ✅ Simple environment variable setup
- ✅ No configuration needed

**Next steps:**
1. Push code to GitHub
2. Deploy to Render in 2 minutes
3. Set environment variables
4. Share the live demo URL!

Your deployed demo will be accessible worldwide and perfect for showcasing Calli Poke's universal appointment booking capabilities.