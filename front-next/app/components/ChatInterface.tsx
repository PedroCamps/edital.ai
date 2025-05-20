import React, { useState, useRef, useEffect } from 'react';
import styles from '../page.module.css'; // Using existing global styles
import { Message } from '../hooks/useAppState';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isProcessingComplete: boolean;
}

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  isProcessingComplete 
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Format message content with proper line breaks
  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index !== content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  // Render context metadata if available
  const renderMetadata = (message: Message) => {
    if (message.role !== 'assistant' || !message.metadata) {
      return null;
    }
    
    const { contextCount, similarityScores } = message.metadata || {};
    
    if (!contextCount && (!similarityScores || similarityScores.length === 0)) {
      return null;
    }
    
    return (
      <div className={styles.metadataInfo}>
        {contextCount && <span>Trechos: {contextCount}</span>}
        {similarityScores && similarityScores.length > 0 && (
          <span style={{ marginLeft: '10px' }}>
            Relevância: {(similarityScores[0] * 100).toFixed(1)}%
          </span>
        )}
      </div>
    );
  };
  
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        Assistente de Consulta
      </div>
      <div className={styles.cardBody}>
        <div className={styles.chatContainer}>
          <div className={styles.chatMessages}>
            {messages.length === 0 ? (
              <div className={`${styles.message} ${styles.system}`}>
                Olá! Eu sou seu assistente para análise de editais. 
                Após o processamento do PDF, você poderá me fazer perguntas sobre o conteúdo.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`${styles.message} ${
                    msg.role === 'user' 
                      ? styles.user 
                      : msg.role === 'assistant' 
                        ? styles.assistant 
                        : styles.system
                  }`}
                >
                  {formatMessageContent(msg.content)}
                  {renderMetadata(msg)}
                </div>
              ))
            )}
            {/* This empty div is used for auto-scrolling */}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.chatInput}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua pergunta..."
              disabled={!isProcessingComplete}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSendMessage}
              disabled={!isProcessingComplete || !inputValue.trim()}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}