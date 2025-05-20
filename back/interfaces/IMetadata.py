from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from fastapi import UploadFile

class IMetadata(ABC):
    """
    Interface para processamento de metadados.
    Recebe um JSON e produz um dicionário de metadados.
    """
    
    @abstractmethod
    async def process(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa um JSON para extrair metadados.
        
        Args:
            json_data: Dados JSON a serem processados
            
        Returns:
            Um dicionário com metadados extraídos
        """
        pass