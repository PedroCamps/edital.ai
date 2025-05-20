import React from 'react';
import styles from '../page.module.css';

interface DashboardProps {
  totalFiles: number;
  tablesExtracted: number;
  processingTime: string;
  successRate: string;
  matchedRate?: string; // New prop for recognition rate
}

export default function Dashboard({
  totalFiles,
  tablesExtracted,
  processingTime,
  successRate,
  matchedRate = "0"
}: DashboardProps) {
  return (
    <>
      <div className={styles.dashboard}>
        <div className={styles.dashboardCard}>
          <h3>Total de Arquivos</h3>
          <div className={styles.value}>
            {totalFiles}
          </div>
          <div className={styles.description}>
            Arquivos processados
          </div>
        </div>

        <div className={styles.dashboardCard}>
          <h3>Tabelas Extraídas</h3>
          <div className={styles.value}>
            {tablesExtracted}
          </div>
          <div className={styles.description}>
            Total de tabelas encontradas
          </div>
        </div>

        <div className={styles.dashboardCard}>
          <h3>Tempo de Processamento</h3>
          <div className={styles.value}>
            {processingTime}s
          </div>
          <div className={styles.description}>
            Tempo total de processamento
          </div>
        </div>

        <div className={styles.dashboardCard}>
          <h3>Taxa de Sucesso</h3>
          <div className={styles.value}>
            {successRate}%
          </div>
          <div className={styles.description}>
            Arquivos processados com sucesso
          </div>
        </div>
        
        {/* New card for matched/recognition rate */}
        <div className={styles.dashboardCard}>
          <h3>Taxa de Reconhecimento</h3>
          <div className={styles.value}>
            {matchedRate}%
          </div>
          <div className={styles.description}>
            Itens reconhecidos no catálogo
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: '1.5rem' }}>
        <div className={styles.cardHeader}>
          Estatísticas de Processamento
        </div>
        <div className={styles.cardBody}>
          <div style={{ height: '300px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: 'var(--secondary)',
              }}
            >
              {totalFiles > 0 
                ? "Carregando estatísticas..." 
                : "Não há dados para mostrar. Processe arquivos para visualizar estatísticas."}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}