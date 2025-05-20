import React from 'react';
import styles from '../page.module.css';

interface StepInfo {
  number: number;
  name: string;
  status: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface ProcessingStatusProps {
  currentStep: number;
  processingCompleted?: boolean;  // Adicionado o novo parâmetro
}

export default function ProcessingStatus({ 
  currentStep, 
  processingCompleted = false  // Parâmetro adicionado com valor padrão
}: ProcessingStatusProps) {
  const steps: StepInfo[] = [
    {
      number: 1,
      name: 'Upload de Arquivos',
      status: currentStep === 0 ? 'Aguardando...' : 
              currentStep >= 1 ? (currentStep > 1 ? 'Concluído' : 'Em andamento...') : 'Aguardando...',
      isCompleted: currentStep > 1,
      isCurrent: currentStep === 1
    },
    {
      number: 2,
      name: 'Extração de Tabelas',
      status: currentStep < 2 ? 'Aguardando...' : 
              currentStep >= 2 ? (currentStep > 2 ? 'Concluído' : 'Extraindo tabelas...') : 'Aguardando...',
      isCompleted: currentStep > 2,
      isCurrent: currentStep === 2
    },
    {
      number: 3,
      name: 'Processamento RAG',
      status: currentStep < 3 ? 'Aguardando...' : 
              currentStep >= 3 ? (currentStep > 3 ? 'Concluído' : 'Processando RAG...') : 'Aguardando...',
      isCompleted: currentStep > 3,
      isCurrent: currentStep === 3
    },
    {
      number: 4,
      name: 'Análise Completa',
      status: currentStep < 4 ? 'Aguardando...' : 
              (currentStep === 4 && !processingCompleted) ? 'Finalizando...' : 'Concluído',  // Modificado
      isCompleted: currentStep === 4 && processingCompleted,  // Modificado
      isCurrent: currentStep === 4 && !processingCompleted    // Modificado
    }
  ];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        Status do Processamento
      </div>
      <div className={styles.cardBody}>
        <div className={styles.progressContainer}>
          {steps.map((step) => (
            <div key={step.number} className={styles.progressStep}>
              <div
                className={`${styles.stepIcon} ${step.isCompleted ? styles.completed : ''} ${step.isCurrent ? styles.current : ''}`}
              >
                {step.isCompleted ? '✓' : step.number}
              </div>
              <div className={styles.stepDetails}>
                <div className={styles.stepName}>
                  {step.name}
                </div>
                <div className={styles.stepStatus}>
                  {step.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}