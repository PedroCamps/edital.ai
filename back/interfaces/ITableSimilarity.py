from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from fastapi import UploadFile

class ITableSimilarity(ABC):
    """
    Interface para processamento de similaridade de tabelas.
    Recebe um CSV e produz um CSV enriquecido.
    """
    
    @abstractmethod
    async def process(self, csv_path: str, description_column: str, similarity_threshold: float = 0.5) -> str:
        """
        Processa um CSV para encontrar similaridades.
        
        Args:
            csv_path: Caminho para o arquivo CSV
            description_column: Nome da coluna de descrição
            similarity_threshold: Limiar de similaridade
            
        Returns:
            Caminho para o CSV enriquecido
        """
        pass