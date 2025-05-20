import React, { useState, useEffect, useMemo } from 'react';
import styles from '../page.module.css';

// API base URL - configurado para funcionar no Docker e localmente
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:7070'  // Ambiente de desenvolvimento local
  : 'http://backend:7070';    // Ambiente Docker

interface MedicamentoItem {
  item: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
  produtoBase?: string;
  similaridade?: string;
}

interface TabelaExtraidaProps {
  filesProcessed: boolean;
  processedFilePath?: string;
  enhancedFilePath?: string; // New prop for enhanced file
}

export default function TabelaExtraida({ 
  filesProcessed, 
  processedFilePath,
  enhancedFilePath
}: TabelaExtraidaProps) {
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'item', direction: 'ascending' });
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>(processedFilePath);
  
  console.log("Caminhos dos arquivos:", { processedFilePath, enhancedFilePath, selectedFilePath });
  
  // When file paths change, update the selected file path
  useEffect(() => {
    setSelectedFilePath(processedFilePath);
  }, [processedFilePath, enhancedFilePath]);

  useEffect(() => {
    const fetchData = async () => {
      if (!filesProcessed || !selectedFilePath) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // CORREÇÃO: Usar a API de download diretamente do backend
        // em vez de tentar acessar o arquivo diretamente
        const downloadUrl = `${API_BASE_URL}/api/file?path=${encodeURIComponent(selectedFilePath)}`;
        console.log("Tentando baixar arquivo de:", downloadUrl);
        
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Não foi possível carregar o arquivo: ${response.statusText}`);
        }
        
        // Tentar obter o conteúdo como texto
        const content = await response.text();
        console.log("Primeiros 200 caracteres:", content.substring(0, 200));
        
        // Processar o CSV recebido
        const parsedItems = processCSV(content);
        console.log(`Extraídos ${parsedItems.length} itens`);
        setMedicamentos(parsedItems);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setError('Erro ao carregar os dados: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        setLoading(false);
      }
    };

    fetchData();
  }, [filesProcessed, selectedFilePath]);

  // Função para processar o CSV em formato padrão
  const processCSV = (csvText: string): MedicamentoItem[] => {
    // Dividir por linhas e remover linhas vazias
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length <= 1) {
      console.warn("CSV não contém dados ou apenas cabeçalho");
      return [];
    }
    
    // Obter cabeçalho e detectar formato
    const headerLine = lines[0];
    const headerColumns = parseCSVLine(headerLine);
    console.log("Colunas detectadas:", headerColumns);
    
    // Mapear índices das colunas
    const columnMap = {
      item: headerColumns.findIndex(col => col.toUpperCase().includes('ITEM')),
      descricao: headerColumns.findIndex(col => 
        col.toUpperCase().includes('DESC') || 
        col.toUpperCase().includes('DESCRIÇÃO')
      ),
      quantidade: headerColumns.findIndex(col => 
        col.toUpperCase().includes('QUANT') || 
        col.toUpperCase().includes('QTD')
      ),
      unidade: headerColumns.findIndex(col => 
        col.toUpperCase().includes('UN') || 
        col.toUpperCase().includes('UNIDADE')
      ),
      valorUnitario: headerColumns.findIndex(col => 
        col.toUpperCase().includes('UNIT') || 
        col.toUpperCase().includes('VALOR_UNITARIO')
      ),
      valorTotal: headerColumns.findIndex(col => 
        col.toUpperCase().includes('TOTAL')
      ),
      produtoBase: headerColumns.findIndex(col => 
        col.toUpperCase().includes('PRODUTO_BASE') ||
        col.toUpperCase().includes('PRODUTO BASE')
      ),
      similaridade: headerColumns.findIndex(col => 
        col.toUpperCase().includes('SIMILAR')
      ),
    };
    
    // Verificar se as colunas principais foram encontradas
    const missingColumns: string[] = [];
    ['item', 'descricao', 'quantidade', 'unidade'].forEach(col => {
      if (columnMap[col as keyof typeof columnMap] === -1) {
        missingColumns.push(col);
      }
    });
    
    if (missingColumns.length > 0) {
      console.warn(`Colunas não encontradas: ${missingColumns.join(', ')}`);
      console.warn("Tentando usar mapeamento posicional padrão");
      
      // Aplicar mapeamento padrão (posicional)
      columnMap.item = 0;
      columnMap.descricao = 1;
      columnMap.quantidade = 2;
      columnMap.unidade = 3;
      columnMap.valorUnitario = 4;
      columnMap.valorTotal = 5;
      columnMap.produtoBase = 6;
      columnMap.similaridade = 7;
    }
    
    // Ignorar a primeira linha (cabeçalho)
    const dataLines = lines.slice(1);
    const items: MedicamentoItem[] = [];
    
    dataLines.forEach((line, lineIndex) => {
      try {
        // Separar os valores considerando que os campos podem conter vírgulas dentro de aspas
        const values = parseCSVLine(line);
        
        // Verificar se temos valores suficientes (pelo menos até unidade)
        if (values.length >= Math.max(
          columnMap.item, columnMap.descricao, 
          columnMap.quantidade, columnMap.unidade
        ) + 1) {
          const item: MedicamentoItem = {
            item: columnMap.item >= 0 ? values[columnMap.item] || '' : '',
            descricao: columnMap.descricao >= 0 ? values[columnMap.descricao] || '' : '',
            quantidade: columnMap.quantidade >= 0 ? values[columnMap.quantidade] || '' : '',
            unidade: columnMap.unidade >= 0 ? values[columnMap.unidade] || '' : '',
            valorUnitario: columnMap.valorUnitario >= 0 ? values[columnMap.valorUnitario] || '0' : '0',
            valorTotal: columnMap.valorTotal >= 0 ? values[columnMap.valorTotal] || '0' : '0'
          };
          
          // Adicionar campos opcionais se as colunas existirem e tiverem valores
          if (columnMap.produtoBase >= 0 && values.length > columnMap.produtoBase) {
            item.produtoBase = values[columnMap.produtoBase];
          }
          
          if (columnMap.similaridade >= 0 && values.length > columnMap.similaridade) {
            item.similaridade = values[columnMap.similaridade];
          }
          
          items.push(item);
        } else {
          console.warn(`Linha ${lineIndex + 2} não tem valores suficientes:`, values);
        }
      } catch (e) {
        console.error(`Erro ao processar linha ${lineIndex + 2} do CSV:`, line, e);
      }
    });
    
    return items;
  };

  // Função auxiliar melhorada para processar linhas CSV com valores entre aspas
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    let i = 0;
    
    // Remove BOM (Byte Order Mark) se existir no início da linha
    if (line.charCodeAt(0) === 0xFEFF) {
      line = line.slice(1);
    }
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        // Se estamos no início ou fim de uma string com aspas, alternar o estado
        if (!inQuotes) {
          inQuotes = true;
        } else if (i + 1 < line.length && line[i + 1] === '"') {
          // Caso especial: aspas duplas dentro de texto entre aspas (escape)
          currentValue += '"';
          i++; // Pular o próximo caractere (segunda aspa)
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        // Fim do campo atual, adicionar à lista de valores
        // Remover aspas extras no início e fim se existirem
        let finalValue = currentValue;
        if (finalValue.startsWith('"') && finalValue.endsWith('"')) {
          finalValue = finalValue.slice(1, -1);
        }
        values.push(finalValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
      
      i++;
    }
    
    // Adicionar o último valor
    if (currentValue || i > 0) {
      // Remover aspas extras no início e fim se existirem
      let finalValue = currentValue;
      if (finalValue.startsWith('"') && finalValue.endsWith('"')) {
        finalValue = finalValue.slice(1, -1);
      }
      values.push(finalValue.trim());
    }
    
    return values;
  };

  // Função para normalizar valores monetários (substituir vírgula por ponto)
  const normalizarValorMonetario = (valor: string): number => {
    if (!valor || valor === '-') return 0;
    
    // Remover todos os caracteres não numéricos exceto vírgula e ponto
    const valorLimpo = valor.replace(/[^\d,.-]/g, '');
    
    // Converter vírgula para ponto
    const valorNormalizado = valorLimpo.replace(',', '.');
    
    return parseFloat(valorNormalizado) || 0;
  };

  // Função para formatar valores monetários para exibição
  const formatarValorMonetario = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });
  };

  // Função para ordenar os medicamentos
  const requestSort = (key: string) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Handle file type change
  const handleFileTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    setSelectedFilePath(selectedValue === 'original' ? processedFilePath : enhancedFilePath);
  };

  // Aplicar filtro de busca e ordenação
  const filteredAndSortedMedicamentos = useMemo(() => {
    let filtered = [...medicamentos];
    
    // Aplicar filtro de busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(med => 
        med.descricao.toLowerCase().includes(searchLower) || 
        med.item.includes(searchTerm)
      );
    }
    
    // Aplicar ordenação
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        // Obter os valores para comparação
        const aValue = a[sortConfig.key as keyof MedicamentoItem] as string;
        const bValue = b[sortConfig.key as keyof MedicamentoItem] as string;
        
        // Verificar se estamos ordenando campos numéricos
        if (['item', 'quantidade', 'valorUnitario', 'valorTotal', 'similaridade'].includes(sortConfig.key)) {
          // Normalizar e converter para número
          const aNum = normalizarValorMonetario(aValue);
          const bNum = normalizarValorMonetario(bValue);
          
          if (sortConfig.direction === 'ascending') {
            return aNum - bNum;
          }
          return bNum - aNum;
        } else {
          // Ordenação de texto
          if (!aValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (!bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    
    return filtered;
  }, [medicamentos, searchTerm, sortConfig]);

  // Calcular valor total da licitação
  const valorTotal = useMemo(() => {
    let total = 0;
    medicamentos.forEach(med => {
      total += normalizarValorMonetario(med.valorTotal);
    });
    
    return formatarValorMonetario(total);
  }, [medicamentos]);

  // Renderizar indicador de ordenação
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  if (loading) {
    return <div className={styles.card}>
      <div className={styles.cardHeader}>Tabela Extraída</div>
      <div className={styles.cardBody}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando dados...</div>
      </div>
    </div>;
  }

  if (error) {
    return <div className={styles.card}>
      <div className={styles.cardHeader}>Tabela Extraída</div>
      <div className={styles.cardBody}>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
          {error}
          <div style={{ marginTop: '1rem' }}>
            <p>URL do arquivo: {`${API_BASE_URL}/api/file?path=${encodeURIComponent(selectedFilePath || '')}`}</p>
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => window.open(`${API_BASE_URL}/api/file?path=${encodeURIComponent(selectedFilePath || '')}`)}
            >
              Tentar Abrir Arquivo Diretamente
            </button>
          </div>
        </div>
      </div>
    </div>;
  }

  if (!filesProcessed) {
    return <div className={styles.card}>
      <div className={styles.cardHeader}>Tabela Extraída</div>
      <div className={styles.cardBody}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Processe um arquivo para visualizar a tabela extraída.
        </div>
      </div>
    </div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        Tabela Extraída
        {/* Add file type selector if enhanced file is available */}
        {enhancedFilePath && processedFilePath && (
          <div style={{ float: 'right', marginTop: '-5px' }}>
            <select 
              onChange={handleFileTypeChange}
              value={selectedFilePath === processedFilePath ? 'original' : 'enhanced'}
              className={styles.selectInput}
              style={{ padding: '4px 8px', borderRadius: '4px' }}
            >
              <option value="original">Dados Extraídos</option>
              <option value="enhanced">Dados Enriquecidos</option>
            </select>
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <input
                type="text"
                placeholder="Buscar por descrição ou número do item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.chatInput}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 'bold' }}>Total de itens: {medicamentos.length}</p>
              <p style={{ fontWeight: 'bold' }}>Valor Total: {valorTotal}</p>
            </div>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th onClick={() => requestSort('item')} style={{ cursor: 'pointer' }}>
                  Item {getSortIndicator('item')}
                </th>
                <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>
                  Descrição {getSortIndicator('descricao')}
                </th>
                <th onClick={() => requestSort('quantidade')} style={{ cursor: 'pointer' }}>
                  Qtde {getSortIndicator('quantidade')}
                </th>
                <th onClick={() => requestSort('unidade')} style={{ cursor: 'pointer' }}>
                  Un. {getSortIndicator('unidade')}
                </th>
                <th onClick={() => requestSort('valorUnitario')} style={{ cursor: 'pointer' }}>
                  Valor Unit. {getSortIndicator('valorUnitario')}
                </th>
                <th onClick={() => requestSort('valorTotal')} style={{ cursor: 'pointer' }}>
                  Valor Total {getSortIndicator('valorTotal')}
                </th>
                {/* Mostrar coluna de produto base e similaridade se disponível */}
                {medicamentos.some(med => med.produtoBase) && (
                  <th onClick={() => requestSort('produtoBase')} style={{ cursor: 'pointer' }}>
                    Produto Base {getSortIndicator('produtoBase')}
                  </th>
                )}
                {medicamentos.some(med => med.similaridade) && (
                  <th onClick={() => requestSort('similaridade')} style={{ cursor: 'pointer' }}>
                    Similaridade {getSortIndicator('similaridade')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMedicamentos.length > 0 ? (
                filteredAndSortedMedicamentos.map((med, index) => (
                  <tr key={index}>
                    <td>{med.item}</td>
                    <td style={{ fontWeight: 500 }}>{med.descricao}</td>
                    <td>{med.quantidade}</td>
                    <td>{med.unidade}</td>
                    <td>
                      {med.valorUnitario && normalizarValorMonetario(med.valorUnitario) > 0
                        ? formatarValorMonetario(normalizarValorMonetario(med.valorUnitario))
                        : '-'
                      }
                    </td>
                    <td>
                      {med.valorTotal && normalizarValorMonetario(med.valorTotal) > 0
                        ? formatarValorMonetario(normalizarValorMonetario(med.valorTotal))
                        : '-'
                      }
                    </td>
                    {/* Mostrar coluna de produto base e similaridade se disponível */}
                    {medicamentos.some(m => m.produtoBase) && (
                      <td>{med.produtoBase || '-'}</td>
                    )}
                    {medicamentos.some(m => m.similaridade) && (
                      <td>
                        {med.similaridade 
                          ? `${(parseFloat(med.similaridade) * 100).toFixed(1)}%` 
                          : '-'
                        }
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={
                    6 + 
                    (medicamentos.some(m => m.produtoBase) ? 1 : 0) +
                    (medicamentos.some(m => m.similaridade) ? 1 : 0)
                  } style={{ textAlign: 'center', padding: '1rem' }}>
                    {searchTerm ? "Nenhum item encontrado com os critérios de busca." : "Não foram encontrados itens."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    );
  }