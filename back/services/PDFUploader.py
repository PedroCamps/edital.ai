import os
import numpy as np
import faiss
import pickle
import requests
import json
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException, UploadFile
import tempfile
from openai import AzureOpenAI
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter


class PDFUploader:
    def __init__(self, url_base="http://localhost:8000/main/pdf/upload"):
        self.url_base = url_base

    async def upload_pdf(self, file: UploadFile) -> str:
        """
        Upload PDF file to the service and return extracted content
        """
        try:
            # Create temporary file to save the uploaded file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file_path = temp_file.name
                # Write the uploaded file to the temporary file
                content = await file.read()
                temp_file.write(content)
            
            # Now upload the temporary file to the service
            files = {'file': open(temp_file_path, 'rb')}
            response = requests.post(self.url_base, files=files)
            
            # Clean up the temporary file
            os.unlink(temp_file_path)
            
            # Parse the response
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to upload PDF to extraction service")
            
            json_response = json.loads(response.content)
            content = json_response["data"]["content"]
            return content
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF upload failed: {str(e)}")
