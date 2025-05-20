# middleware/numpy_json.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from utils.json_utils import convert_numpy_types
import json

class NumPyJSONMiddleware(BaseHTTPMiddleware):
    """
    Middleware para converter tipos NumPy para tipos Python nativos em respostas JSON.
    """
    async def dispatch(self, request: Request, call_next):
        # Process the request normally
        response = await call_next(request)
        
        # If it's a JSONResponse, intercept and convert NumPy types
        if isinstance(response, JSONResponse):
            # Decode the response content
            content = json.loads(response.body)
            
            # Convert NumPy types to Python native types
            converted_content = convert_numpy_types(content)
            
            # Create a new response with the converted content
            return JSONResponse(
                content=converted_content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
                background=response.background
            )
        
        return response