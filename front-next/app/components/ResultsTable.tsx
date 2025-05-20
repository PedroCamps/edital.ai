import React from 'react';
import styles from '../page.module.css';
import { ProcessingResult } from '../hooks/useAppState';

// API base URL - configurado para funcionar no Docker e localmente
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:7070'  // Ambiente de desenvolvimento local
  : 'http://backend:7070';    // Ambiente Docker

interface ResultsTableProps {
  results: ProcessingResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  // Helper function to add API base URL to paths
  const getFullPath = (path?: string) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${API_BASE_URL}/api/file?path=${encodeURIComponent(path)}`;
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        Resultados da Extração
      </div>
      <div className={styles.cardBody}>
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tabelas</th>
                <th>Status</th>
                <th>Tempo</th>
                <th>Reconhecimento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>
                    Nenhum resultado disponível. Processe arquivos para visualizar resultados.
                  </td>
                </tr>
              ) : (
                results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.fileName}</td>
                    <td>{result.tables}</td>
                    <td>
                      <span className={`${styles.fileStatus} ${styles[`status${result.status.charAt(0).toUpperCase() + result.status.slice(1)}`]}`}>
                        {result.status === 'completed' ? 'Concluído' : 'Erro'}
                      </span>
                    </td>
                    <td>{typeof result.processingTime === 'number' ? result.processingTime.toFixed(1) : result.processingTime}s</td>
                    <td>
                      {/* Show recognition rate if available */}
                      {result.matchedCount !== undefined && result.totalDescriptions !== undefined && result.totalDescriptions > 0 
                        ? `${((result.matchedCount / result.totalDescriptions) * 100).toFixed(1)}% (${result.matchedCount}/${result.totalDescriptions})`
                        : 'N/A'}
                    </td>
                    <td>
                      {result.status === 'completed' && result.outputPath && (
                        <a
                          href={getFullPath(result.outputPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.875rem',
                            marginRight: '0.5rem'
                          }}
                        >
                          Ver Extração
                        </a>
                      )}
                      
                      {result.status === 'completed' && result.enhancedPath && (
                        <a
                          href={getFullPath(result.enhancedPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.875rem'
                          }}
                        >
                          Ver Processado
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}