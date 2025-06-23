#!/bin/bash

# FlowStudio All Services Startup Script for macOS
echo "Starting FlowStudio - All Services..."

# Make scripts executable
chmod +x start_backend_macos.sh
chmod +x start_frontend_macos.sh

# Function to run services in parallel
run_service() {
    echo "Starting $1..."
    if [ "$1" = "backend" ]; then
        ./start_backend_macos.sh
    elif [ "$1" = "frontend" ]; then
        ./start_frontend_macos.sh
    fi
}

# Start services in parallel
echo "Starting backend and frontend services..."
run_service backend &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

run_service frontend &
FRONTEND_PID=$!

echo "FlowStudio services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Access the application at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:8000"
echo "- API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for services and handle cleanup
trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait