FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port used by the app (Render sets PORT env var automatically)
EXPOSE 10000

# Run the universal MCP server explicitly (JSON-RPC + REST)
CMD ["node", "src/mcp-server-universal.js"]
