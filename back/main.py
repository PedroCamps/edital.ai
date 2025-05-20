import pickle
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
from typing import Optional, Dict, Any, List
from fastapi.responses import FileResponse
import pandas as pd
import json
from utils.json_utils import convert_numpy_types
# Importar os serviços
from services.PDFUploader import PDFUploader
from services.Metadata_extractor import MetadataExtractor
from services.extractor_services import  process_edital
from services.rag_service import RAGService
from services.completion_service import EmbeddingManager, ProductSearchEngine
from openai import AsyncAzureOpenAI, AzureOpenAI
from mistralai import Mistral
from pathlib import Path
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações da Azure
AZURE_API_KEY = os.environ.get("AZURE_API_KEY")
AZURE_ENDPOINT = os.environ.get("AZURE_ENDPOINT")
AZURE_API_VERSION = os.environ.get("AZURE_API_VERSION")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL")
LLM_MODEL = os.environ.get("LLM_MODEL")

# Caminhos para arquivos de dados
DATA_DIR = os.environ.get("DATA_DIR", "data")
EMBEDDINGS_DIR = os.environ.get("EMBEDDINGS_DIR", "embeddings")
RESULTS_DIR = os.environ.get("RESULTS_DIR", "results")

# Configurações de produto
EMBEDDINGS_PATH = os.environ.get("EMBEDDINGS_PATH")
PRODUCT_NAMES_PATH = os.environ.get("PRODUCT_NAMES_PATH")

# Criar diretórios se não existirem
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(EMBEDDINGS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Inicialização da aplicação
app = FastAPI(title="Processador de Editais de Licitação")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Armazenamento em memória para caches de processamento
# Na produção, isso deve ser substituído por um armazenamento persistente como Redis ou banco de dados
processing_cache = {}

# Classe para gerenciar o estado do processamento
class ProcessingState:
    def __init__(self):
        try:
            # Inicialização dos serviços principais
            self.pdf_uploader = PDFUploader()
            
            # Inicializar MetadataExtractor com argumentos vazios - corrigido
            self.metadata_extractor = MetadataExtractor()
            
            # Inicializar clientes para OpenAI
            self._embedding_client = AsyncAzureOpenAI(
                api_key=AZURE_API_KEY,
                api_version=AZURE_API_VERSION,
                azure_endpoint=AZURE_ENDPOINT
            )
            
            self._client = AzureOpenAI(
                api_key=AZURE_API_KEY,
                api_version=AZURE_API_VERSION,
                azure_endpoint=AZURE_ENDPOINT
            )
            
            # Inicializar RAGService com os clientes
            self.rag_service = RAGService(
                embedding_client=self._embedding_client,
                client=self._client,
                llm_model=LLM_MODEL
            )
            
            # Flag para rastrear o status de inicialização
            self.initialized = True
            
            # Inicializar o gerenciador de embeddings e motor de busca para produtos
            self.product_search_available = False
            try:
                if os.path.exists(EMBEDDINGS_PATH) and os.path.exists(PRODUCT_NAMES_PATH):
                    self.embedding_manager = EmbeddingManager(
                        api_key=AZURE_API_KEY,
                        api_version=AZURE_API_VERSION,
                        azure_endpoint=AZURE_ENDPOINT,
                        model=EMBEDDING_MODEL,
                        embeddings_path=EMBEDDINGS_PATH,
                        product_names_path=PRODUCT_NAMES_PATH
                    )
                    self.search_engine = ProductSearchEngine(self.embedding_manager)
                    self.product_search_available = True
                else:
                    print(f"Aviso: Arquivos de embeddings ou nomes de produtos não encontrados. Caminho de embeddings: {EMBEDDINGS_PATH}, Caminho de nomes: {PRODUCT_NAMES_PATH}")
            except Exception as e:
                print(f"Aviso: Não foi possível inicializar o motor de busca de produtos: {e}")
                self.product_search_available = False
                
        except Exception as e:
            print(f"Erro na inicialização do estado: {e}")
            self.initialized = False
            raise
        
    async def get_or_create_state(self, session_id: str) -> Dict[str, Any]:
        """
        Recupera ou cria um novo estado de processamento para a sessão
        """
        if session_id not in processing_cache:
            processing_cache[session_id] = {
                "content": None,
                "content_id": None,
                "municipio": None,
                "number_itens": 0,
                "csv_path": None,
                "embeddings_path": None,
                "completed_steps": []
            }
        return processing_cache[session_id]

# Variável global para o singleton do estado
_state_instance = None

# Função para obter a instância do estado
def get_state():
    global _state_instance
    if _state_instance is None:
        try:
            _state_instance = ProcessingState()
        except Exception as e:
            print(f"Erro ao criar estado: {e}")
            # Recria a instância mesmo em caso de erro para evitar falhas em cascata
            _state_instance = None
            raise HTTPException(status_code=500, detail=f"Erro ao inicializar serviços: {str(e)}")
    return _state_instance

# Rotas da API
@app.post("/api/extractor/process")
async def process_document(
    file: UploadFile = File(...),
    formato: str = Form("generico"),
    debug: bool = Form(False),
    state: ProcessingState = Depends(get_state)
):
    """
    Endpoint principal para processamento de editais.
    Recebe um arquivo PDF, extrai metadados, gera embeddings e processa tabelas.
    """
    try:
        # Verificar se o estado foi inicializado corretamente
        if not state.initialized:
            raise HTTPException(status_code=500, detail="Serviço não inicializado corretamente")
            
        # Gerar ID de sessão
        session_id = str(uuid.uuid4())
        session_state = await state.get_or_create_state(session_id)
        
        # 1. Upload e extração de conteúdo
        content = await state.pdf_uploader.upload_pdf(file)
        session_state["content"] = content
        session_state["completed_steps"].append("pdf_upload")
        
        # 2. Extração de metadados e geração de embeddings
        await state.metadata_extractor._extract_metadata(content)
        session_state["municipio"] = state.metadata_extractor.metadata["municipio"]
        session_state["number_itens"] = state.metadata_extractor.metadata["number_itens"]
        session_state["completed_steps"].append("metadata_extraction")
        
        # Gerar embeddings para RAG
        content_id = await state.rag_service.process_pdf(content, session_state["municipio"])
        session_state["content_id"] = content_id
        session_state["embeddings_path"] = f"{EMBEDDINGS_DIR}/{content_id}.pkl"
        session_state["completed_steps"].append("embeddings_generation")
        
        # 3. Processamento da tabela - salvar conteúdo como JSON temporário
        temp_json_path = f"{DATA_DIR}/{content_id}_content.json"
        with open(temp_json_path, 'w', encoding='utf-8') as f:
            json.dump({"data": {"content": content}}, f, ensure_ascii=False)
        
        # Definir município para o extrator adequado
        municipio = session_state["municipio"]
        
        # Processar o edital
        csv_path = f"{RESULTS_DIR}/{content_id}_extracted.csv"
        
        # Usar process_edital para extração e salvamento da tabela
        try:
            # Tentar usar o extrator específico para o município encontrado nos metadados
            output_file = process_edital(municipio, temp_json_path, "csv", csv_path)
            session_state["csv_path"] = output_file
        except ValueError as e:
            # Se o município não for reconhecido pela factory de extratores
            print(f"Município '{municipio}' não reconhecido: {e}")
            
            # Verificar se o parâmetro formato foi passado como um formato válido
            if formato and formato != "generico":
                try:
                    # Tentar usar o formato especificado pelo usuário
                    output_file = process_edital(formato, temp_json_path, "csv", csv_path)
                    session_state["csv_path"] = output_file
                except Exception as formato_error:
                    print(f"Erro ao usar o formato especificado '{formato}': {formato_error}")
                    raise HTTPException(status_code=500, detail=f"Não foi possível extrair tabelas usando o formato '{formato}'.")
            else:
                # Tentar alguns extratores comuns como fallback
                tried_extractors = []
                for fallback_municipio in ["itumbiara", "padre bernardo", "morrinhos", "frutal"]:
                    tried_extractors.append(fallback_municipio)
                    try:
                        output_file = process_edital(fallback_municipio, temp_json_path, "csv", csv_path)
                        session_state["csv_path"] = output_file
                        print(f"Sucesso usando extrator de '{fallback_municipio}' como fallback.")
                        break
                    except Exception as fallback_error:
                        print(f"Falha ao tentar extrator de '{fallback_municipio}': {fallback_error}")
                        continue
                
                # Se nenhum dos extratores funcionou
                if "csv_path" not in session_state or not session_state["csv_path"]:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Não foi possível extrair tabelas. Município '{municipio}' não reconhecido e nenhum extrator alternativo funcionou. Tentados: {', '.join(tried_extractors)}"
                    )
        except Exception as e:
            # Outro erro que não seja de município não reconhecido
            print(f"Erro ao processar o edital: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao processar o edital: {str(e)}")
        
        session_state["completed_steps"].append("table_extraction")
        
        # 4. Enriquecimento com busca de produtos (opcional - só se disponível)
        enhanced_csv_path = None
        matched_count = 0
        total_descriptions = 0
        
        if state.product_search_available and session_state["csv_path"]:
            try:
                # Carregar o CSV extraído
                df = pd.read_csv(session_state["csv_path"])
                
                # Identificar a coluna de descrição
                description_column = next((col for col in df.columns if "DESCRI" in col.upper()), None)
                
                if description_column:
                    # Processar o DataFrame com o motor de busca
                    enhanced_df = state.search_engine.process_dataframe(
                        df=df,
                        description_column=description_column,
                        threshold=0.5,
                        output_column="Produto_base_db"
                    )
                    
                    # Salvar o resultado enriquecido
                    enhanced_csv_path = f"{RESULTS_DIR}/{content_id}_enhanced.csv"
                    enhanced_df.to_csv(enhanced_csv_path, index=False)
                    
                    # Calcular estatísticas
                    matched_count = (enhanced_df["Produto_base_db"] != "nao_encontrado").sum()
                    total_descriptions = len(enhanced_df)
                    
                    session_state["enhanced_csv_path"] = enhanced_csv_path
                    session_state["completed_steps"].append("product_matching")
            except Exception as e:
                print(f"Erro no enriquecimento com busca de produtos: {e}")
                # Não falhar o processamento se esta etapa falhar
        
        # Limpar arquivos temporários
        if os.path.exists(temp_json_path):
            os.remove(temp_json_path)
        
        # Preparar resposta
        response = {
            "success": True,
            "session_id": session_id,
            "content_id": content_id,
            "municipio": session_state["municipio"],
            "item_count": session_state["number_itens"],
            "output_path": session_state["csv_path"],
            "enhanced_file_path": enhanced_csv_path,
            "matched_count": matched_count,
            "total_descriptions": total_descriptions,
            "completed_steps": session_state["completed_steps"]
        }
        
        # Convert all numpy types before returning
        return convert_numpy_types(response)
    
    except Exception as e:
        print(f"Erro no processamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/chat")
async def chat(
    content_id: str = Form(...),
    query: str = Form(...),
    state: ProcessingState = Depends(get_state)
):
    """
    Endpoint para responder perguntas sobre o edital processado usando RAG
    """
    try:
        # Responder à pergunta usando RAG
        result = await state.rag_service.answer_question(query, content_id)
        return {
            "response": result["response"],
            "query": query,
            "context_count": len(result.get("context_used", [])),
            "similarity_scores": result.get("similarity_scores", [])
        }
    except Exception as e:
        print(f"Erro no processamento da pergunta: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/file")
async def get_file(path: str):
    """
    Endpoint para servir arquivos do sistema de arquivos
    
    Args:
        path: Caminho relativo do arquivo
    
    Returns:
        O conteúdo do arquivo
    """
    try:
        # Verificar se o arquivo existe
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {path}")
        
        # Retornar o arquivo
        return FileResponse(
            path=path,
            filename=os.path.basename(path),
            media_type="text/csv" if path.endswith(".csv") else None
        )
    except Exception as e:
        # Log do erro
        print(f"Erro ao servir arquivo {path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao acessar arquivo: {str(e)}")