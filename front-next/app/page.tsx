"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";
import { useAppState, FileInfo } from "./hooks/useAppState";
import FileUpload from "./components/FileUpload";
import ProcessingStatus from "./components/ProcessingStatus";
import ChatInterface from "./components/ChatInterface";
import Dashboard from "./components/Dashboard";
import ResultsTable from "./components/ResultsTable";
import TabelaExtraida from "./components/TabelaExtraida";
import * as apiService from "./services/apiService";

export default function Home() {
  const [selectedTab, setSelectedTab] = useState(0);
  const {
    state,
    addFiles,
    updateFileStatus,
    addMessage,
    startProcessing,
    updateStep,
    completeProcessing,
    incrementTablesExtracted
  } = useAppState();
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle file selection
  const handleFilesSelected = useCallback((files: FileInfo[]) => {
    addFiles(files);
  }, [addFiles]);

  // Start processing files
  const handleProcessFiles = async () => {
    if (state.files.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    startProcessing(); // Define currentStep = 1 (Upload)
    
    // Avançar para a etapa de extração
    updateStep(2); // Extração de Tabelas
    
    // Process each file
    for (let i = 0; i < state.files.length; i++) {
      const file = state.files[i];
      
      try {
        // Process file using unified endpoint
        const result = await apiService.processFile(file.file);
        
        if (result.success) {
          // Extract all data from the unified response
          const {
            session_id,
            content_id,
            municipio,
            item_count,
            output_path,
            enhanced_file_path,
            matched_count,
            total_descriptions,
            completed_steps = []
          } = result;
          
          // Update file with complete results from API unificada
          updateFileStatus(file.name, {
            status: 'completed',
            tables: item_count || 0,
            processingTime: ((new Date().getTime() - (state.processingStartTime?.getTime() || 0)) / 1000),
            outputPath: output_path,
            enhancedPath: enhanced_file_path,
            matchedCount: matched_count,
            totalDescriptions: total_descriptions,
            contentId: content_id, // Importante para chat
            // Set RAG status based on completed steps
            ragStatus: completed_steps.includes('product_matching') ? 'completed' : 'waiting'
          });
          
          // Update total tables extracted
          if (item_count) {
            incrementTablesExtracted(item_count);
          }
          
        } else {
          // Update file with error status
          updateFileStatus(file.name, {
            status: 'error',
            processingError: result.error
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        updateFileStatus(file.name, {
          status: 'error',
          processingError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Indicar que estamos na etapa de processamento RAG
    updateStep(3); // Processamento RAG
    
    // Complete processing
    completeProcessing(); // Define currentStep = 4 (Análise Completa)
    setIsProcessing(false);
    
    // Send initial prompt after processing is complete with a small delay
    console.log("Agendando envio do prompt inicial após delay...");
    setTimeout(() => {
      console.log("Executando sendInitialPrompt após delay");
      sendInitialPrompt();
    }, 1500); // Delay de 1,5 segundos para garantir que os estados foram atualizados
  };

  // Send initial prompt analysis with debug logs
  const sendInitialPrompt = async () => {
    console.log("Tentando enviar prompt inicial...");
    console.log("Estado atual:", { isProcessing, currentStep: state.currentStep });
    
    // Verificar se o processamento foi concluído
    if (state.currentStep === 4) { // Removi a verificação !isProcessing para garantir
      console.log("Condição atendida para enviar prompt");
      
      // Get first successful file for content ID
      const successfulFile = state.files.find(file => file.status === 'completed' && file.contentId);
      console.log("Arquivo processado:", successfulFile);
      
      if (!successfulFile || !successfulFile.contentId) {
        console.error("Nenhum arquivo processado com contentId encontrado");
        addMessage('system', 'Nenhum arquivo foi processado com sucesso para análise.');
        return;
      }
      
      // Add processing message
      addMessage('system', 'Iniciando análise detalhada do edital...');
      
      try {
        // Avisar o usuário sobre o início do processamento
        addMessage('assistant', 'Vou analisar o edital em detalhes, extraindo as informações mais importantes. Este processo pode levar alguns minutos. As informações serão organizadas por categorias para facilitar a compreensão.');
        
        // Para cada grupo de perguntas
        for (const [groupName, questions] of Object.entries(apiService.PROMPT_QUESTIONS)) {
          console.log(`Processando grupo: ${groupName}`);
          // Adicionar cabeçalho do grupo
          addMessage('assistant', `## ${groupName}`);
          
          // Para cada pergunta no grupo
          for (const question of questions) {
            console.log(`Enviando pergunta: ${question}`);
            // Adicionar a pergunta
            addMessage('user', question);
            
            try {
              // Enviar pergunta e obter resposta
              const result = await apiService.sendChatMessage(
                successfulFile.contentId,
                question
              );
              
              console.log(`Resposta recebida para: ${question}`);
              
              // Adicionar resposta
              const response = typeof result.response === 'string' 
                ? result.response 
                : JSON.stringify(result.response);
                
              addMessage('assistant', response);
              
              // Pequena pausa para não sobrecarregar a interface
              await new Promise(resolve => setTimeout(resolve, 800)); // Aumentei para 800ms
            } catch (error) {
              console.error(`Erro ao processar pergunta: ${question}`, error);
              addMessage('system', `Não foi possível obter resposta para: ${question}`);
            }
          }
        }
        
        // Mensagem de conclusão
        addMessage('assistant', 'Análise do edital concluída. Você pode fazer perguntas adicionais sobre o documento.');
        console.log("Análise do edital concluída com sucesso");
      } catch (error) {
        console.error('Erro na análise inicial:', error);
        addMessage('system', `Erro na análise do edital: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    } else {
      console.log("Condição para enviar prompt NÃO atendida");
    }
  };

  // Handle sending chat messages
  const handleSendMessage = async (message: string) => {
    // Add user message to UI
    addMessage('user', message);
    
    // Get first successful file for content ID
    const successfulFile = state.files.find(file => file.status === 'completed' && file.contentId);
    
    if (!successfulFile || !successfulFile.contentId) {
      addMessage('system', 'Não há um documento processado para consulta.');
      return;
    }
    
    try {
      // Send message to backend
      const result = await apiService.sendChatMessage(successfulFile.contentId, message);
      
      // Ensure the response is a string
      const response = typeof result.response === 'string' 
        ? result.response 
        : JSON.stringify(result.response);
      
      // Add response with metadata if available
      if (result.context_count || (result.similarity_scores && result.similarity_scores.length > 0)) {
        addMessage('assistant', response, {
          contextCount: result.context_count,
          similarityScores: result.similarity_scores
        });
      } else {
        addMessage('assistant', response);
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      addMessage('system', `Erro ao processar a mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Handle tab change
  const handleTabChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tabId = e.target.id;
    
    switch (tabId) {
      case 'chat':
        setSelectedTab(0);
        break;
      case 'dashboard':
        setSelectedTab(1);
        break;
      case 'tabela':
        setSelectedTab(2);
        break;
      case 'results':
        setSelectedTab(3);
        break;
    }
  };

  return (
    <div>
      <main>
        <header>
          <div className={styles.container}>
            <div className={styles.logo}>
              Processamento de Editais
            </div>
          </div>
        </header>

        <div className={styles.container}>
          {/* File Upload Component */}
          <FileUpload 
            onFilesSelected={handleFilesSelected} 
            onProcessFiles={handleProcessFiles}
            isProcessing={isProcessing}
          />

          {/* Processing Status Component */}
          <ProcessingStatus 
            currentStep={state.currentStep} 
            processingCompleted={!isProcessing && state.currentStep === 4} 
          />

          {/* Tabs */}
          <form className={styles.tabs}>
            <input
              type="radio"
              name="tab"
              id="chat"
              defaultChecked
              onChange={handleTabChange}
            />
            <label htmlFor="chat" className={styles.tab}>
              Chat Assistente
            </label>
            <input
              type="radio"
              name="tab"
              id="dashboard"
              onChange={handleTabChange}
            />
            <label htmlFor="dashboard" className={styles.tab}>
              Dashboard
            </label>
            <input
              type="radio"
              name="tab"
              id="tabela"
              onChange={handleTabChange}
            />
            <label htmlFor="tabela" className={styles.tab}>
              Tabela
            </label>
            <input
              type="radio"
              name="tab"
              id="results"
              onChange={handleTabChange}
            />
            <label htmlFor="results" className={styles.tab}>
              Resultados Detalhados
            </label>
          </form>

          {/* Tab Content */}
          <div className={`${styles.tabContent} ${selectedTab === 0 ? styles.active : ''}`}>
            <ChatInterface
              messages={state.conversationHistory}
              onSendMessage={handleSendMessage}
              isProcessingComplete={state.currentStep >= 4}
            />
          </div>

          <div className={`${styles.tabContent} ${selectedTab === 1 ? styles.active : ''}`}>
            <Dashboard
              totalFiles={state.files.length}
              tablesExtracted={state.tablesExtracted}
              processingTime={
                state.processingEndTime && state.processingStartTime
                  ? ((state.processingEndTime.getTime() - state.processingStartTime.getTime()) / 1000).toFixed(1)
                  : "0"
              }
              successRate={
                state.files.length > 0
                  ? ((state.files.filter(f => f.status === 'completed').length / state.files.length) * 100).toFixed(0)
                  : "0"
              }
              matchedRate={
                state.files.reduce((total, file) => total + (file.totalDescriptions || 0), 0) > 0
                  ? ((state.files.reduce((total, file) => total + (file.matchedCount || 0), 0) / 
                     state.files.reduce((total, file) => total + (file.totalDescriptions || 0), 0)) * 100).toFixed(1)
                  : "0"
              }
            />
          </div>

          <div className={`${styles.tabContent} ${selectedTab === 2 ? styles.active : ''}`}>
            <TabelaExtraida 
              filesProcessed={state.files.some(f => f.status === 'completed')}
              processedFilePath={state.files.find(f => f.status === 'completed')?.outputPath}
              enhancedFilePath={state.files.find(f => f.status === 'completed')?.enhancedPath}
            />
          </div>

          <div className={`${styles.tabContent} ${selectedTab === 3 ? styles.active : ''}`}>
            <ResultsTable results={state.processingResults} />
          </div>
        </div>
      </main>
    </div>
  );
}