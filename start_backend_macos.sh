#!/bin/bash

# FlowStudio Backend Startup Script for macOS
echo "Starting FlowStudio Backend..."

# Change to backend directory
cd flowstudio-backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Initialize component templates if needed
echo "Initializing component templates..."
python init_component_templates.py || echo "Component templates initialization skipped (may already exist)"

# Start the server on port 8003 (as specified in roadmap)
echo "Starting FastAPI server on localhost:8003..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003