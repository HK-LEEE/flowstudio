#!/bin/bash
# Test script for FlowStudio Flow API

BASE_URL="http://localhost:8003"
API_PREFIX="$BASE_URL/api/flow-api"

echo "🚀 FlowStudio Flow API Test Script"
echo "=================================="

# Check if sample_flow_ids.json exists
if [ ! -f "sample_flow_ids.json" ]; then
    echo "❌ sample_flow_ids.json not found. Please run create_sample_chat_flow.py first."
    exit 1
fi

# Get flow IDs from the JSON file
SIMPLE_FLOW_ID=$(cat sample_flow_ids.json | grep -o '"simple_chat_flow_id": "[^"]*"' | cut -d'"' -f4)
ADVANCED_FLOW_ID=$(cat sample_flow_ids.json | grep -o '"advanced_chat_flow_id": "[^"]*"' | cut -d'"' -f4)

echo "Simple Chat Flow ID: $SIMPLE_FLOW_ID"
echo "Advanced Chat Flow ID: $ADVANCED_FLOW_ID"
echo ""

# Function to make authenticated requests (mock - adjust for your auth system)
auth_header="Authorization: Bearer mock_token"

echo "📋 1. Test Direct Flow Execution"
echo "--------------------------------"
curl -X POST "$API_PREFIX/test-execute" \
  -H "Content-Type: application/json" \
  -H "$auth_header" \
  -d '{
    "flow_data": {
      "nodes": [
        {
          "id": "input1",
          "data": {
            "template": {
              "component_type": "chat_input"
            }
          }
        },
        {
          "id": "llm1",
          "data": {
            "template": {
              "component_type": "claude_llm"
            }
          }
        },
        {
          "id": "output1",
          "data": {
            "template": {
              "component_type": "chat_output"
            }
          }
        }
      ],
      "edges": [
        {
          "source": "input1",
          "target": "llm1",
          "sourceHandle": "message",
          "targetHandle": "prompt"
        },
        {
          "source": "llm1",
          "target": "output1",
          "sourceHandle": "response",
          "targetHandle": "response"
        }
      ]
    },
    "input_data": {
      "message": "Hello, what is artificial intelligence?"
    }
  }' | jq .

echo -e "\n\n"

echo "📝 2. Publish Simple Chat Flow"
echo "------------------------------"
curl -X POST "$API_PREFIX/publish/$SIMPLE_FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "$auth_header" \
  -d '{
    "version": "1.0.0",
    "is_public": true,
    "rate_limit": 100,
    "max_instances": 2,
    "description": "Simple chat flow API for testing"
  }' | jq .

echo -e "\n\n"

echo "📝 3. Publish Advanced Chat Flow"
echo "-------------------------------"
curl -X POST "$API_PREFIX/publish/$ADVANCED_FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "$auth_header" \
  -d '{
    "version": "1.0.0",
    "is_public": true,
    "rate_limit": 200,
    "max_instances": 3,
    "description": "Advanced chat flow with memory API"
  }' | jq .

echo -e "\n\n"

echo "📊 4. List Published Flows"
echo "--------------------------"
curl -X GET "$API_PREFIX/published" \
  -H "$auth_header" | jq .

echo -e "\n\n"

echo "⚡ 5. Execute Published Simple Chat Flow"
echo "---------------------------------------"
curl -X POST "$API_PREFIX/flows/$SIMPLE_FLOW_ID/v1.0.0/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! Can you explain what machine learning is?",
    "session_id": "test_session_123"
  }' | jq .

echo -e "\n\n"

echo "⚡ 6. Execute Published Advanced Chat Flow"
echo "-----------------------------------------"
curl -X POST "$API_PREFIX/flows/$ADVANCED_FLOW_ID/v1.0.0/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the benefits of renewable energy?",
    "session_id": "test_session_456"
  }' | jq .

echo -e "\n\n"

echo "📈 7. Check Flow Process Status"
echo "------------------------------"
curl -X GET "$API_PREFIX/status/$SIMPLE_FLOW_ID?version=1.0.0" \
  -H "$auth_header" | jq .

echo -e "\n\n"

echo "🔍 8. List Running Processes"
echo "----------------------------"
curl -X GET "$API_PREFIX/processes" \
  -H "$auth_header" | jq .

echo -e "\n\n"

echo "🧹 9. Test Cleanup (Optional)"
echo "-----------------------------"
echo "Uncomment the line below to test process cleanup:"
echo "# curl -X POST \"$API_PREFIX/cleanup?force=true\" -H \"$auth_header\" | jq ."

echo -e "\n\n"

echo "📚 10. Get Flow API Information"
echo "------------------------------"
curl -X GET "$API_PREFIX/flows/$SIMPLE_FLOW_ID/v1.0.0/info" | jq .

echo -e "\n\n"

echo "✅ Testing completed!"
echo "===================="
echo ""
echo "📌 Next steps:"
echo "1. Check the backend logs for execution details"
echo "2. Verify that flow processes are running with: curl $API_PREFIX/processes"
echo "3. Test the published APIs directly: curl $API_PREFIX/flows/{flow_id}/v1.0.0/execute"
echo "4. Use the FlowStudio frontend to interact with these flows"
echo ""
echo "💡 API Endpoints:"
echo "- Simple Chat Flow: $API_PREFIX/flows/$SIMPLE_FLOW_ID/v1.0.0/execute"
echo "- Advanced Chat Flow: $API_PREFIX/flows/$ADVANCED_FLOW_ID/v1.0.0/execute"