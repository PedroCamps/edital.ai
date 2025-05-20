// API service for handling backend communication

// Base URL for API requests - configurado para funcionar no Docker e localmente
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:7070'  // Ambiente de desenvolvimento local
  : 'http://backend:7070';    // Ambiente Docker

interface ProcessingResponse {
  success: boolean;
  session_id?: string;
  content_id?: string;
  municipio?: string;
  item_count?: number;
  output_path?: string;
  enhanced_file_path?: string;
  matched_count?: number;
  total_descriptions?: number;
  completed_steps?: string[];
  error?: string;
}

interface ChatResponse {
  response: string;
  query?: string;
  context_count?: number;
  similarity_scores?: number[];
}

// Process a PDF file for table extraction and RAG
export async function processFile(file: File): Promise<ProcessingResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('formato', 'generico');
    formData.append('debug', 'false');
    
    const response = await fetch(`${API_BASE_URL}/api/extractor/process`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error processing file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Backward compatibility for legacy code
export async function processRAG(file: File): Promise<ProcessingResponse> {
  try {
    // This is now handled in the unified /api/extractor/process endpoint
    // This method is kept for backward compatibility
    console.warn('processRAG is deprecated - using unified endpoint instead');
    return await processFile(file);
  } catch (error) {
    console.error('Error processing RAG:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Process PDF tables with the completion service
export async function processCompletion(
  filePath: string, 
  descriptionColumn: string = 'DESCRIÇÃO', 
  similarityThreshold: string = '0.5'
): Promise<any> {
  try {
    const params = new URLSearchParams({
      file_path: filePath,
      description_column: descriptionColumn,
      similarity_threshold: similarityThreshold
    });
    
    const response = await fetch(`${API_BASE_URL}/api/completion/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });
    
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in completion process:', error);
    throw error;
  }
}

// Send a chat message to the backend
export async function sendChatMessage(contentId: string, query: string): Promise<ChatResponse> {
  try {
    const formData = new FormData();
    formData.append('content_id', contentId);
    formData.append('query', query);
    
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending chat message:', error);
    return {
      response: `Erro ao processar a mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

// Helper function to download a file
export async function downloadFile(path: string, filename: string): Promise<void> {
  try {
    // If path is relative, prepend the API base URL
    const fullPath = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    
    const link = document.createElement('a');
    link.href = fullPath;
    link.download = filename || path.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Base prompt para análise inicial do documento, organizado em grupos
// Lista de perguntas organizadas em grupos
export const PROMPT_QUESTIONS = {
  "Informações Básicas": [
    "Qual é o objeto da licitação (escopo ou finalidade da contratação)?",
    "Qual é a modalidade da licitação (concorrência, tomada de preços, convite etc.)?",
    "Qual é o valor estimado para a contratação?",
    "Em qual cidade será realizada a licitação?",
    "Em qual estado será realizada a licitação?"
  ],
  "Datas e Prazos": [
    "Qual é o prazo de entrega?",
    "Qual é o horário de abertura da licitação?",
    "Qual é o prazo de validade da proposta?",
    "Qual é o cronograma do processo (prazos para submissão de propostas, impugnações, recursos e execução)?"
  ],
  "Requisitos e Documentação": [
    "Quais são as documentações necessárias para habilitação?",
    "Quais são os critérios adicionais para habilitação (regularidade fiscal, qualificação jurídica, comprovação de capacidade técnica, etc.)?",
    "Quais são os requisitos técnicos e de qualificação (experiência mínima, comprovação de capacidade, etc.)?",
    "Quais são as garantias exigidas (garantia de proposta, garantia contratual, etc.)?"
  ],
  "Critérios e Condições": [
    "Quais são os critérios de julgamento (menor preço, técnica e preço, melhor técnica etc.)?",
    "Qual é o número de casas decimais para proposta?",
    "Quais são as condições de pagamento?",
    "Quais são os critérios para desclassificação ou penalização de propostas?",
    "Quais são as penalidades e sanções em caso de descumprimento contratual?"
  ]
};

// Função para enviar perguntas sequencialmente
export async function sendSequentialQuestions(contentId: string): Promise<void> {
  // Primeiro, informar o usuário que a análise iniciou
  const initMessage = "Iniciando análise detalhada do edital. Processando cada seção...";
  return new Promise(async (resolve, reject) => {
    try {
      // Processar cada grupo
      for (const [groupName, questions] of Object.entries(PROMPT_QUESTIONS)) {
        // Anunciar o início do grupo
        await sendChatMessage(contentId, `Analisando: ${groupName}`);
        
        // Processar cada pergunta do grupo
        for (const question of questions) {
          await new Promise(r => setTimeout(r, 1000)); // Pequena pausa entre perguntas
          await sendChatMessage(contentId, question);
        }
      }
      
      // Informar que a análise foi concluída
      await sendChatMessage(contentId, "Análise do edital concluída. Você pode fazer perguntas específicas sobre o documento agora.");
      
      resolve();
    } catch (error) {
      console.error("Erro ao processar perguntas sequenciais:", error);
      reject(error);
    }
  });
}