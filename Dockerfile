FROM python:3.13-slim

WORKDIR /app

# Copy requirements file
COPY requirements.txt ./

# Install dependencies
RUN pip install -r requirements.txt

# Copy source code
COPY . .

# Expose port used by the app (Render sets PORT env var automatically)
EXPOSE 10000

# Run the FastMCP server
CMD ["python", "src/server.py"]
