"""
FlowStudio Component Executors
Individual executors for different component types
"""
import asyncio
import json
import logging
import time
import os
import aiofiles
import csv
import io
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ExecutionContext:
    """Context passed to component executors"""
    component_id: str
    component_type: str
    config_data: Dict[str, Any]
    input_data: Dict[str, Any]
    execution_id: str
    db: AsyncSession


@dataclass
class ExecutionResult:
    """Result from component execution"""
    success: bool
    output_data: Dict[str, Any]
    execution_time_ms: int
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    cost_estimate: Optional[Dict[str, Any]] = None


class BaseComponentExecutor(ABC):
    """Base class for all component executors"""
    
    @abstractmethod
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        """Execute the component with given context"""
        pass
    
    def _measure_execution_time(self, start_time: float) -> int:
        """Calculate execution time in milliseconds"""
        return int((time.time() - start_time) * 1000)


class TextInputExecutor(BaseComponentExecutor):
    """Executor for text input components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get text value from input
            text_value = context.input_data.get('text', '')
            
            # Validate that text is provided
            if not text_value:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Text input is required"
                )
            
            output_data = {
                'output': {
                    'text': text_value,
                    'length': len(text_value),
                    'word_count': len(text_value.split()) if text_value else 0
                }
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Text input execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class TextOutputExecutor(BaseComponentExecutor):
    """Executor for text output components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get input text
            input_text = context.input_data.get('text', '')
            
            # Simply pass through the text
            output_data = {
                'text': input_text,
                'formatted_output': input_text
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Text output execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class OpenAILLMExecutor(BaseComponentExecutor):
    """Executor for OpenAI LLM components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get configuration
            api_key = context.config_data.get('input_values', {}).get('api_key', '')
            model = context.config_data.get('input_values', {}).get('model', 'gpt-3.5-turbo')
            temperature = context.config_data.get('input_values', {}).get('temperature', 0.7)
            max_tokens = context.config_data.get('input_values', {}).get('max_tokens', 1000)
            
            # Get input data
            prompt = context.input_data.get('prompt', '')
            system_message = context.input_data.get('system_message', '')
            
            if not api_key:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="OpenAI API key is required"
                )
            
            if not prompt:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Prompt is required"
                )
            
            # Prepare messages
            messages = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            messages.append({"role": "user", "content": prompt})
            
            # Make API call
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens
                    },
                    timeout=60.0
                )
            
            if response.status_code != 200:
                error_msg = f"OpenAI API error: {response.status_code} - {response.text}"
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=error_msg
                )
            
            result = response.json()
            
            # Extract response
            response_text = result['choices'][0]['message']['content']
            usage = result.get('usage', {})
            
            output_data = {
                'response': response_text,
                'model_used': model,
                'token_usage': usage,
                'finish_reason': result['choices'][0].get('finish_reason')
            }
            
            # Calculate cost estimate (rough estimation)
            cost_estimate = self._calculate_openai_cost(model, usage)
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time),
                cost_estimate=cost_estimate
            )
            
        except Exception as e:
            logger.error(f"OpenAI LLM execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )
    
    def _calculate_openai_cost(self, model: str, usage: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate rough cost estimate for OpenAI API call"""
        # Rough pricing (as of 2024 - should be updated)
        pricing = {
            'gpt-3.5-turbo': {'input': 0.0005, 'output': 0.0015},  # per 1K tokens
            'gpt-4': {'input': 0.03, 'output': 0.06},
            'gpt-4-turbo': {'input': 0.01, 'output': 0.03}
        }
        
        model_pricing = pricing.get(model, pricing['gpt-3.5-turbo'])
        
        prompt_tokens = usage.get('prompt_tokens', 0)
        completion_tokens = usage.get('completion_tokens', 0)
        
        input_cost = (prompt_tokens / 1000) * model_pricing['input']
        output_cost = (completion_tokens / 1000) * model_pricing['output']
        total_cost = input_cost + output_cost
        
        return {
            'total_cost_usd': round(total_cost, 6),
            'input_cost_usd': round(input_cost, 6),
            'output_cost_usd': round(output_cost, 6),
            'model': model,
            'tokens': usage
        }


class PromptTemplateExecutor(BaseComponentExecutor):
    """Executor for prompt template components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get template and variables
            template = context.input_data.get('template', '')
            variables = context.input_data.get('variables', {})
            
            if not template:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Template is required"
                )
            
            # Simple template replacement (could be enhanced with Jinja2)
            rendered_prompt = template
            for key, value in variables.items():
                placeholder = f"{{{key}}}"
                rendered_prompt = rendered_prompt.replace(placeholder, str(value))
            
            output_data = {
                'prompt': rendered_prompt,
                'template_used': template,
                'variables_applied': variables
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Prompt template execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class ConditionalExecutor(BaseComponentExecutor):
    """Executor for conditional logic components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get condition parameters
            condition_type = context.input_data.get('condition_type', 'equals')
            left_value = context.input_data.get('left_value', '')
            right_value = context.input_data.get('right_value', '')
            
            # Evaluate condition
            result = self._evaluate_condition(condition_type, left_value, right_value)
            
            output_data = {
                'condition_result': result,
                'left_value': left_value,
                'right_value': right_value,
                'condition_type': condition_type
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Conditional execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )
    
    def _evaluate_condition(self, condition_type: str, left: Any, right: Any) -> bool:
        """Evaluate condition based on type"""
        try:
            if condition_type == 'equals':
                return str(left) == str(right)
            elif condition_type == 'not_equals':
                return str(left) != str(right)
            elif condition_type == 'contains':
                return str(right) in str(left)
            elif condition_type == 'greater_than':
                return float(left) > float(right)
            elif condition_type == 'less_than':
                return float(left) < float(right)
            elif condition_type == 'is_empty':
                return not bool(str(left).strip())
            elif condition_type == 'is_not_empty':
                return bool(str(left).strip())
            else:
                return False
        except (ValueError, TypeError):
            return False


class TextProcessorExecutor(BaseComponentExecutor):
    """Executor for text processing components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get input text and operation
            text = context.input_data.get('text', '')
            operation = context.input_data.get('operation', 'uppercase')
            
            if not text:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Text input is required"
                )
            
            # Apply text processing operation
            processed_text = self._apply_text_operation(text, operation)
            
            output_data = {
                'processed_text': processed_text,
                'original_text': text,
                'operation': operation,
                'length_change': len(processed_text) - len(text)
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Text processor execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )
    
    def _apply_text_operation(self, text: str, operation: str) -> str:
        """Apply text processing operation"""
        if operation == 'uppercase':
            return text.upper()
        elif operation == 'lowercase':
            return text.lower()
        elif operation == 'title_case':
            return text.title()
        elif operation == 'trim':
            return text.strip()
        elif operation == 'remove_spaces':
            return text.replace(' ', '')
        elif operation == 'reverse':
            return text[::-1]
        elif operation == 'word_count':
            return str(len(text.split()))
        elif operation == 'char_count':
            return str(len(text))
        else:
            return text


class FileInputExecutor(BaseComponentExecutor):
    """Executor for file input components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            file_path = context.input_data.get('file_path', '')
            file_type = context.input_data.get('file_type', 'text')
            
            if not file_path:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="File path is required"
                )
            
            # Security check - ensure file path is safe
            safe_path = Path(file_path).resolve()
            if not safe_path.exists():
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=f"File not found: {file_path}"
                )
            
            # Read file based on type
            if file_type == 'text':
                async with aiofiles.open(safe_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    
                output_data = {
                    'content': content,
                    'file_path': str(safe_path),
                    'file_size': safe_path.stat().st_size,
                    'file_type': file_type
                }
                
            elif file_type == 'json':
                async with aiofiles.open(safe_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    data = json.loads(content)
                    
                output_data = {
                    'data': data,
                    'content': content,
                    'file_path': str(safe_path),
                    'file_size': safe_path.stat().st_size,
                    'file_type': file_type
                }
                
            elif file_type == 'csv':
                rows = []
                async with aiofiles.open(safe_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    reader = csv.DictReader(io.StringIO(content))
                    rows = list(reader)
                    
                output_data = {
                    'data': rows,
                    'content': content,
                    'file_path': str(safe_path),
                    'file_size': safe_path.stat().st_size,
                    'file_type': file_type,
                    'row_count': len(rows)
                }
                
            else:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=f"Unsupported file type: {file_type}"
                )
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"File input execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class FileOutputExecutor(BaseComponentExecutor):
    """Executor for file output components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            file_path = context.input_data.get('file_path', '')
            content = context.input_data.get('content', '')
            file_type = context.input_data.get('file_type', 'text')
            
            if not file_path:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="File path is required"
                )
            
            if not content:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Content is required"
                )
            
            # Ensure directory exists
            safe_path = Path(file_path).resolve()
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file based on type
            if file_type == 'text':
                async with aiofiles.open(safe_path, 'w', encoding='utf-8') as f:
                    await f.write(str(content))
                    
            elif file_type == 'json':
                if isinstance(content, str):
                    json_content = content
                else:
                    json_content = json.dumps(content, indent=2)
                    
                async with aiofiles.open(safe_path, 'w', encoding='utf-8') as f:
                    await f.write(json_content)
                    
            else:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=f"Unsupported file type: {file_type}"
                )
            
            output_data = {
                'file_path': str(safe_path),
                'file_size': safe_path.stat().st_size,
                'file_type': file_type,
                'success': True
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"File output execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class HTTPRequestExecutor(BaseComponentExecutor):
    """Executor for HTTP API request components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            url = context.input_data.get('url', '')
            method = context.input_data.get('method', 'GET').upper()
            headers = context.input_data.get('headers', {})
            params = context.input_data.get('params', {})
            data = context.input_data.get('data', {})
            timeout = context.input_data.get('timeout', 30)
            
            if not url:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="URL is required"
                )
            
            # Prepare request
            request_kwargs = {
                'method': method,
                'url': url,
                'timeout': timeout
            }
            
            if headers:
                request_kwargs['headers'] = headers
            
            if params:
                request_kwargs['params'] = params
            
            if data and method in ['POST', 'PUT', 'PATCH']:
                if isinstance(data, dict):
                    request_kwargs['json'] = data
                else:
                    request_kwargs['data'] = data
            
            # Make HTTP request
            async with httpx.AsyncClient() as client:
                response = await client.request(**request_kwargs)
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            output_data = {
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'data': response_data,
                'text': response.text,
                'url': str(response.url),
                'success': 200 <= response.status_code < 300
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"HTTP request execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class DataTransformExecutor(BaseComponentExecutor):
    """Executor for data transformation components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            data = context.input_data.get('data', {})
            operation = context.input_data.get('operation', 'filter')
            config = context.input_data.get('config', {})
            
            if not data:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Data is required"
                )
            
            result = None
            
            if operation == 'filter':
                # Filter data based on condition
                if isinstance(data, list):
                    filter_key = config.get('key', '')
                    filter_value = config.get('value', '')
                    operator = config.get('operator', 'equals')
                    
                    result = []
                    for item in data:
                        if isinstance(item, dict) and filter_key in item:
                            item_value = item[filter_key]
                            if self._apply_filter(item_value, filter_value, operator):
                                result.append(item)
                else:
                    result = data
                    
            elif operation == 'map':
                # Transform each item in data
                if isinstance(data, list):
                    mapping_config = config.get('mapping', {})
                    result = []
                    for item in data:
                        if isinstance(item, dict):
                            mapped_item = {}
                            for new_key, old_key in mapping_config.items():
                                if old_key in item:
                                    mapped_item[new_key] = item[old_key]
                            result.append(mapped_item)
                        else:
                            result.append(item)
                else:
                    result = data
                    
            elif operation == 'aggregate':
                # Aggregate data
                if isinstance(data, list):
                    agg_function = config.get('function', 'count')
                    agg_key = config.get('key', '')
                    
                    if agg_function == 'count':
                        result = len(data)
                    elif agg_function == 'sum' and agg_key:
                        result = sum(item.get(agg_key, 0) for item in data if isinstance(item, dict))
                    elif agg_function == 'average' and agg_key:
                        values = [item.get(agg_key, 0) for item in data if isinstance(item, dict)]
                        result = sum(values) / len(values) if values else 0
                    else:
                        result = len(data)
                else:
                    result = data
                    
            else:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=f"Unknown operation: {operation}"
                )
            
            output_data = {
                'data': result,
                'operation': operation,
                'original_count': len(data) if isinstance(data, list) else 1,
                'result_count': len(result) if isinstance(result, list) else 1
            }
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time)
            )
            
        except Exception as e:
            logger.error(f"Data transform execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )
    
    def _apply_filter(self, item_value: Any, filter_value: Any, operator: str) -> bool:
        """Apply filter condition"""
        try:
            if operator == 'equals':
                return str(item_value) == str(filter_value)
            elif operator == 'not_equals':
                return str(item_value) != str(filter_value)
            elif operator == 'contains':
                return str(filter_value) in str(item_value)
            elif operator == 'greater_than':
                return float(item_value) > float(filter_value)
            elif operator == 'less_than':
                return float(item_value) < float(filter_value)
            else:
                return False
        except (ValueError, TypeError):
            return False


class OllamaLLMExecutor(BaseComponentExecutor):
    """Executor for Ollama LLM components"""
    
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        start_time = time.time()
        
        try:
            # Get configuration from config_data or input_values
            config_values = context.config_data.get('input_values', {})
            
            # Get model and connection settings
            model = config_values.get('model', 'llama2')
            ollama_base_url = config_values.get('ollama_base_url', 'http://localhost:11434')
            
            # Get generation parameters
            temperature = float(config_values.get('temperature', 0.7))
            num_predict = int(config_values.get('num_predict', 1000))
            top_p = float(config_values.get('top_p', 0.9))
            top_k = int(config_values.get('top_k', 40))
            repeat_penalty = float(config_values.get('repeat_penalty', 1.1))
            stream = config_values.get('stream', False)
            timeout = int(config_values.get('timeout', 120))
            
            # Get input data
            prompt_template = context.input_data.get('prompt', '')
            system_message_template = context.input_data.get('system_message', '')
            
            # Get variable mappings and manual variables
            variable_mappings = config_values.get('variable_mappings', [])
            manual_variables = config_values.get('manual_variables', {})
            
            # Get connected input data
            input_data = context.input_data.get('input_data', {})
            
            # Apply variable substitution
            variables_applied = {}
            variables_applied.update(manual_variables)
            
            # Apply variable mappings from connected data
            for mapping in variable_mappings:
                input_field = mapping.get('input_field', '')
                variable_name = mapping.get('variable_name', '')
                default_value = mapping.get('default_value', '')
                transform = mapping.get('transform', 'none')
                
                if input_field and variable_name:
                    # Get value from input data
                    value = input_data.get(input_field, default_value)
                    
                    # Apply transformation
                    if transform == 'uppercase':
                        value = str(value).upper()
                    elif transform == 'lowercase':
                        value = str(value).lower()
                    elif transform == 'title_case':
                        value = str(value).title()
                    elif transform == 'trim':
                        value = str(value).strip()
                    
                    variables_applied[variable_name] = value
            
            # Substitute variables in prompt and system message
            prompt = prompt_template
            system_message = system_message_template
            
            for var_name, var_value in variables_applied.items():
                placeholder = f"{{{var_name}}}"
                prompt = prompt.replace(placeholder, str(var_value))
                system_message = system_message.replace(placeholder, str(var_value))
            
            # Validate required inputs
            if not model:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Model is required"
                )
            
            if not prompt:
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message="Prompt is required"
                )
            
            # Prepare the API request
            api_url = f"{ollama_base_url.rstrip('/')}/api/generate"
            
            # Build the request payload
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": stream,
                "options": {
                    "temperature": temperature,
                    "num_predict": num_predict,
                    "top_p": top_p,
                    "top_k": top_k,
                    "repeat_penalty": repeat_penalty
                }
            }
            
            # Add system message if provided
            if system_message:
                payload["system"] = system_message
            
            logger.info(f"Making Ollama API request to {api_url} with model: {model}")
            
            # Make the API call
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    api_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
            
            if response.status_code != 200:
                error_msg = f"Ollama API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                
                # Provide helpful error messages for common issues
                if response.status_code == 404:
                    if "model" in response.text.lower():
                        error_msg = f"Model '{model}' not found on Ollama server. Please ensure the model is installed."
                    else:
                        error_msg = f"Ollama server not found at {ollama_base_url}. Please check the server URL and ensure Ollama is running."
                elif response.status_code == 500:
                    error_msg = f"Ollama server error. This might be due to insufficient memory or the model not being properly loaded."
                
                return ExecutionResult(
                    success=False,
                    output_data={},
                    execution_time_ms=self._measure_execution_time(start_time),
                    error_message=error_msg
                )
            
            # Parse the response
            result = response.json()
            
            # Extract response text and metadata
            response_text = result.get('response', '')
            model_used = result.get('model', model)
            
            # Get timing and token information
            total_duration = result.get('total_duration', 0)
            eval_count = result.get('eval_count', 0)
            eval_duration = result.get('eval_duration', 0)
            prompt_eval_count = result.get('prompt_eval_count', 0)
            prompt_eval_duration = result.get('prompt_eval_duration', 0)
            
            # Calculate performance metrics
            tokens_per_second = 0
            if eval_duration > 0:
                tokens_per_second = round((eval_count * 1e9) / eval_duration, 2)
            
            # Calculate performance stats
            performance_stats = {
                'execution_time_ms': self._measure_execution_time(start_time),
                'tokens_generated': eval_count,
                'tokens_per_second': tokens_per_second,
                'average_token_time': (eval_duration / 1e9 / eval_count) if eval_count > 0 else 0,
                'prompt_tokens': prompt_eval_count,
                'total_duration_ns': total_duration,
                'generation_stats': {
                    'total_duration': total_duration,
                    'eval_count': eval_count,
                    'eval_duration': eval_duration,
                    'prompt_eval_count': prompt_eval_count,
                    'prompt_eval_duration': prompt_eval_duration
                },
                'server_info': {
                    'ollama_url': ollama_base_url,
                    'model': model_used,
                    'variables_used': len(variables_applied)
                }
            }

            # Prepare output data using single output port structure
            output_data = {
                'output': {
                    'response': response_text,
                    'model_used': model_used,
                    'total_duration': total_duration,
                    'eval_count': eval_count,
                    'eval_duration': eval_duration,
                    'performance_stats': performance_stats
                }
            }
            
            # Calculate local execution cost estimate (time-based)
            execution_time_seconds = self._measure_execution_time(start_time) / 1000
            cost_estimate = {
                'execution_time_seconds': execution_time_seconds,
                'tokens_generated': eval_count,
                'tokens_per_second': tokens_per_second,
                'model_used': model_used,
                'cost_usd': 0.0,  # Local models are free
                'cost_type': 'local_compute'
            }
            
            logger.info(f"Ollama generation completed: {eval_count} tokens in {execution_time_seconds:.2f}s")
            
            return ExecutionResult(
                success=True,
                output_data=output_data,
                execution_time_ms=self._measure_execution_time(start_time),
                cost_estimate=cost_estimate
            )
            
        except httpx.TimeoutException:
            error_msg = f"Ollama API request timed out. The model '{model}' might be loading or the server is overloaded."
            logger.error(error_msg)
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=error_msg
            )
            
        except httpx.ConnectError:
            error_msg = f"Cannot connect to Ollama server at {ollama_base_url}. Please ensure Ollama is running and accessible."
            logger.error(error_msg)
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=error_msg
            )
            
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON response from Ollama API: {str(e)}"
            logger.error(error_msg)
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=error_msg
            )
            
        except Exception as e:
            logger.error(f"Ollama LLM execution failed: {e}")
            return ExecutionResult(
                success=False,
                output_data={},
                execution_time_ms=self._measure_execution_time(start_time),
                error_message=str(e)
            )


class ComponentExecutorFactory:
    """Factory for creating component executors"""
    
    def __init__(self):
        self._executors = {
            'text_input': TextInputExecutor(),
            'text_output': TextOutputExecutor(),
            'openai_llm': OpenAILLMExecutor(),
            'ollama_llm': OllamaLLMExecutor(),
            'prompt_template': PromptTemplateExecutor(),
            'conditional': ConditionalExecutor(),
            'text_processor': TextProcessorExecutor(),
            'file_input': FileInputExecutor(),
            'file_output': FileOutputExecutor(),
            'http_request': HTTPRequestExecutor(),
            'data_transform': DataTransformExecutor(),
        }
    
    def get_executor(self, component_type: str) -> BaseComponentExecutor:
        """Get executor for component type"""
        executor = self._executors.get(component_type)
        if not executor:
            raise ValueError(f"Unknown component type: {component_type}")
        return executor
    
    def register_executor(self, component_type: str, executor: BaseComponentExecutor):
        """Register a new executor"""
        self._executors[component_type] = executor
    
    def get_supported_types(self) -> List[str]:
        """Get list of supported component types"""
        return list(self._executors.keys())