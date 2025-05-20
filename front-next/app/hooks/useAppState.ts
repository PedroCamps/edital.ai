import { useState, useEffect } from 'react';

export interface FileInfo {
  file: File;
  name: string;
  status: 'waiting' | 'processing' | 'completed' | 'error';
  tables?: number;
  processingTime?: number;
  outputPath?: string;
  enhancedPath?: string;
  matchedCount?: number;
  totalDescriptions?: number;
  processingError?: string;
  ragStatus?: 'waiting' | 'processing' | 'completed' | 'error';
  ragError?: string;
  contentId?: string;
}

export interface ProcessingResult {
  fileName: string;
  tables: number;
  status: string;
  processingTime: number | string;
  outputPath?: string;
  enhancedPath?: string;
  matchedCount?: number;
  totalDescriptions?: number;
}

export interface Message {
  role: 'user' | 'system' | 'assistant';
  content: string;
  isError?: boolean;
  metadata?: {
    contextCount?: number;
    similarityScores?: number[];
  };
}

export interface AppState {
  files: FileInfo[];
  processingStartTime: Date | null;
  processingEndTime: Date | null;
  currentStep: number;
  tablesExtracted: number;
  conversationHistory: Message[];
  processingResults: ProcessingResult[];
}

const initialState: AppState = {
  files: [],
  processingStartTime: null,
  processingEndTime: null,
  currentStep: 0,
  tablesExtracted: 0,
  conversationHistory: [],
  processingResults: []
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = (newState: Partial<AppState>) => {
    setState(prevState => ({ ...prevState, ...newState }));
  };

  const addFiles = (newFiles: FileInfo[]) => {
    // Verificar se os arquivos são diferentes dos atuais
    // para evitar atualizações desnecessárias
    setState(prevState => {
      // Verificar se não há nada a atualizar
      if (prevState.files.length === newFiles.length && 
          prevState.files.every((file, i) => file.name === newFiles[i].name)) {
        return prevState; // Nenhuma alteração necessária
      }
      
      return {
        ...prevState,
        files: newFiles
      };
    });
  };

  const updateFileStatus = (fileName: string, updates: Partial<FileInfo>) => {
    setState(prevState => ({
      ...prevState,
      files: prevState.files.map(file => 
        file.name === fileName ? { ...file, ...updates } : file
      )
    }));
  };

  // CORREÇÃO: Função addMessage corrigida para aceitar os parâmetros corretamente
  const addMessage = (role: 'user' | 'system' | 'assistant', content: string, metadata?: {
    contextCount?: number;
    similarityScores?: number[];
  }) => {
    // Garantir que o conteúdo é uma string válida
    const safeContent = typeof content === 'string' 
      ? content 
      : content ? String(content) : 'Conteúdo da mensagem indisponível';
    
    const newMessage: Message = { 
      role, 
      content: safeContent,
      metadata 
    };
    
    setState(prevState => ({
      ...prevState,
      conversationHistory: [...prevState.conversationHistory, newMessage]
    }));
  };

  const startProcessing = () => {
    updateState({
      processingStartTime: new Date(),
      currentStep: 1 // Iniciar com Upload (etapa 1)
    });

    // Update file statuses
    setState(prevState => ({
      ...prevState,
      files: prevState.files.map(file => ({
        ...file,
        status: 'processing'
      }))
    }));
  };

  const updateStep = (step: number) => {
    if (step > 0 && step <= 4) {
      updateState({
        currentStep: step
      });
    }
  };

  const completeProcessing = () => {
    updateState({
      processingEndTime: new Date(),
      currentStep: 4 // Concluir com Análise Completa (etapa 4)
    });

    // Generate processing results
    setState(prevState => {
      const results = prevState.files.map(file => ({
        fileName: file.name,
        tables: file.tables || 0,
        status: file.status,
        processingTime: file.processingTime || 0,
        outputPath: file.outputPath,
        enhancedPath: file.enhancedPath,
        matchedCount: file.matchedCount,
        totalDescriptions: file.totalDescriptions
      }));

      return {
        ...prevState,
        processingResults: results
      };
    });
  };

  const incrementTablesExtracted = (count: number) => {
    setState(prevState => ({
      ...prevState,
      tablesExtracted: prevState.tablesExtracted + count
    }));
  };

  return {
    state,
    updateState,
    addFiles,
    updateFileStatus,
    addMessage,
    startProcessing,
    updateStep,
    completeProcessing,
    incrementTablesExtracted
  };
}