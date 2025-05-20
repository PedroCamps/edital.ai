from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, HTTPException # type: ignore
import pandas as pd
import numpy as np
import faiss # type: ignore
import pickle
import os

# Importe suas classes existentes
from services.completion_service import ProductSearchEngine, EmbeddingManager
from services.extractor_services import ExtratorLicitacao, processar_diretorio_licitacoes
from services.Metadata_extractor import MetadataExtractor
from services.PDFUploader import PDFUploader
from services.rag_service import RAGService

app = FastAPI()

class Metadata:
    """
    Classe abrangente para armazenar todos os metadados do processo
    """
    def __init__(
        self,
        name: Optional[str] = None,
        csv_path: Optional[str] = None,
        json_path: Optional[str] = None,
        number_of_products: Optional[int] = None,
        total_amount: Optional[float] = None,
        total_similarity: Optional[float] = None,
        municipio: Optional[str] = None,
        embeddings_path: Optional[str] = None,
        numero_itens: Optional[int] = None,
        formato_licitacao: Optional[str] = None,
        raio_metadata: Optional[Dict[str, Any]] = None
    ):
        # Metadados básicos
        self.name = name
        self.csv_path = csv_path
        self.json_path = json_path
        
        # Metadados de produtos
        self.number_of_products = number_of_products
        self.total_amount = total_amount
        self.total_similarity = total_similarity
        
        # Metadados específicos de licitações
        self.municipio = municipio
        self.numero_itens = numero_itens
        self.formato_licitacao = formato_licitacao
        
        # Metadados técnicos
        self.embeddings_path = embeddings_path
        
        # Metadados do RAG
        self.raio_metadata = raio_metadata or {}
        
        # Histórico de processamento
        self.processing_steps: List[str] = []
        self.errors: List[str] = []

    def update(self, **kwargs):
        """Atualiza múltiplos metadados de uma vez"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
                
    def add_processing_step(self, step: str):
        """Registra uma etapa de processamento"""
        self.processing_steps.append(step)
        
    def add_error(self, error: str):
        """Registra um erro ocorrido"""
        self.errors.append(error)
        
    def to_dict(self) -> Dict[str, Any]:
        """Converte os metadados para dicionário"""
        return {
            'name': self.name,
            'csv_path': self.csv_path,
            'json_path': self.json_path,
            'number_of_products': self.number_of_products,
            'total_amount': self.total_amount,
            'total_similarity': self.total_similarity,
            'municipio': self.municipio,
            'embeddings_path': self.embeddings_path,
            'numero_itens': self.numero_itens,
            'formato_licitacao': self.formato_licitacao,
            'raio_metadata': self.raio_metadata,
            'processing_steps': self.processing_steps,
            'errors': self.errors
        }

class MedvittaAPI:
    """Classe centralizadora dos serviços"""
    
    def __init__(self):
        # Importa dotenv aqui para garantir carregamento das variáveis ambientais
        from dotenv import load_dotenv
        load_dotenv()
        
        # Configurações principais usando variáveis de ambiente
        self.config = {
            'azure_api_key': os.getenv("AZURE_API_KEY"),
            'azure_endpoint': os.getenv("AZURE_ENDPOINT"),
            'azure_api_version': os.getenv("AZURE_API_VERSION"),
            'embedding_model': os.getenv("EMBEDDING_MODEL"),
            'llm_model': os.getenv("LLM_MODEL")
        }
        
        # Inicialização dos serviços
        self.extrator = ExtratorLicitacao()
        self.pdf_uploader = PDFUploader()
        self.metadata_extractor = MetadataExtractor()
        self.raio_service = RAGService()
        
        # Gerenciador de embeddings e busca
        self.embedding_manager = EmbeddingManager(
            api_key=self.config['azure_api_key'],
            api_version=self.config['azure_api_version'],
            azure_endpoint=self.config['azure_endpoint'],
            model=self.config['embedding_model'],
            embeddings_path="",
            product_names_path=""
        )
        
        self.search_engine = ProductSearchEngine(self.embedding_manager)
        
        # Metadados centralizados
        self.metadata = Metadata()

    async def process_pdf(self, file: UploadFile):
        """Processa um PDF completo"""
        try:
            # 1. Upload e extração básica
            content = await self.pdf_uploader.upload_pdf(file)
            self.metadata.update(name=file.filename)
            self.metadata.add_processing_step("PDF upload completo")
            
            # 2. Extração de metadados
            await self.metadata_extractor._extract_metadata(content)
            self.metadata.update(
                municipio=self.metadata_extractor.metadata["municipio"],
                numero_itens=self.metadata_extractor.metadata["number_itens"]
            )
            self.metadata.add_processing_step("Extração de metadados concluída")
            
            # 3. Processamento do PDF
            df = self.extrator.extrair_dados(content)
            csv_path = f"data/{file.filename}_processed.csv"
            df.to_csv(csv_path)
            self.metadata.update(csv_path=csv_path)
            self.metadata.add_processing_step("Processamento de dados concluído")
            
            # 4. Geração de embeddings
            content_id = await self.raio_service.process_pdf(file)
            self.metadata.update(
                embeddings_path=f"embeddings/{content_id}.pkl",
                raio_metadata=self.raio_service.embeddings_cache[content_id]
            )
            self.metadata.add_processing_step("Embeddings gerados e armazenados")
            
            return self.metadata.to_dict()
            
        except Exception as e:
            self.metadata.add_error(str(e))
            raise HTTPException(status_code=500, detail=str(e))

    async def search_products(self, query: str, threshold: float = 0.5):
        """Busca produtos similares"""
        if not self.metadata.csv_path:
            raise HTTPException(status_code=400, detail="Processe um PDF primeiro")
            
        try:
            df = pd.read_csv(self.metadata.csv_path)
            result_df = self.search_engine.process_dataframe(
                df=df,
                description_column="DESCRIÇÃO",
                threshold=threshold
            )
            
            # Atualizar metadados
            self.metadata.update(
                number_of_products=len(result_df),
                total_similarity=result_df['similarity'].mean()
            )
            
            return result_df.to_dict()
            
        except Exception as e:
            self.metadata.add_error(str(e))
            raise HTTPException(status_code=500, detail=str(e))

    async def answer_question(self, query: str):
        """Responde perguntas usando RAG"""
        if not self.metadata.embeddings_path:
            raise HTTPException(status_code=400, detail="Embeddings não disponíveis")
            
        try:
            content_id = os.path.splitext(self.metadata.name)[0]
            response = await self.raio_service.answer_question(query, content_id)
            self.metadata.raio_metadata.update(response)
            return response
            
        except Exception as e:
            self.metadata.add_error(str(e))
            raise HTTPException(status_code=500, detail=str(e))

# Rotas da API
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile):
    api = MedvittaAPI()
    return await api.process_pdf(file)

@app.post("/search-products")
async def search_products(query: str, threshold: float = 0.5):
    api = MedvittaAPI()
    return await api.search_products(query, threshold)

@app.post("/ask")
async def ask_question(query: str):
    api = MedvittaAPI()
    return await api.answer_question(query)

@app.get("/metadata")
async def get_metadata():
    api = MedvittaAPI()
    return api.metadata.to_dict()