"""
Flow API Gateway
Manages published flows as API endpoints with dynamic process pool management
"""
import asyncio
import subprocess
import json
import uuid
import time
import logging
import signal
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from pathlib import Path
import psutil
import aiohttp
from fastapi import HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.flow import Flow

logger = logging.getLogger(__name__)

@dataclass
class FlowProcess:
    """Represents a running flow process"""
    flow_id: str
    flow_version: str
    process_id: int
    port: int
    process: subprocess.Popen
    start_time: datetime
    last_request_time: datetime
    request_count: int = 0
    status: str = "starting"  # starting, ready, error, stopping

@dataclass
class FlowAPIConfig:
    """Configuration for a published flow API"""
    flow_id: str
    flow_version: str
    flow_name: str
    flow_data: Dict[str, Any]
    api_endpoint: str
    is_public: bool
    rate_limit: Optional[int] = None
    max_instances: int = 3
    idle_timeout_minutes: int = 5

class FlowProcessManager:
    """
    Manages the lifecycle of flow processes
    Handles spawning, monitoring, and cleanup of flow execution processes
    """
    
    def __init__(self, base_port: int = 8100, max_processes: int = 50):
        self.base_port = base_port
        self.max_processes = max_processes
        self.processes: Dict[str, FlowProcess] = {}  # process_key -> process
        self.port_pool: Set[int] = set(range(base_port, base_port + max_processes))
        self.used_ports: Set[int] = set()
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def start_manager(self):
        """Start the process manager"""
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Flow Process Manager started")
        
    async def stop_manager(self):
        """Stop the process manager"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            
        # Stop all processes
        for process in list(self.processes.values()):
            await self._stop_process(process)
            
        logger.info("Flow Process Manager stopped")
        
    def get_process_key(self, flow_id: str, flow_version: str) -> str:
        """Generate unique process key"""
        return f"{flow_id}:{flow_version}"
        
    async def get_or_create_process(self, config: FlowAPIConfig) -> FlowProcess:
        """Get existing process or create new one for the flow"""
        process_key = self.get_process_key(config.flow_id, config.flow_version)
        
        # Check if process exists and is healthy
        existing_process = self.processes.get(process_key)
        if existing_process and await self._is_process_healthy(existing_process):
            existing_process.last_request_time = datetime.now()
            existing_process.request_count += 1
            return existing_process
            
        # Clean up unhealthy process if exists
        if existing_process:
            await self._stop_process(existing_process)
            
        # Check process limits
        if len(self.processes) >= self.max_processes:
            await self._cleanup_idle_processes()
            
        if len(self.processes) >= self.max_processes:
            raise HTTPException(
                status_code=503, 
                detail="Maximum number of flow processes reached"
            )
            
        # Create new process
        return await self._create_process(config)
        
    async def _create_process(self, config: FlowAPIConfig) -> FlowProcess:
        """Create a new flow process"""
        if not self.port_pool:
            raise HTTPException(
                status_code=503,
                detail="No available ports for new process"
            )
            
        port = self.port_pool.pop()
        self.used_ports.add(port)
        
        try:
            # Create flow execution script
            script_path = await self._create_execution_script(config, port)
            
            # Start process with correct python path
            python_path = sys.executable  # Use same python as current process
            process = subprocess.Popen(
                [python_path, str(script_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=Path(__file__).parent.parent.parent,
                env={**os.environ, "FLOW_PORT": str(port)}
            )
            
            flow_process = FlowProcess(
                flow_id=config.flow_id,
                flow_version=config.flow_version,
                process_id=process.pid,
                port=port,
                process=process,
                start_time=datetime.now(),
                last_request_time=datetime.now()
            )
            
            process_key = self.get_process_key(config.flow_id, config.flow_version)
            self.processes[process_key] = flow_process
            
            # Wait for process to be ready
            await self._wait_for_process_ready(flow_process)
            
            logger.info(f"Created flow process for {config.flow_name} on port {port}")
            return flow_process
            
        except Exception as e:
            # Clean up on failure
            self.port_pool.add(port)
            self.used_ports.discard(port)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create flow process: {str(e)}"
            )
            
    async def _create_execution_script(self, config: FlowAPIConfig, port: int) -> Path:
        """Create a Python script to run the flow as a web service"""
        script_dir = Path(__file__).parent.parent.parent / "temp" / "flow_scripts"
        script_dir.mkdir(parents=True, exist_ok=True)
        
        script_path = script_dir / f"flow_{config.flow_id}_{config.flow_version}_{port}.py"
        
        script_content = f'''
import asyncio
import json
import logging
import sys
import os
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn

from app.services.flow_execution_engine import execute_flow_simple

# Flow configuration
FLOW_ID = "{config.flow_id}"
FLOW_VERSION = "{config.flow_version}"
FLOW_NAME = "{config.flow_name}"
PORT = {port}
FLOW_DATA = {json.dumps(config.flow_data, indent=2)}

# Initialize FastAPI app
app = FastAPI(title=f"{{FLOW_NAME}} API", version=FLOW_VERSION)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {{"status": "healthy", "flow_id": FLOW_ID, "version": FLOW_VERSION, "timestamp": datetime.now().isoformat()}}

@app.post("/execute")
async def execute_flow(request: Request):
    """Execute the flow with provided input"""
    try:
        # Get input data
        input_data = await request.json()
        
        logger.info(f"Executing flow {{FLOW_ID}} with input: {{input_data}}")
        
        # Execute flow using simplified function
        execution = await execute_flow_simple(FLOW_DATA, input_data)
        
        # Extract final output from simplified execution result
        final_output = execution.get("output_data", {{}})
        
        return {{
            "success": True,
            "execution_id": execution.get("execution_id"),
            "flow_id": FLOW_ID,
            "version": FLOW_VERSION,
            "status": execution.get("status"),
            "execution_time_ms": execution.get("execution_time_ms"),
            "output": final_output,
            "timestamp": datetime.now().isoformat()
        }}
        
    except Exception as e:
        logger.error(f"Flow execution failed: {{e}}")
        return JSONResponse(
            status_code=500,
            content={{
                "success": False,
                "error": str(e),
                "flow_id": FLOW_ID,
                "version": FLOW_VERSION,
                "timestamp": datetime.now().isoformat()
            }}
        )

@app.get("/info")
async def flow_info():
    """Get flow information"""
    return {{
        "flow_id": FLOW_ID,
        "version": FLOW_VERSION,
        "name": FLOW_NAME,
        "status": "active",
        "components": len(FLOW_DATA.get('nodes', [])),
        "connections": len(FLOW_DATA.get('edges', [])),
        "created_at": datetime.now().isoformat()
    }}

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=False
    )
'''
        
        with open(script_path, 'w') as f:
            f.write(script_content)
            
        return script_path
        
    async def _wait_for_process_ready(self, flow_process: FlowProcess, timeout: int = 30):
        """Wait for the process to be ready to accept requests"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"http://localhost:{flow_process.port}/health") as response:
                        if response.status == 200:
                            flow_process.status = "ready"
                            return
            except:
                pass
                
            await asyncio.sleep(1)
            
        flow_process.status = "error"
        
        # Get process error output for debugging
        error_details = "Unknown error"
        if flow_process.process:
            try:
                stdout, stderr = flow_process.process.communicate(timeout=1)
                if stderr:
                    error_details = stderr.decode('utf-8')
                elif stdout:
                    error_details = stdout.decode('utf-8')
            except:
                error_details = "Process communication failed"
        
        logger.error(f"Process startup failed. Error details: {error_details}")
        raise Exception(f"Process failed to start within {timeout} seconds. Error: {error_details}")
        
    async def _is_process_healthy(self, flow_process: FlowProcess) -> bool:
        """Check if a process is healthy"""
        try:
            # Check if process is still running
            if flow_process.process.poll() is not None:
                return False
                
            # Check if process responds to health check
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://localhost:{flow_process.port}/health",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return response.status == 200
                    
        except Exception:
            return False
            
    async def _stop_process(self, flow_process: FlowProcess):
        """Stop a flow process"""
        try:
            # Try graceful shutdown first
            flow_process.process.terminate()
            
            # Wait a bit for graceful shutdown
            try:
                flow_process.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Force kill if graceful shutdown fails
                flow_process.process.kill()
                flow_process.process.wait()
                
            # Clean up resources
            self.used_ports.discard(flow_process.port)
            self.port_pool.add(flow_process.port)
            
            process_key = self.get_process_key(flow_process.flow_id, flow_process.flow_version)
            self.processes.pop(process_key, None)
            
            logger.info(f"Stopped flow process {flow_process.process_id} on port {flow_process.port}")
            
        except Exception as e:
            logger.error(f"Error stopping process {flow_process.process_id}: {e}")
            
    async def _cleanup_idle_processes(self, force: bool = False):
        """Clean up idle or old processes"""
        now = datetime.now()
        to_remove = []
        
        for process_key, flow_process in self.processes.items():
            # Check if process is idle
            idle_time = now - flow_process.last_request_time
            
            if force or idle_time > timedelta(minutes=5):  # 5 minute timeout
                to_remove.append(flow_process)
                
        for flow_process in to_remove:
            await self._stop_process(flow_process)
            
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} idle flow processes")
            
    async def _cleanup_loop(self):
        """Background task to clean up idle processes"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._cleanup_idle_processes()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

class FlowAPIGateway:
    """
    Main API Gateway for published flows
    Routes requests to appropriate flow processes
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.process_manager = FlowProcessManager()
        self.published_flows: Dict[str, FlowAPIConfig] = {}  # endpoint -> config
        self._initialized = False
        
    async def start_gateway(self):
        """Start the API gateway"""
        if self._initialized:
            return
            
        await self.process_manager.start_manager()
        await self._load_published_flows()
        self._initialized = True
        logger.info("Flow API Gateway started")
        
    async def stop_gateway(self):
        """Stop the API gateway"""
        await self.process_manager.stop_manager()
        self._initialized = False
        logger.info("Flow API Gateway stopped")
        
    async def _load_published_flows(self):
        """Load published flows from database"""
        result = await self.db.execute(
            select(Flow).where(Flow.is_published == True, Flow.is_active == True)
        )
        flows = result.scalars().all()
        
        for flow in flows:
            endpoint = f"/api/flows/{flow.id}/v{flow.version}/execute"
            config = FlowAPIConfig(
                flow_id=str(flow.id),
                flow_version=flow.version,
                flow_name=flow.name,
                flow_data=flow.flow_data or {},
                api_endpoint=endpoint,
                is_public=flow.is_public
            )
            self.published_flows[endpoint] = config
            
        logger.info(f"Loaded {len(self.published_flows)} published flows")
        
    async def execute_flow_api(self, flow_id: str, version: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a published flow via API"""
        endpoint = f"/api/flows/{flow_id}/v{version}/execute"
        
        if endpoint not in self.published_flows:
            raise HTTPException(status_code=404, detail="Flow API not found")
            
        config = self.published_flows[endpoint]
        
        # Get or create process
        flow_process = await self.process_manager.get_or_create_process(config)
        
        try:
            # Make request to flow process
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"http://localhost:{flow_process.port}/execute",
                    json=input_data,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    result = await response.json()
                    
                    if response.status != 200:
                        raise HTTPException(
                            status_code=response.status,
                            detail=result.get('error', 'Flow execution failed')
                        )
                        
                    return result
                    
        except aiohttp.ClientError as e:
            logger.error(f"Failed to communicate with flow process: {e}")
            raise HTTPException(
                status_code=503,
                detail="Flow service temporarily unavailable"
            )
            
    async def publish_flow(self, flow_id: str, version: str, config_data: Dict[str, Any]) -> str:
        """Publish a flow as an API endpoint"""
        # Get flow from database
        result = await self.db.execute(
            select(Flow).where(Flow.id == flow_id)
        )
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
            
        endpoint = f"/api/flows/{flow_id}/v{version}/execute"
        
        config = FlowAPIConfig(
            flow_id=flow_id,
            flow_version=version,
            flow_name=flow.name,
            flow_data=flow.flow_data or {},
            api_endpoint=endpoint,
            is_public=config_data.get('is_public', False),
            rate_limit=config_data.get('rate_limit'),
            max_instances=config_data.get('max_instances', 3)
        )
        
        self.published_flows[endpoint] = config
        
        # Update flow in database
        flow.is_published = True
        flow.is_public = config.is_public
        flow.version = version
        await self.db.commit()
        
        logger.info(f"Published flow {flow.name} as API: {endpoint}")
        return endpoint
        
    async def unpublish_flow(self, flow_id: str, version: str):
        """Unpublish a flow API"""
        endpoint = f"/api/flows/{flow_id}/v{version}/execute"
        
        if endpoint in self.published_flows:
            config = self.published_flows[endpoint]
            
            # Stop any running processes
            process_key = self.process_manager.get_process_key(flow_id, version)
            if process_key in self.process_manager.processes:
                flow_process = self.process_manager.processes[process_key]
                await self.process_manager._stop_process(flow_process)
                
            del self.published_flows[endpoint]
            
            # Update database
            result = await self.db.execute(
                select(Flow).where(Flow.id == flow_id)
            )
            flow = result.scalar_one_or_none()
            if flow:
                flow.is_published = False
                await self.db.commit()
                
            logger.info(f"Unpublished flow API: {endpoint}")
            
    def list_published_flows(self) -> List[Dict[str, Any]]:
        """List all published flows"""
        return [
            {
                "flow_id": config.flow_id,
                "version": config.flow_version,
                "name": config.flow_name,
                "endpoint": config.api_endpoint,
                "is_public": config.is_public,
                "rate_limit": config.rate_limit
            }
            for config in self.published_flows.values()
        ]
        
    def get_flow_status(self, flow_id: str, version: str) -> Dict[str, Any]:
        """Get status of a published flow"""
        process_key = self.process_manager.get_process_key(flow_id, version)
        flow_process = self.process_manager.processes.get(process_key)
        
        if flow_process:
            return {
                "flow_id": flow_id,
                "version": version,
                "status": flow_process.status,
                "port": flow_process.port,
                "process_id": flow_process.process_id,
                "start_time": flow_process.start_time.isoformat(),
                "last_request_time": flow_process.last_request_time.isoformat(),
                "request_count": flow_process.request_count
            }
        else:
            return {
                "flow_id": flow_id,
                "version": version,
                "status": "not_running"
            }

# Global gateway instance
flow_api_gateway: Optional[FlowAPIGateway] = None

async def get_flow_api_gateway(db: AsyncSession) -> FlowAPIGateway:
    """Get or create the global API gateway instance"""
    global flow_api_gateway
    
    if flow_api_gateway is None:
        flow_api_gateway = FlowAPIGateway(db)
        await flow_api_gateway.start_gateway()
        
    return flow_api_gateway