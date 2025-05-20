FROM python:3.10-slim

WORKDIR /app

# Instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Criar diretórios necessários
RUN mkdir -p data embeddings results

# Copiar o código da aplicação
COPY . .

# Definir variáveis de ambiente padrão (caso o .env não seja fornecido)
ENV AZURE_API_KEY=""
ENV AZURE_ENDPOINT=""
ENV AZURE_API_VERSION=""
ENV EMBEDDING_MODEL=""
ENV LLM_MODEL=""
ENV DATA_DIR="data"
ENV EMBEDDINGS_DIR="embeddings"
ENV RESULTS_DIR="results"

EXPOSE 7070

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7070", "--reload"]
