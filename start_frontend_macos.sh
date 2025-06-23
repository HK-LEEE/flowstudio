#!/bin/bash

# FlowStudio Frontend Startup Script for macOS
echo "Starting FlowStudio Frontend..."

# Change to frontend directory
cd flowstudio-frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Start the development server
echo "Starting Vite development server..."
npm run dev