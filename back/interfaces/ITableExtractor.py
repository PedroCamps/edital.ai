from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from fastapi import UploadFile

class ITableExtractor(ABC):
    """
    Interface para extração de tabelas.
    Recebe um JSON e produz um CSV.
    """
    
    @abstractmethod
    async def extract_to_csv(self, json_data: Dict[str, Any], output_path: Optional[str] = None) -> str:
        """
        Extrai tabelas de um JSON e salva como CSV.
        
        Args:
            json_data: Dados JSON com tabelas
            output_path: Caminho opcional para salvar o CSV
            
        Returns:
            Caminho do arquivo CSV gerado
        """
        pass

