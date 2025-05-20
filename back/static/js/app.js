// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const processButton = document.getElementById('processButton');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const totalFilesEl = document.getElementById('totalFiles');
const tablesExtractedEl = document.getElementById('tablesExtracted');
const processingTimeEl = document.getElementById('processingTime');
const successRateEl = document.getElementById('successRate');
const resultsTable = document.getElementById('resultsTable');

// Step elements
const step1Icon = document.getElementById('step1Icon');
const step1Status = document.getElementById('step1Status');
const step2Icon = document.getElementById('step2Icon');
const step2Status = document.getElementById('step2Status');
const step3Icon = document.getElementById('step3Icon');
const step3Status = document.getElementById('step3Status');
const step4Icon = document.getElementById('step4Icon');
const step4Status = document.getElementById('step4Status');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Global data store
const state = {
    files: [],
    processingStartTime: null,
    processingEndTime: null,
    currentStep: 0,
    tablesExtracted: 0,
    conversationHistory: [],
    processingResults: []
};

// Initialize event listeners
function init() {
    console.log('Initializing app...');
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    processButton.addEventListener('click', startProcessing);
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => {
                if (content.id === `${tabName}Tab`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
    
    console.log('App initialized');
}

// File handling functions
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
    uploadArea.style.backgroundColor = '#f8fafc';
}

function handleDragLeave() {
    uploadArea.style.borderColor = '#cbd5e1';
    uploadArea.style.backgroundColor = '';
}

function handleDrop(e) {
    e.preventDefault();
    console.log('Files dropped');
    uploadArea.style.borderColor = '#cbd5e1';
    uploadArea.style.backgroundColor = '';
    
    if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
    }
}

function handleFileSelect(e) {
    console.log('Files selected');
    if (e.target.files) {
        handleFiles(e.target.files);
    }
}

function handleFiles(filesList) {
    console.log('Processing files:', filesList);
    const pdfFiles = Array.from(filesList).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
        alert('Por favor, selecione apenas arquivos PDF.');
        return;
    }
    
    // Add files to state
    pdfFiles.forEach(file => {
        if (!state.files.some(f => f.name === file.name)) {
            state.files.push({
                file: file,
                name: file.name,
                status: 'waiting',
                tables: 0,
                processingTime: 0
            });
            console.log('Added file:', file.name);
        }
    });
    
    updateFileList();
    updateProcessButton();
}

function updateFileList() {
    fileList.innerHTML = '';
    
    if (state.files.length === 0) {
        fileList.innerHTML = '<p style="text-align: center; color: var(--secondary); padding: 1rem;">Nenhum arquivo selecionado</p>';
        return;
    }
    
    state.files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        const fileStatus = document.createElement('div');
        fileStatus.className = `file-status status-${file.status}`;
        
        switch (file.status) {
            case 'waiting':
                fileStatus.textContent = 'Aguardando';
                break;
            case 'processing':
                fileStatus.textContent = 'Processando';
                break;
            case 'completed':
                fileStatus.textContent = 'Concluído';
                break;
            case 'error':
                fileStatus.textContent = 'Erro';
                break;
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = 'btn';
        removeButton.innerHTML = '&times;';
        removeButton.style.marginLeft = '0.5rem';
        removeButton.addEventListener('click', () => {
            state.files.splice(index, 1);
            updateFileList();
            updateProcessButton();
        });
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(fileStatus);
        fileItem.appendChild(removeButton);
        
        fileList.appendChild(fileItem);
    });
}

function updateProcessButton() {
    processButton.disabled = state.files.length === 0;
}

// Processing functions
function startProcessing() {
    console.log('Starting processing...');
    if (state.files.length === 0) return;
    
    state.processingStartTime = new Date();
    state.currentStep = 1;
    updateStepStatus(1, 'current', 'Em andamento...');
    
    // Disable process button during processing
    processButton.disabled = true;
    
    // Update file statuses
    state.files.forEach(file => {
        file.status = 'processing';
    });
    updateFileList();
    
    // Process files one by one
    processNextFile(0);

    // Adiciona temporizador para forçar processamento RAG se necessário
    console.log("Adicionando temporizador para forçar processamento RAG em 10 segundos");
    setTimeout(() => {
        // Verifica se ainda não começou o processamento RAG (etapa 3)
        if (state.currentStep < 3) {
            console.log("Acionando processamento RAG forçado");
            processRAG();
        }
    }, 10000);
}

// Function to process files sequentially
// Substitua a função processNextFile no seu código JavaScript (paste-3.txt)

function processNextFile(index) {
    console.log(`Processing file ${index + 1} of ${state.files.length}`);
    
    if (index >= state.files.length) {
        // Todos os arquivos processados
        console.log('All files processed, moving to RAG processing');
        processRAG();
        return;
    }
    
    const file = state.files[index];
    
    // Se for o primeiro arquivo, atualizar status para extração de tabelas
    if (index === 0) {
        updateStepStatus(1, 'completed', 'Concluído');
        updateStepStatus(2, 'current', 'Extraindo tabelas...');
        state.currentStep = 2;
    }
    
    // Criar FormData e anexar arquivo
    const formData = new FormData();
    formData.append('file', file.file);
    formData.append('formato', 'generico'); // Pode ser configurável
    formData.append('debug', 'false');
    
    console.log('Sending request to API...');
    
    // Enviar requisição à API
    fetch('/api/extractor/process', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log('Response received:', response);
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('File processed:', data);
        
        // Atualizar status do arquivo
        file.status = data.success ? 'completed' : 'error';
        file.tables = data.item_count || 0;
        file.processingTime = ((new Date() - state.processingStartTime) / 1000).toFixed(1);
        file.outputPath = data.output_path;
        
        // Atualizar contagem total de tabelas extraídas
        state.tablesExtracted += file.tables;
        
        // Atualizar UI
        updateFileList();
        updateDashboard();
        
        // Se o arquivo foi processado com sucesso, processá-lo com RAG
        if (file.status === 'completed') {
            processPDFWithRAG(index);
        }
        
        // Processar próximo arquivo
        setTimeout(() => {
            processNextFile(index + 1);
        }, 500);
    })
    .catch(error => {
        console.error('Error processing file:', error);
        
        // Marcar arquivo como erro
        file.status = 'error';
        file.processingError = error.message;
        updateFileList();
        
        // Mostrar erro ao usuário
        alert(`Erro ao processar arquivo ${file.name}: ${error.message}`);
        
        // Processar próximo arquivo
        setTimeout(() => {
            processNextFile(index + 1);
        }, 500);
    });
}

function processRAG() {
    // Verificar se já estamos processando RAG (etapa 3)
    if (state.currentStep >= 3) {
        console.log('RAG processing already in progress, skipping');
        return;
    }
    
    state.currentStep = 3;
    console.log('Starting RAG processing...');
    updateStepStatus(2, 'completed', 'Concluído');
    updateStepStatus(3, 'current', 'Processando RAG...');
    
    // Get completed files with output paths
    const completedFiles = state.files.filter(file => file.status === 'completed');
    console.log('Completed files for RAG:', completedFiles.length);
    
    if (completedFiles.length === 0) {
        // No successful extractions, skip RAG
        console.log("No completed files found, skipping to completion");
        completeProcessing();
        return;
    }
    
    // Simulate RAG processing if there are no output paths
    const filesWithPaths = completedFiles.filter(file => file.outputPath);
    if (filesWithPaths.length === 0) {
        console.log("No output paths found, simulating RAG processing");
        setTimeout(() => {
            completeProcessing();
        }, 3000);
        return;
    }
    
    // Process each extracted CSV with the completion service
    let processedCount = 0;
    
    filesWithPaths.forEach(file => {
        console.log('Processing RAG for file:', file.name, 'Path:', file.outputPath);
        
        // Call the completion service API
        fetch('/api/completion/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'file_path': file.outputPath,
                'description_column': 'DESCRIÇÃO',
                'similarity_threshold': '0.5'
            })
        })
        .then(response => {
            console.log('RAG response received:', response);
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('RAG processing completed:', data);
            
            // Update file with enhanced path
            file.enhancedPath = data.enhanced_file_path;
            file.matchedCount = data.matched_count;
            file.totalDescriptions = data.total_descriptions;
            
            // Increment processed count
            processedCount++;
            
            // Check if all files are processed
            if (processedCount === filesWithPaths.length) {
                // Move to final step
                completeProcessing();
            }
        })
        .catch(error => {
            console.error('Error in RAG processing:', error);
            
            // Increment processed count even on error
            processedCount++;
            
            // Alert user
            alert(`Erro no processamento RAG para ${file.name}: ${error.message}`);
            
            // Check if all files are processed
            if (processedCount === filesWithPaths.length) {
                // Move to final step
                completeProcessing();
            }
        });
    });
}

function completeProcessing() {
    if (state.currentStep >= 4) {
        console.log('Processing already completed, skipping');
        return;
    }
    
    state.currentStep = 4;
    console.log('Completing processing...');
    updateStepStatus(3, 'completed', 'Concluído');
    updateStepStatus(4, 'current', 'Finalizando...');
    
    // Update file list
    updateFileList();
    
    // Generate processing results
    generateResults();
    
    // Record end time
    state.processingEndTime = new Date();
    const processingTime = (state.processingEndTime - state.processingStartTime) / 1000;
    processingTimeEl.textContent = `${processingTime.toFixed(1)}s`;
    
    // Update success rate
    const successfulFiles = state.files.filter(file => file.status === 'completed').length;
    const successRate = (successfulFiles / state.files.length) * 100;
    successRateEl.textContent = `${successRate.toFixed(0)}%`;
    
    // Enable chat
    chatInput.disabled = false;
    sendButton.disabled = false;
    
    // Finalize
    setTimeout(() => {
        updateStepStatus(4, 'completed', 'Concluído');
        processButton.disabled = false;
        
        // Enviar o prompt base automaticamente
        sendInitialPrompt();
    }, 1000);
    
    console.log('Processing completed');
}

function sendInitialPrompt() {
    // Verificar se há arquivos processados com sucesso
    const successfulFiles = state.files.filter(file => file.status === 'completed');
    if (successfulFiles.length === 0) {
        addMessage('system', 'Nenhum arquivo foi processado com sucesso para análise.');
        return;
    }
    
    // Obter o ID do conteúdo do primeiro arquivo processado com sucesso
    const contentId = successfulFiles[0].name;
    
    // Prompt base para análise do documento
    const basePrompt = PROMPT_BASE || `Analise o documento e extraia as seguintes informações:
- Validade da proposta
- Prazo de entrega
- Cidade
- Estado
- Horário de abertura da licitação
- Número de casas decimais para proposta
- Documentações necessárias para habilitação
- Objeto da licitação
- Modalidade da licitação
- Valor estimado para a contratação
- Critérios de julgamento
- Condições de pagamento
- Garantias exigidas
- Requisitos técnicos e qualificação
- Cronograma do processo
- Penalidades e sanções
- Critérios adicionais para habilitação
- Critérios para desclassificação`;
    
    // Adicionar mensagem informativa
    addMessage('system', 'Analisando os documentos processados...');
    
    // Adicionar indicador de digitação
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message system';
    typingIndicator.textContent = 'Analisando...';
    chatMessages.appendChild(typingIndicator);
    
    // Preparar dados do formulário para consulta inicial
    const formData = new FormData();
    formData.append('content_id', contentId);
    formData.append('query', basePrompt);
    
    console.log('Enviando prompt base para análise com content_id:', contentId);
    
    // Enviar requisição à API
    fetch('/api/chat', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Resposta da rede não foi ok: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('Resposta da análise inicial recebida:', data);
        
        // Remover indicador de digitação
        chatMessages.removeChild(typingIndicator);
        
        // Obter a resposta do assistente
        const responseText = data.response || "Não foi possível analisar o documento.";
        
        // Adicionar mensagem do assistente
        addMessage('system', responseText);
        
        // Adicionar ao histórico de conversação
        state.conversationHistory.push({
            role: 'assistant',
            content: responseText
        });
    })
    .catch(error => {
        console.error('Erro ao processar análise inicial:', error);
        
        // Remover indicador de digitação
        chatMessages.removeChild(typingIndicator);
        
        // Adicionar mensagem de erro
        addMessage('system', 'Erro ao processar análise inicial: ' + error.message);
    });
}

// Definir o PROMPT_BASE como uma variável global
const PROMPT_BASE = `Validade da proposta
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
Critérios para desclassificação ou penalização de propostas`;

function updateStepStatus(step, status, message) {
    const iconEl = document.getElementById(`step${step}Icon`);
    const statusEl = document.getElementById(`step${step}Status`);
    
    // Reset all classes
    iconEl.className = 'step-icon';
    
    if (status === 'completed') {
        iconEl.className = 'step-icon completed';
        iconEl.innerHTML = '✓';
    } else if (status === 'current') {
        iconEl.className = 'step-icon current';
    }
    
    statusEl.textContent = message;
}

function updateDashboard() {
    totalFilesEl.textContent = state.files.length;
    tablesExtractedEl.textContent = state.tablesExtracted;
}

function generateResults() {
    state.processingResults = state.files.map(file => {
        return {
            fileName: file.name,
            tables: file.tables,
            status: file.status,
            processingTime: file.processingTime,
            outputPath: file.outputPath,
            enhancedPath: file.enhancedPath,
            matchedCount: file.matchedCount,
            totalDescriptions: file.totalDescriptions
        };
    });
    
    updateResultsTable();
}

function updateResultsTable() {
    resultsTable.innerHTML = '';
    
    state.processingResults.forEach(result => {
        const row = document.createElement('tr');
        
        const fileCell = document.createElement('td');
        fileCell.textContent = result.fileName;
        
        const tablesCell = document.createElement('td');
        tablesCell.textContent = result.tables;
        
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `file-status status-${result.status}`;
        statusBadge.textContent = result.status === 'completed' ? 'Concluído' : 'Erro';
        statusCell.appendChild(statusBadge);
        
        const timeCell = document.createElement('td');
        timeCell.textContent = `${result.processingTime}s`;
        
        const actionsCell = document.createElement('td');
        
        // View extracted data button
        if (result.status === 'completed' && result.outputPath) {
            const viewButton = document.createElement('a');
            viewButton.className = 'btn btn-primary';
            viewButton.textContent = 'Ver Extração';
            viewButton.style.padding = '0.25rem 0.5rem';
            viewButton.style.fontSize = '0.875rem';
            viewButton.style.marginRight = '0.5rem';
            viewButton.href = `/download?path=${encodeURIComponent(result.outputPath)}`;
            viewButton.target = '_blank';
            actionsCell.appendChild(viewButton);
        }
        
        // View enhanced data button
        if (result.status === 'completed' && result.enhancedPath) {
            const enhancedButton = document.createElement('a');
            enhancedButton.className = 'btn btn-primary';
            enhancedButton.textContent = 'Ver Processado';
            enhancedButton.style.padding = '0.25rem 0.5rem';
            enhancedButton.style.fontSize = '0.875rem';
            enhancedButton.href = `/download?path=${encodeURIComponent(result.enhancedPath)}`;
            enhancedButton.target = '_blank';
            actionsCell.appendChild(enhancedButton);
        }
        
        row.appendChild(fileCell);
        row.appendChild(tablesCell);
        row.appendChild(statusCell);
        row.appendChild(timeCell);
        row.appendChild(actionsCell);
        
        resultsTable.appendChild(row);
    });
}

// Chat functions
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage('user', message);
    
    // Clear input
    chatInput.value = '';
    
    // Add to conversation history
    state.conversationHistory.push({
        role: 'user',
        content: message
    });
    
    // Simulate response
    sendMessageToBackend(message);
}

function addMessage(type, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = content;
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessageToBackend(message) {
    // Desabilita input enquanto espera a resposta
    chatInput.disabled = true;
    sendButton.disabled = true;
    
    // Adiciona indicador de digitação
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message system';
    typingIndicator.textContent = 'Digitando...';
    chatMessages.appendChild(typingIndicator);
    
    // Obtém o ID do conteúdo do primeiro arquivo processado com sucesso
    const contentId = state.files.find(f => f.status === 'completed')?.name || 'default_content_id';
    
    // Prepara os dados do formulário
    const formData = new FormData();
    formData.append('content_id', contentId);
    formData.append('query', message);
    
    console.log('Enviando mensagem para o backend:', message, 'com content_id:', contentId);
    
    // Envia requisição à API
    fetch('/api/chat', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Resposta da rede não foi ok: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('Resposta recebida:', data);
        
        // Remove indicador de digitação
        chatMessages.removeChild(typingIndicator);
        
        // Obtém a resposta do assistente
        const responseText = data.response || "Não foi possível obter uma resposta.";
        
        // Adiciona mensagem do assistente
        addMessage('system', responseText);
        
        // Adiciona ao histórico de conversação
        state.conversationHistory.push({
            role: 'assistant',
            content: responseText
        });
        
        // Reabilita input
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
    })
    .catch(error => {
        console.error('Erro ao processar mensagem:', error);
        
        // Remove indicador de digitação
        chatMessages.removeChild(typingIndicator);
        
        // Adiciona mensagem de erro
        addMessage('system', 'Erro ao processar a mensagem: ' + error.message);
        
        // Reabilita input
        chatInput.disabled = false;
        sendButton.disabled = false;
    });
}

    
    // Simulate thinking time
    setTimeout(() => {
        // Remove typing indicator
        chatMessages.removeChild(typingIndicator);
        
        // Add assistant message
        addMessage('system', responseText);
        
        // Add to conversation history
        state.conversationHistory.push({
            role: 'assistant',
            content: responseText
        });
        
        // Re-enable input
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
    }, 1500);

    function processPDFWithRAG(fileIndex) {
        const file = state.files[fileIndex];
        if (!file || file.status !== 'completed') {
            console.log('Arquivo não disponível ou não processado com sucesso:', fileIndex);
            return;
        }
        
        console.log('Processando arquivo com RAG:', file.name);
        
        // Criar FormData com o arquivo para upload
        const formData = new FormData();
        formData.append('file', file.file);
        
        // Enviar arquivo para processamento RAG
        fetch('/api/rag/process', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Resposta da rede não foi ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Arquivo processado pelo RAG:', data);
            
            // Atualizar status do arquivo
            file.ragStatus = 'completed';
            file.contentId = data.content_id;
            
            // Atualizar UI
            updateFileList();
        })
        .catch(error => {
            console.error('Erro ao processar arquivo com RAG:', error);
            
            // Marcar como erro
            file.ragStatus = 'error';
            file.ragError = error.message;
            updateFileList();
        });
    }

// Initialize the app
document.addEventListener('DOMContentLoaded', init);