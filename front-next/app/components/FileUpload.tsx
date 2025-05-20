import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import styles from '../page.module.css';

interface FileInfo {
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
}

interface FileUploadProps {
  onFilesSelected: (files: FileInfo[]) => void;
  onProcessFiles: () => void;
  isProcessing: boolean; // Adicione esta linha
}

export default function FileUpload({ onFilesSelected, onProcessFiles }: FileUploadProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--primary)';
    e.currentTarget.style.backgroundColor = '#f8fafc';
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '#cbd5e1';
    e.currentTarget.style.backgroundColor = '';
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '#cbd5e1';
    e.currentTarget.style.backgroundColor = '';
    
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (filesList: File[]) => {
    const pdfFiles = filesList.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Por favor, selecione apenas arquivos PDF.');
      return;
    }
    
    // Add new files to state without duplicates
    const newFiles = pdfFiles.map(file => ({
      file,
      name: file.name,
      status: 'waiting' as const
    }));
    
    setFiles(prevFiles => {
      const combinedFiles = [...prevFiles];
      
      newFiles.forEach(newFile => {
        if (!combinedFiles.some(f => f.name === newFile.name)) {
          combinedFiles.push(newFile);
        }
      });
      
      return combinedFiles;
    });
    
    // Use useEffect para notificar o componente pai sobre as mudanças
  };
  
  // Usar useEffect para notificar o pai sobre mudanças no estado de files
  // Usando uma ref para armazenar os arquivos anteriores para comparação
  const prevFilesRef = useRef<FileInfo[]>([]);
  
  useEffect(() => {
    // Só notificar se a quantidade de arquivos mudou
    if (files.length !== prevFilesRef.current.length) {
      onFilesSelected(files);
      prevFilesRef.current = [...files];
    }
  }, [files]);

  const removeFile = (index: number) => {
    setFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      updatedFiles.splice(index, 1);
      
      // Call parent component's callback with updated files
      onFilesSelected(updatedFiles);
      
      return updatedFiles;
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Aguardando';
      case 'processing': return 'Processando';
      case 'completed': return 'Concluído';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        Upload de Arquivos
      </div>
      <div className={styles.cardBody}>
        <label
          htmlFor="fileInput"
          className={styles.uploadArea}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.uploadIcon}>📁</div>
          <h3>Arraste e solte arquivos PDF aqui</h3>
          <p>ou clique para selecionar</p>
        </label>
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept=".pdf"
          style={{
            opacity: 0,
            height: "0.1px",
            width: "100%",
          }}
          multiple
          onChange={handleFileSelect}
        />

        <div className={styles.fileList}>
          {files.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--secondary)', padding: '1rem' }}>
              Nenhum arquivo selecionado
            </p>
          ) : (
            files.map((file, index) => (
              <div key={file.name + index} className={styles.fileItem}>
                <div className={styles.fileName}>{file.name}</div>
                <div className={`${styles.fileStatus} ${styles['status' + file.status.charAt(0).toUpperCase() + file.status.slice(1)]}`}>
                  {getStatusText(file.status)}
                </div>
                <button 
                  className={styles.btn}
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => removeFile(index)}
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onProcessFiles}
            disabled={files.length === 0}
          >
            Processar Arquivos
          </button>
        </div>
      </div>
    </div>
  );
}