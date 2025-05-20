from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from fastapi import UploadFile


class IRAG(ABC):
    """
    Interface para processamento RAG (Retrieval Augmented Generation).
    Possui duas funções: uma para preparação e outra para resposta do LLM.
    """
    
    @abstractmethod
    async def prepare(self, metadata: Dict[str, Any]) -> List[str]:
        """
        Prepara dados para o processamento RAG.
        
        Args:
            metadata: Dicionário de metadados
            
        Returns:
            Lista de strings com dados preparados para RAG
        """
        pass
    
    @abstractmethod
    async def answer_question(self, question: str, context_id: str) -> Dict[str, Any]:
        """
        Gera respostas usando RAG com base em uma pergunta.
        
        Args:
            question: Pergunta do usuário
            context_id: Identificador do contexto para recuperação
            
        Returns:
            Resposta do LLM com informações adicionais
        """
        pass

