import os
import numpy as np
import faiss
import pickle
import json
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException, UploadFile
import tempfile
from openai import AsyncAzureOpenAI
from openai import AzureOpenAI
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
import asyncio
import time
import inspect

# Configurações
PROMPT_DESCRIPTION = """se comporte como um agente em uma empresa de licitacoes para medicamentos hospitalares e responda as seguintes perguntas com a maior precisao:"""

class RAGService:
    def __init__(self, embedding_client, client, llm_model):
        self.embeddings_cache = {}  # Map of content_id to embeddings data
        self._llm_model = llm_model
        self._client = client
        self._embedding_client = embedding_client

    async def process_pdf(self, content, municipio) -> str:
        """
        Process a PDF file and create embeddings for RAG
        """
        
        # Process content to create chunks
        chunks = self._split_content(content)
        
        # Generate embeddings for chunks
        embeddings_array, index = await self._generate_embeddings(chunks)
        
        # Create a unique ID for this content - use the filename base
        content_id = os.path.splitext(municipio)[0]
        
        # Cache the embeddings and index
        self.embeddings_cache[content_id] = {
            "embeddings": embeddings_array,
            "texts": chunks,
            "index": index,
            "content": content
        }
        
        return content_id
    
    def _split_content(self, content: str) -> List[str]:
        """
        Split content into chunks for embedding
        """
        # Markdown header splitter
        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ]
        
        try:
            markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
            md_header_splits = markdown_splitter.split_text(content)
            
            # Further split by character count
            chunk_size = 1024
            chunk_overlap = 200
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size, chunk_overlap=chunk_overlap
            )
            
            # Process each document in md_header_splits
            splits = []
            for doc in md_header_splits:
                # Extract the content from each document
                doc_splits = text_splitter.split_text(doc.page_content)
                splits.extend(doc_splits)
                
            return splits
        except Exception as e:
            # Fallback if markdown splitting fails
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1024, chunk_overlap=100
            )
            return text_splitter.split_text(content)
    
    async def _generate_embeddings(self, chunks: List[str]) -> Tuple[np.ndarray, faiss.Index]:
        """
        Gera embeddings para os chunks de texto e cria o índice FAISS de forma assíncrona.
        """
        start_time = time.perf_counter()
        # Cria um semáforo para limitar concorrência
        sem = asyncio.Semaphore(10)

        async def limited_get_embedding(chunk: str):
            async with sem:
                return await self._get_embedding(chunk)

        # Dispara as tarefas com limite de concorrência
        tasks = [limited_get_embedding(chunk) for chunk in chunks]
        embeddings = await asyncio.gather(*tasks)
    
        end_time = time.perf_counter()
        elapsed = end_time - start_time
        print(f"Tempo total para gerar embeddings: {elapsed:.2f} segundos")
        
        # Converte para array numpy
        embeddings_array = np.array(embeddings, dtype=np.float32)
        
        # Normaliza para similaridade cosseno
        faiss.normalize_L2(embeddings_array)
        
        # Cria o índice FAISS
        dimension = embeddings_array.shape[1]
        index = faiss.IndexFlatIP(dimension)  # Produto interno (similaridade cosseno)
        index.add(embeddings_array)
        
        return embeddings_array, index
    
    async def _get_embedding(self, text: str) -> List[float]:
        """
        Get embedding for a single text de forma assíncrona
        """
        try:
            response = await self._embedding_client.embeddings.create(
                model="text-embedding-3-large", # ou o modelo que você estiver usando
                input=[text]
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Erro ao gerar embedding: {e}")
            raise HTTPException(status_code=500, detail=f"Falha ao gerar embedding: {str(e)}")
    
    async def prepare_query(self, query: str) -> np.ndarray:
        """
        Prepare query by converting to embedding and normalizing
        """
        embedded_query = await self._get_embedding(query)
        embedded_query = np.array([embedded_query], dtype=np.float32)
        
        # Normaliza para similaridade cosseno
        faiss.normalize_L2(embedded_query)
        
        return embedded_query
    
    async def search(self, query_embedding: np.ndarray, content_id: Optional[str], top_k: int = 5) -> Tuple[List[Tuple[float, int]], List[str]]:
        """
        Search for relevant chunks using the query embedding
        """
        if content_id not in self.embeddings_cache:
            raise HTTPException(status_code=404, detail=f"Content ID {content_id} not found")
        
        cache_entry = self.embeddings_cache[content_id]
        
        # Search the index
        D, I = cache_entry["index"].search(query_embedding, top_k)
        
        results = []
        retrieved_texts = []
        
        for sim, idx in zip(D[0], I[0]):
            results.append((sim, idx))
            retrieved_texts.append(cache_entry["texts"][idx])
        
        return results, retrieved_texts
    
    async def answer_question(self, query: str, content_id: Optional[str], max_tokens: int = 500, top_k: int = 1) -> Dict[str, Any]:
        """
        Answer a question using RAG
        """
        if not content_id or content_id not in self.embeddings_cache:
            raise HTTPException(status_code=404, detail="No content available. Please upload a PDF first.")
        
        # Prepare query embedding - agora assíncrono
        query_embedding = await self.prepare_query(query)
        
        # Search for relevant chunks - agora assíncrono
        results, retrieved_texts = await self.search(query_embedding, content_id, top_k)
        
        # Construct context from retrieved results
        context = ""
        for (sim, idx), text in zip(results, retrieved_texts):
            context += f"[Similarity: {sim:.4f}]\n{text}\n\n"
        
        # Prepare chat messages for LLM
        chat_messages = [
            {"role": "system", "content": PROMPT_DESCRIPTION},
            {"role": "user", "content": f"Context from knowledge base:\n{context}\n\nUser query: {query}"}
        ]
        
        # Get response from LLM - verificando se é assíncrono
        if hasattr(self._client.chat.completions.create, "__await__"):
            response = await self._client.chat.completions.create(
                model=self._llm_model,
                messages=chat_messages,
                max_tokens=max_tokens
            )
        else:
            # Fallback para síncrono se necessário
            response = self._client.chat.completions.create(
                model=self._llm_model,
                messages=chat_messages,
                max_tokens=max_tokens
            )
        
        # Prepare response
        return {
            "query": query,
            "response": response.choices[0].message.content,
            "context_used": [
                {"similarity": float(sim), "text": text} 
                for (sim, _), text in zip(results, retrieved_texts)
            ],
            "similarity_scores": [float(sim) for sim, _ in results]
        }