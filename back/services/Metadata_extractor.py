from interfaces.IMetadata import IMetadata 
from services.rag_service import RAGService
from openai import AzureOpenAI
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException, UploadFile
from services.PDFUploader import PDFUploader
import os 
import numpy as np
import faiss
import pickle
import re
import unicodedata
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Obter variáveis de ambiente para configuração da Azure
AZURE_API_KEY = os.environ.get("AZURE_API_KEY")
AZURE_ENDPOINT = os.environ.get("AZURE_ENDPOINT")
AZURE_API_VERSION = os.environ.get("AZURE_API_VERSION")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL")
LLM_MODEL = os.environ.get("LLM_MODEL")

# Base prompt for bidding document analysis
PROMPT_BASE = """Validade da proposta
Prazo de entrega
Cidade
Estado
Horário de abertura da licitação
Número de casas decimais para proposta
Documentações necessárias para habilitação
Objeto da licitação (qual é o escopo ou finalidade da contratação?)
Modalidade da licitação (concorrência, tomada de preços, convite etc.)
Valor estimado para a contratação
Critérios de julgamento (menor preço, técnica e preço, melhor técnica etc.)
Condições de pagamento
Garantias exigidas (garantia de proposta, garantia contratual, etc.)
Requisitos técnicos e de qualificação (experiência mínima, comprovação de capacidade, etc.)
Cronograma do processo (prazos para submissão de propostas, impugnações, recursos e execução)
Penalidades e sanções em caso de descumprimento contratual
Critérios adicionais para habilitação (regularidade fiscal, qualificação jurídica, comprovação de capacidade técnica, etc.)
Critérios para desclassificação ou penalização de propostas"""

PROMPT_DESCRIPTION = """Comporte-se como um agente em uma empresa de licitações para medicamentos hospitalares e responda as seguintes perguntas com a maior precisão:"""

class MetadataExtractor(IMetadata):
    def __init__(self, json_data=None):
        self.metadata = {
            "municipio": "",
            "number_itens": 0,
            "embeddings_path": "",
            "csv_path": "",
        }
        self.json_data = json_data
        self.embeddings_cache = {}
        self.pdf_uploader = PDFUploader()
        self.client = AzureOpenAI(
            api_key=AZURE_API_KEY,
            api_version=AZURE_API_VERSION,
            azure_endpoint=AZURE_ENDPOINT
        )
        self.llm_model = LLM_MODEL
        self.accepted_municipalities = [
            "itumbiara", "padre_bernardo", "frutal", 
            "sao_roque", "cavalcante", "rondonia","rondonia"
        ]

    # Implementação do método abstrato 'process' definido na interface IMetadata
    def process(self, content: str) -> Dict[str, Any]:
        """
        Processa o conteúdo para extrair metadados.
        
        Args:
            content: Conteúdo do documento a ser processado
            
        Returns:
            Dicionário com os metadados extraídos
        """
        # Extrair metadados de forma síncrona
        # Extrair município usando regex
        municipio_pattern = r"(?:PREFEITURA|MUNICÍPIO)\s+(?:DE|DO|DA)\s+([A-ZÀ-Ú\s]+?)(?:\/[A-Z]{2}|\s+CNPJ|\s+-|\n)"
        municipio_match = re.search(municipio_pattern, content, re.IGNORECASE)
        
        if municipio_match:
            extracted_municipio = municipio_match.group(1).strip()
            normalized_municipio = self._normalize_municipality_name(extracted_municipio)
            if normalized_municipio in self.accepted_municipalities:
                self.metadata["municipio"] = normalized_municipio
        
        # Contar itens no documento
        item_pattern = r"(?:Item|ITEM)\s+(\d+)[:\.\)-]"
        item_matches = re.findall(item_pattern, content)
        
        if item_matches:
            self.metadata["number_itens"] = len(set(item_matches))
        
        # Retornar os metadados extraídos
        return self.metadata

    async def process_pdf(self, file: UploadFile) -> str:
        """
        Process a PDF file, extract metadata, and create embeddings for RAG
        """
        # Upload PDF and get content
        content = await self.pdf_uploader.upload_pdf(file)
        
        # Extract metadata from content
        await self._extract_metadata(content)
        
        # Save file information to metadata
        filename_base = os.path.splitext(file.filename)[0]
        embeddings_path = f"embeddings/{filename_base}.pkl"
        csv_path = f"csv/{filename_base}.csv"
        
        self.metadata["embeddings_path"] = embeddings_path
        self.metadata["csv_path"] = csv_path
        
        # Process content to create chunks
        chunks = self._split_content(content)
        
        # Generate embeddings for chunks
        embeddings_array, index = self._generate_embeddings(chunks)
        
        # Create a unique ID for this content
        content_id = filename_base
        
        # Cache the embeddings and index
        self.embeddings_cache[content_id] = {
            "embeddings": embeddings_array,
            "texts": chunks,
            "index": index,
            "content": content
        }
        
        # Save embeddings and other data to disk
        self._save_embeddings(content_id, chunks, embeddings_array, index)
        
        return content_id
    
    async def _extract_metadata(self, content: str) -> None:
        """
        Extract municipality and number of items from the document content
        Only accepts specific municipalities: itumbiara, padre_bernardo, frutal, sao_roque, cavalcante, rondonia
        """
        # First try to extract metadata using regex patterns
        municipio_pattern = r"(?:PREFEITURA|MUNICÍPIO)\s+(?:DE|DO|DA)\s+([A-ZÀ-Ú\s]+?)(?:\/[A-Z]{2}|\s+CNPJ|\s+-|\n)"
        municipio_match = re.search(municipio_pattern, content, re.IGNORECASE)
        
        if municipio_match:
            extracted_municipio = municipio_match.group(1).strip()
            # Normalize the extracted municipality name for comparison
            normalized_extracted = self._normalize_municipality_name(extracted_municipio)
            
            # Check if the normalized municipality is in the accepted list
            if normalized_extracted in self.accepted_municipalities:
                self.metadata["municipio"] = normalized_extracted
            else:
                self.metadata["municipio"] = None  # Not an accepted municipality
        
        # Count items in the document (assuming they're numbered)
        item_pattern = r"(?:Item|ITEM)\s+(\d+)[:\.\)-]"
        item_matches = re.findall(item_pattern, content)
        
        if item_matches:
            self.metadata["number_itens"] = len(set(item_matches))
        
        # If regex extraction fails, use LLM to extract metadata
        #if  not self.metadata.get("municipio") or  not self.metadata.get("number_itens"):
        chat_messages = [
            {"role": "system", "content": f"Extraia as seguintes informações do documento de licitação fornecido: 1) Nome do município (apenas aceite: {', '.join(self.accepted_municipalities)}), 2) Número total de itens a serem licitados. Retorne apenas um JSON com as chaves 'municipio' e 'number_itens'."},
            {"role": "user", "content": f"Documento: {content[:4000]}"}  # Using first 4000 chars for context
        ]
        
        response = self.client.chat.completions.create(
            model=self.llm_model,
            messages=chat_messages,
            response_format={"type": "json_object"}
        )
        
        try:
            result = response.choices[0].message.content
            import json
            metadata_llm = json.loads(result)
            
            if not self.metadata.get("municipio") and "municipio" in metadata_llm:
                # Normalize and validate the LLM-extracted municipality
                normalized_llm_municipio = self._normalize_municipality_name(metadata_llm["municipio"])
                if normalized_llm_municipio in self.accepted_municipalities:
                    self.metadata["municipio"] = normalized_llm_municipio
            
            if not self.metadata.get("number_itens") and "number_itens" in metadata_llm:
                self.metadata["number_itens"] = int(metadata_llm["number_itens"])
        except Exception as e:
            print(f"Error extracting metadata with LLM: {e}")

    def _normalize_municipality_name(self, name: str) -> str:
        """
        Normalize municipality name for consistent comparison:
        - Convert to lowercase
        - Remove accents
        - Replace spaces with underscores
        - Remove extra characters
        """
        # Convert to lowercase and remove accents
        name = name.lower()
        name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
        
        # Remove common prefixes
        name = re.sub(r'^(prefeitura|municipio|município)\s+(de|do|da)\s+', '', name)
        
        # Replace spaces with underscores and remove special characters
        name = re.sub(r'[^a-z0-9]', '_', name)
        name = re.sub(r'_+', '_', name)  # Replace multiple underscores with single one
        name = name.strip('_')
        
        return name
    
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
            chunk_overlap = 100
            
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
                chunk_size=512, chunk_overlap=60
            )
            return text_splitter.split_text(content)
    
    def _generate_embeddings(self, chunks: List[str]) -> Tuple[np.ndarray, faiss.Index]:
        """
        Generate embeddings for text chunks and create FAISS index
        """
        embeddings = []
        for chunk in chunks:
            embedding = self._get_embedding(chunk)
            embeddings.append(embedding)
        
        # Convert to numpy array
        embeddings_array = np.array(embeddings, dtype=np.float32)
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings_array)
        
        # Create FAISS index
        dimension = embeddings_array.shape[1]
        index = faiss.IndexFlatIP(dimension)  # Inner product (cosine similarity)
        index.add(embeddings_array)
        
        return embeddings_array, index
    
    def _get_embedding(self, text: str) -> List[float]:
        """
        Get embedding for a single text
        """
        response = self.client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=[text]
        )
        return response.data[0].embedding
    
    def _save_embeddings(self, content_id: str, chunks: List[str], embeddings_array: np.ndarray, index: faiss.Index) -> None:
        """
        Save embeddings, chunks and index to disk
        """
        # Create directories if they don't exist
        os.makedirs('embeddings', exist_ok=True)
        
        # Save data to pickle file
        data_to_save = {
            "embeddings": embeddings_array,
            "texts": chunks,
            "metadata": self.metadata
        }
        
        with open(f"embeddings/{content_id}.pkl", 'wb') as f:
            pickle.dump(data_to_save, f)
        
        # Save FAISS index
        faiss.write_index(index, f"embeddings/{content_id}_index.faiss")
    
    def search(self, query_embedding: np.ndarray, content_id: str, top_k: int = 5) -> Tuple[List[Tuple[float, int]], List[str]]:
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
    
    def prepare_query(self, query: str) -> np.ndarray:
        """
        Prepare query by converting to embedding and normalizing
        """
        embedded_query = self._get_embedding(query)
        embedded_query = np.array(embedded_query, dtype=np.float32)
        
        # Reshape to ensure it's 2D (add batch dimension if needed)
        if embedded_query.ndim == 1:
            embedded_query = embedded_query.reshape(1, -1)
        
        faiss.normalize_L2(embedded_query)
        
        return embedded_query
    
    async def answer_question(self, query: str, content_id: str, max_tokens: int = 500, top_k: int = 5) -> Dict[str, Any]:
        """
        Answer a question using RAG
        """
        if not content_id or content_id not in self.embeddings_cache:
            raise HTTPException(status_code=404, detail="No content available. Please upload a PDF first.")
        
        # Prepare query embedding
        query_embedding = self.prepare_query(query)
        
        # Search for relevant chunks
        results, retrieved_texts = self.search(query_embedding, content_id, top_k)
        
        # Construct context from retrieved results
        context = ""
        for (sim, idx), text in zip(results, retrieved_texts):
            context += f"[Similarity: {sim:.4f}]\n{text}\n\n"
        
        # Prepare chat messages for LLM
        chat_messages = [
            {"role": "system", "content": PROMPT_DESCRIPTION},
            {"role": "user", "content": f"Context from knowledge base:\n{context}\n\nUser query: {query}"}
        ]
        
        # Get response from LLM
        response = self.client.chat.completions.create(
            model=self.llm_model,
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
            "similarity_scores": [float(sim) for sim, _ in results],
            "metadata": self.metadata
        }
    
    async def extract_bidding_info(self, content_id: str) -> Dict[str, str]:
        """
        Extract key bidding information based on PROMPT_BASE
        """
        if not content_id or content_id not in self.embeddings_cache:
            raise HTTPException(status_code=404, detail="No content available. Please upload a PDF first.")
        
        cache_entry = self.embeddings_cache[content_id]
        content = cache_entry["content"]
        
        # Use LLM to extract all the required information
        chat_messages = [
            {"role": "system", "content": f"Você é um especialista em licitações. Extraia as seguintes informações do documento fornecido:\n{PROMPT_BASE}\n\nRetorne as informações em formato JSON, com a informação exata encontrada no documento."},
            {"role": "user", "content": f"Documento de licitação:\n{content[:15000]}"}  # Using first 15000 chars for context
        ]
        
        response = self.client.chat.completions.create(
            model=self.llm_model,
            messages=chat_messages,
            response_format={"type": "json_object"},
            max_tokens=1500
        )
        
        try:
            result = response.choices[0].message.content
            import json
            bidding_info = json.loads(result)
            
            # Add metadata to the response
            bidding_info["municipio"] = self.metadata["municipio"]
            bidding_info["number_itens"] = self.metadata["number_itens"]
            
            return bidding_info
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error extracting bidding information: {e}")