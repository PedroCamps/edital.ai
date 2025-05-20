from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from fastapi import UploadFile

class IExtraction(ABC):
    """
    Interface para extração de dados de PDF.
    Recebe um PDF e produz um JSON com os dados extraídos.
    """   
    
    @abstractmethod
    async def extract(self, pdf_file: UploadFile) -> Dict[str, Any]:
        """
        Extrai dados de um arquivo PDF.
        
        Args:
            pdf_file: Arquivo PDF a ser processado
            
        Returns:
            Um dicionário JSON com os dados extraídos
        """
        pass
   