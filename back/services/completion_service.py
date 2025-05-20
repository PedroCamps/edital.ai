from typing import List, Tuple, Optional
from pydantic import BaseModel
import faiss
import numpy as np
import pickle
import os
from openai import AzureOpenAI
import pandas as pd

class ProductMatch(BaseModel):
    name: str
    similarity: float

class EmbeddingManager:
    """
    Classe responsável por gerenciar os embeddings e a conexão com o Azure OpenAI
    """
    def __init__(self, 
                 api_key: str, 
                 api_version: str, 
                 azure_endpoint: str,
                 model: str,
                 embeddings_path: str,
                 product_names_path: str):
        # Inicializa o cliente Azure OpenAI
        self.client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=azure_endpoint
        )
        self.model = model
        
        # Carrega os dados
        self.load_data(embeddings_path, product_names_path)
        
    def load_data(self, embeddings_path: str, product_names_path: str) -> None:
        """
        Carrega os embeddings e nomes dos produtos dos arquivos
        """
        try:
            # Carrega embeddings
            with open(embeddings_path, 'rb') as file:
                self.product_embeddings = pickle.load(file)
            
            # Carrega nomes dos produtos
            with open(product_names_path, 'r') as file:
                text = file.read()
            self.product_names = [line for line in text.split('\n') if line.strip()]
            
            print(f"Carregados {len(self.product_names)} produtos e embeddings com formato {self.product_embeddings.shape}")
        except Exception as e:
            print(f"Erro ao carregar dados: {e}")
            raise ValueError(f"Falha ao carregar os dados necessários: {str(e)}")
            
    def get_query_embedding(self, query_text: str) -> Optional[List[float]]:
        """
        Gera embedding para um texto de consulta
        """
        try:
            response = self.client.embeddings.create(
                input=[query_text],
                model=self.model
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Erro ao gerar embedding para consulta: {e}")
            return None


class ProductSearchEngine:
    """
    Classe responsável por realizar buscas de produtos similares
    """
    def __init__(self, embedding_manager: EmbeddingManager):
        self.embedding_manager = embedding_manager
        
    def search_similar_products(self, query_text: str, top_k: int = 5) -> List[ProductMatch]:
        """
        Busca produtos similares à consulta
        """
        # Obtém embedding para a consulta
        query_embedding = self.embedding_manager.get_query_embedding(query_text)
        
        if query_embedding is None:
            raise ValueError("Falha ao gerar embedding para a consulta")
        
        # Converte para array numpy e normaliza
        query_embedding_array = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(query_embedding_array)
        
        # Cria um índice FAISS para busca rápida por similaridade
        dimension = self.embedding_manager.product_embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension)  # Similaridade por Produto Interno
        
        # Adiciona os embeddings de produtos ao índice
        index.add(self.embedding_manager.product_embeddings)
        
        # Busca por produtos similares
        distances, indices = index.search(query_embedding_array, top_k)
        
        # Obtém resultados
        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            similarity = float(distances[0][i])
            if idx < len(self.embedding_manager.product_names):
                results.append(ProductMatch(name=self.embedding_manager.product_names[idx], 
                                             similarity=similarity))
        
        return results
    
    def search(self, query: str, top_k: int = 1) -> Tuple[str, float]:
        """
        Método simplificado para buscar o produto mais similar
        e retornar o nome e a similaridade
        """
        matches = self.search_similar_products(query, top_k)
        if matches:
            return matches[0].name, matches[0].similarity
        return "", 0.0
    
    def process_dataframe(self, df: pd.DataFrame, 
                         description_column: str, 
                         threshold: float = 0.5,
                         output_column: str = "Produto_base_db") -> pd.DataFrame:
        """
        Processa um DataFrame, buscando produtos similares para cada descrição
        e adicionando uma coluna com o nome do produto encontrado
        """
        # Cria uma cópia do DataFrame para não modificar o original
        result_df = df.copy()
        
        # Adiciona a coluna de saída se ela não existir
        if output_column not in result_df.columns:
            result_df[output_column] = ""
        
        # Adiciona coluna para armazenar valores de similaridade
        similarity_column = f"{output_column}_similarity"
        result_df[similarity_column] = 0.0
        
        # Processa cada linha
        for index, row in result_df.iterrows():
            description = row[description_column]
            print(f"Processando: {description}")
            
            try:
                name, similarity = self.search(description)
                
                # Armazenar o valor de similaridade
                result_df.loc[index, similarity_column] = similarity
                
                if similarity > threshold:
                    print(f"Produto encontrado: {name} (similaridade: {similarity:.4f})")
                    result_df.loc[index, output_column] = name
                else:
                    print(f"Produto não encontrado para: {description} (similaridade: {similarity:.4f})")
                    result_df.loc[index, output_column] = "nao_encontrado"
            except Exception as e:
                print(f"Erro ao processar linha {index}: {e}")
                result_df.loc[index, output_column] = "erro"
                
        return result_df

    def process_csv_file(self, 
                         csv_path: str, 
                         description_column: str = "DESCRIÇÃO",
                         threshold: float = 0.5,
                         output_column: str = "Produto_base_db",
                         output_path: Optional[str] = None) -> str:
        """
        Processa um arquivo CSV, buscando produtos similares para cada descrição
        e salvando o resultado em um novo arquivo CSV.
        
        Args:
            csv_path: Caminho para o arquivo CSV de entrada
            description_column: Nome da coluna que contém as descrições
            threshold: Limiar de similaridade para considerar uma correspondência válida
            output_column: Nome da coluna que conterá os produtos encontrados
            output_path: Caminho para salvar o arquivo CSV de saída. Se None, usa o mesmo nome com sufixo "_processado"
            
        Returns:
            Caminho do arquivo CSV de saída
        """
        try:
            # Carrega o CSV
            df = pd.read_csv(csv_path)
            
            # Verifica se a coluna existe
            if description_column not in df.columns:
                raise ValueError(f"Coluna '{description_column}' não encontrada no arquivo CSV")
            
            # Processa o DataFrame
            result_df = self.process_dataframe(
                df=df,
                description_column=description_column,
                threshold=threshold,
                output_column=output_column
            )
            
            # Define o caminho de saída se não for especificado
            if output_path is None:
                base_name = os.path.splitext(csv_path)[0]
                output_path = f"{base_name}_processado.csv"
            
            # Salva o resultado
            result_df.to_csv(output_path, index=False)
            print(f"Processamento concluído. Resultado salvo em '{output_path}'")
            
            return output_path
        except Exception as e:
            print(f"Erro ao processar o arquivo CSV: {e}")
            raise

