import pandas as pd
import json
import re
import os
from typing import Dict, List, Any, Optional


class Extractor:
    """
    Classe base para extração de dados de editais de licitação.
    """
    def __init__(self, input_file: str):
        """
        Inicializa o extrator com o caminho do arquivo JSON.
        
        Args:
            input_file: Caminho para o arquivo JSON do edital
        """
        self.input_file = input_file
        self.content = self._load_content()
        
    def _load_content(self) -> str:
        """
        Carrega o conteúdo do arquivo JSON.
        
        Returns:
            Conteúdo do texto do PDF extraído do JSON
        """
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('data', {}).get('content', '')
        except Exception as e:
            raise IOError(f"Erro ao carregar o arquivo JSON: {str(e)}")
    
    def extract(self) -> pd.DataFrame:
        """
        Método abstrato para extrair dados do edital.
        Deve ser implementado pelas subclasses.
        
        Returns:
            DataFrame com os dados extraídos
        """
        raise NotImplementedError("Método extract() deve ser implementado pela subclasse")
    
    def analyze(self, df: pd.DataFrame) -> None:
        """
        Realiza análises básicas sobre os dados extraídos.
        
        Args:
            df: DataFrame com os dados extraídos
        """
        if df is None or len(df) == 0:
            print("Não há dados para analisar.")
            return
        
        print("\n=== Análise dos Dados ===")
        print(f"Total de itens: {len(df)}")
        
        # Análises específicas podem ser implementadas nas subclasses
    
    def save_to_csv(self, df: pd.DataFrame, output_file: str) -> str:
        """
        Salva o DataFrame em um arquivo CSV.
        
        Args:
            df: DataFrame com os dados extraídos
            output_file: Caminho para o arquivo de saída
            
        Returns:
            Caminho do arquivo salvo
        """
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"Dados salvos com sucesso em {output_file}")
        return output_file
    
    def save_to_excel(self, df: pd.DataFrame, output_file: str) -> str:
        """
        Salva o DataFrame em um arquivo Excel.
        
        Args:
            df: DataFrame com os dados extraídos
            output_file: Caminho para o arquivo de saída
            
        Returns:
            Caminho do arquivo salvo
        """
        try:
            df.to_excel(output_file, index=False)
            print(f"Dados salvos com sucesso em {output_file}")
            return output_file
        except Exception as e:
            print(f"Erro ao salvar o arquivo Excel: {str(e)}")
            return ""


class ItumbiaraExtractor(Extractor):
    """
    Extrator específico para o município de Itumbiara.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Itumbiara.
        
        Returns:
            DataFrame com os dados extraídos
        """
        items = []
        lines = self.content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Procurando por padrão " XX " onde XX é o número do item
            if re.match(r'\s*\d+\s*$', line):
                item_num = line.strip()
                i += 1
                
                if i < len(lines):
                    descricao = lines[i].strip()
                    i += 1
                    
                    # Tentando encontrar unidade, quantidade, valores
                    if i + 3 < len(lines):
                        unidade = lines[i].strip()
                        i += 1
                        
                        quantidade = lines[i].strip()
                        i += 1
                        
                        valor_unit = lines[i].strip().replace('R$', '').strip()
                        i += 1
                        
                        valor_total = lines[i].strip().replace('R$', '').strip()
                        
                        items.append({
                            'ITEM': item_num,
                            'DESCRIÇÃO': descricao,
                            'QUANTIDADE': quantidade,
                            'UNIDADE': unidade,
                            'VALOR_UNITARIO': valor_unit,
                            'VALOR_TOTAL': valor_total
                        })
            i += 1
        
        return pd.DataFrame(items)
    
    def analyze(self, df: pd.DataFrame) -> None:
        """
        Análises específicas para Itumbiara.
        
        Args:
            df: DataFrame com os dados extraídos
        """
        super().analyze(df)
        
        # Converter valores para numérico para análises
        try:
            df['VALOR_UNITARIO'] = pd.to_numeric(df['VALOR_UNITARIO'].str.replace('.', '').str.replace(',', '.'), errors='coerce')
            df['VALOR_TOTAL'] = pd.to_numeric(df['VALOR_TOTAL'].str.replace('.', '').str.replace(',', '.'), errors='coerce')
            
            total_licitacao = df['VALOR_TOTAL'].sum()
            print(f"Valor total da licitação: R$ {total_licitacao:.2f}")
            
            # Itens mais caros
            top_priced = df.nlargest(3, 'VALOR_UNITARIO')
            print("\nItens mais caros (valor unitário):")
            for _, row in top_priced.iterrows():
                print(f"Item {row['ITEM']}: {row['DESCRIÇÃO'][:40]}... - R$ {row['VALOR_UNITARIO']:.2f}")
        except Exception as e:
            print(f"Erro ao realizar análises específicas: {str(e)}")


class PadreBernardoExtractor(Extractor):
    """
    Extrator específico para o município de Padre Bernardo.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Padre Bernardo.
        
        Returns:
            DataFrame com os dados extraídos
        """
        items = []
        
        # Padrão identificado: 5 dígitos para código de item, seguido de número e unidade
        pattern = r'(\d{5})\s+([0-9.,]+)\s+([A-Z]+)\s+([^\n]+)'
        
        matches = re.findall(pattern, self.content)
        
        for match in matches:
            item_num = match[0].strip()
            quantidade = match[1].strip()
            unidade = match[2].strip()
            descricao = match[3].strip()
            
            items.append({
                'ITEM': item_num,
                'DESCRIÇÃO': descricao,
                'QUANTIDADE': quantidade,
                'UNIDADE': unidade,
                'VALOR_UNITARIO': None,
                'VALOR_TOTAL': None
            })
        
        return pd.DataFrame(items)


class FrutalExtractor(Extractor):
    """
    Extrator específico para o município de Frutal.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Frutal.
        
        Returns:
            DataFrame com os dados extraídos
        """
        items = []
        
        # Padrão: número do item, quantidade, valor unitário, descrição, unidade
        pattern = r'(\d+)\s+([0-9.]+)\s+R\$([0-9,.]+)\s+([^\n]+)\s+([A-Z]+)\s+R\$([0-9,.]+)'
        
        matches = re.findall(pattern, self.content)
        
        for match in matches:
            item_num = match[0].strip()
            quantidade = match[1].strip()
            valor_unit = match[2].strip()
            descricao = match[3].strip()
            unidade = match[4].strip()
            valor_total = match[5].strip()
            
            items.append({
                'ITEM': item_num,
                'DESCRIÇÃO': descricao,
                'QUANTIDADE': quantidade,
                'UNIDADE': unidade,
                'VALOR_UNITARIO': valor_unit,
                'VALOR_TOTAL': valor_total
            })
        
        return pd.DataFrame(items)


class MorrinhosExtractor(Extractor):
    """
    Extrator específico para o município de Morrinhos.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Morrinhos.
        
        Returns:
            DataFrame com os dados extraídos
        """
        # Lista para armazenar as tabelas extraídas
        items = []
        
        # Padrões para identificar linhas de itens na tabela
        pattern = r'(\d+)\s+(\d+)\s+(\d+)\s+(\w+)\s+([\w\s(),.\-:;/]+?)(?:\s+R\$\s+)([\d.,]+)(?:\s+R\$\s+)([\d.,]+)'
        
        # Encontrar todas as correspondências no texto
        matches = re.findall(pattern, self.content)
        
        # Categorias atuais
        current_category = ""
        categories = {}
        
        # Extrair categorias
        category_pattern = r'(\d+)\s+-\s+([\w\s,]+)'
        category_matches = re.findall(category_pattern, self.content)
        
        for code, name in category_matches:
            categories[code] = name.strip()
        
        # Processar as correspondências
        for match in matches:
            item_num, code, qtde, medida, descricao, valor_unitario, valor_total = match
            
            # Verificar a qual categoria o item pertence
            for cat_code, cat_name in categories.items():
                if int(code) in range(int(cat_code), int(cat_code) + 10000):  # Aproximação
                    current_category = cat_name
                    break
            
            # Adicionar o item à lista
            items.append({
                'Item': int(item_num),
                'Código': code,
                'Categoria': current_category,
                'Quantidade': int(qtde),
                'Medida': medida,
                'Descrição': descricao.strip(),
                'Valor Unitário': valor_unitario,
                'Valor Total': valor_total
            })
        
        # Criar DataFrame a partir dos itens
        return pd.DataFrame(items)
    
    def save_to_excel(self, df: pd.DataFrame, output_file: str) -> str:
        """
        Salva o DataFrame em um arquivo Excel com análises específicas para Morrinhos.
        
        Args:
            df: DataFrame com os dados extraídos
            output_file: Caminho para o arquivo de saída
            
        Returns:
            Caminho do arquivo salvo
        """
        try:
            # Converter para numérico os valores monetários
            df['Valor Unitário'] = df['Valor Unitário'].str.replace('.', '').str.replace(',', '.').astype(float)
            df['Valor Total'] = df['Valor Total'].str.replace('.', '').str.replace(',', '.').astype(float)
            
            # Salvar para Excel
            df.to_excel(output_file, index=False)
            print(f"Dados salvos com sucesso em {output_file}")
            
            # Calcular o valor total da licitação
            total_licitacao = df['Valor Total'].sum()
            print(f"Valor total da licitação: R$ {total_licitacao:.2f}")
            
            # Resumo por categoria
            resumo_categorias = df.groupby('Categoria').agg({
                'Item': 'count',
                'Valor Total': 'sum'
            }).rename(columns={'Item': 'Quantidade de Itens'})
            
            print("\nResumo por Categoria:")
            print(resumo_categorias)
            
            return output_file
        except Exception as e:
            print(f"Erro ao salvar o arquivo Excel: {str(e)}")
            return ""


class SaoRoqueExtractor(Extractor):
    """
    Extrator específico para o município de São Roque.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de São Roque.
        
        Returns:
            DataFrame com os dados extraídos
        """
        # Extrair informações do cabeçalho do pregão
        header_info = {}
        pregao_pattern = r'Pregão Eletrônico nº (\d+\/\d+)'
        pregao_match = re.search(pregao_pattern, self.content)
        if pregao_match:
            header_info['pregao_numero'] = pregao_match.group(1)
        
        # Padrão para extrair as linhas da tabela
        # Formato: Item, Qtde, UN, Descrição, Valor Médio Unitário, Valor Médio Total
        pattern = r'(\d+)\s+(\d+\.?\d*)\s+(\w+)\s+([\w\s(),.\-:;/]+?)(?:\s+(\d+,\d+))(?:\s+(\d+\.\d+,\d+))'
        
        # Encontrar todas as correspondências no texto
        matches = re.findall(pattern, self.content)
        
        # Inicializar lista para armazenar os dados
        items = []
        
        # Verificar se encontramos itens
        if not matches:
            print("Nenhum item encontrado no texto. Verificando padrão alternativo...")
            
            # Tente um padrão alternativo se o primeiro falhar
            alt_pattern = r'(\d+)\s+(\d+[\.,]?\d*)\s+(\w+)\s+([\w\s(),.\-:;/]+?)(?:\s+(\d+[,.]\d+))(?:\s+(\d+[.,]\d+[,.]\d+))'
            matches = re.findall(alt_pattern, self.content)
            
            if not matches:
                print("Nenhum item encontrado com o padrão alternativo. Tentando método alternativo...")
                
                # Se a extração por regex falhar, tente um método alternativo
                lines = self.content.split('\n')
                current_item = {}
                
                for line in lines:
                    # Procurar por linhas que iniciam com número de item
                    if re.match(r'^\s*\d+\s+\d+', line):
                        parts = line.strip().split()
                        if len(parts) >= 6:  # Verificar se tem partes suficientes
                            if current_item:
                                items.append(current_item)
                            current_item = {
                                'Item': int(parts[0]),
                                'Qtde': parts[1].replace('.', ''),
                                'UN': parts[2],
                                'Descrição': ' '.join(parts[3:-2]),
                                'Valor Médio Unitário': parts[-2],
                                'Valor Médio Total': parts[-1]
                            }
                
                # Adicionar o último item
                if current_item:
                    items.append(current_item)
        else:
            # Processar as correspondências encontradas pelo regex
            for match in matches:
                item_num, qtde, un, descricao, valor_unitario, valor_total = match
                
                # Limpar e formatar a descrição
                descricao = descricao.strip()
                
                # Adicionar o item à lista
                items.append({
                    'Item': int(item_num),
                    'Qtde': qtde.replace('.', ''),  # Remover pontos para números grandes
                    'UN': un,
                    'Descrição': descricao,
                    'Valor Médio Unitário': valor_unitario,
                    'Valor Médio Total': valor_total
                })
        
        # Criar DataFrame a partir dos itens
        df = pd.DataFrame(items)
        
        # Adicionar informações do cabeçalho
        df['Pregão Número'] = header_info.get('pregao_numero', '')
        
        return df
    
    def save_to_excel(self, df: pd.DataFrame, output_file: str) -> str:
        """
        Salva o DataFrame em um arquivo Excel com análises específicas para São Roque.
        
        Args:
            df: DataFrame com os dados extraídos
            output_file: Caminho para o arquivo de saída
            
        Returns:
            Caminho do arquivo salvo
        """
        try:
            # Converter para numérico os valores monetários
            df['Valor Médio Unitário'] = df['Valor Médio Unitário'].str.replace('.', '').str.replace(',', '.').astype(float)
            df['Valor Médio Total'] = df['Valor Médio Total'].str.replace('.', '').str.replace(',', '.').astype(float)
            
            # Converter quantidade para inteiro
            df['Qtde'] = df['Qtde'].astype(int)
            
            # Salvar para Excel
            df.to_excel(output_file, index=False)
            print(f"Dados salvos com sucesso em {output_file}")
            
            # Calcular o valor total da licitação
            total_licitacao = df['Valor Médio Total'].sum()
            print(f"Valor total da licitação: R$ {total_licitacao:.2f}")
            
            # Análise adicional dos dados
            print("\nResumo dos Dados:")
            print(f"Total de itens: {len(df)}")
            print(f"Quantidade total de unidades: {df['Qtde'].sum()}")
            
            # Identificar os itens mais caros
            print("\nItens mais caros (valor unitário):")
            top_priced = df.sort_values(by='Valor Médio Unitário', ascending=False).head(3)
            for _, row in top_priced.iterrows():
                print(f"Item {row['Item']}: {row['Descrição'][:40]}... - R$ {row['Valor Médio Unitário']:.4f}")
            
            # Identificar os itens com maior valor total
            print("\nItens com maior valor total:")
            top_total = df.sort_values(by='Valor Médio Total', ascending=False).head(3)
            for _, row in top_total.iterrows():
                print(f"Item {row['Item']}: {row['Descrição'][:40]}... - R$ {row['Valor Médio Total']:.2f}")
            
            return output_file
        except Exception as e:
            print(f"Erro ao salvar o arquivo Excel: {str(e)}")
            return ""


class CavalcanteExtractor(Extractor):
    """
    Extrator específico para o município de Cavalcante.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Cavalcante.
        Returns:
            DataFrame com os dados extraídos
        """
        # Extrair informações do cabeçalho
        header_info = {}
        processo_pattern = r'Processo Administrativo nº (\d+\/\d+)'
        processo_match = re.search(processo_pattern, self.content)
        if processo_match:
            header_info['processo_numero'] = processo_match.group(1)
        
        # Padrão regex mais preciso para capturar linhas da tabela
        pattern = r'(\d+)\s*\n?([\s\S]*?)(?=\d+\s*\n?[A-Z]{2,3}$|\Z)\s*(\d+)\s*\n?\s*([A-Z]{2,3})'
        
        # Encontrar todas as correspondências
        matches = re.findall(pattern, self.content, re.MULTILINE)
        
        # Lista para armazenar os dados processados
        items = []
        
        # Se a extração por regex funcionar bem
        if matches and len(matches) >= 5:
            # Processar itens extraídos pelo regex
            for match in matches:
                item_num, descricao, quant, unid = match
                items.append({
                    "Item": int(item_num),
                    "Descrição": descricao.strip().replace('\n', ' '),
                    "Quant": int(quant),
                    "Unid": unid.strip()
                })
        else:
            # Método alternativo: tentar extrair manualmente dos primeiros itens
            print("Extração por regex principal falhou. Outro método seria necessário.")
        
        # Criar DataFrame
        df = pd.DataFrame(items)
        
        # Adicionar informações do cabeçalho
        df['Processo Número'] = header_info.get('processo_numero', '')
        
        return df
    
    def analyze(self, df: pd.DataFrame) -> None:
        """
        Realiza análises sobre os dados extraídos de Cavalcante.
        
        Args:
            df: DataFrame com os dados extraídos
        """
        super().analyze(df)
        
        if df is None or len(df) == 0:
            return
        
        # Agrupamento por unidade de medida
        unidades = df['Unid'].value_counts()
        print("\nQuantidade de itens por unidade de medida:")
        for unid, count in unidades.items():
            print(f"  {unid}: {count} itens")
        
        # Quantidade total de produtos
        total_produtos = df['Quant'].sum()
        print(f"\nQuantidade total de produtos: {total_produtos}")
        
        # Categorização de produtos
        # Vamos identificar categorias a partir de palavras-chave nas descrições
        categorias = {
            'Agulhas': df['Descrição'].str.contains('AGULHA', case=False).sum(),
            'Álcool': df['Descrição'].str.contains('ÁLCOOL', case=False).sum(),
            'Equipamentos': df['Descrição'].str.contains('APARELHO|EQUIPAMENTO', case=False, regex=True).sum(),
            'Produtos Hospitalares': len(df) - (df['Descrição'].str.contains('AGULHA|ÁLCOOL|APARELHO|EQUIPAMENTO', case=False, regex=True).sum())
        }
        
        print("\nCategorização de produtos:")
        for categoria, count in categorias.items():
            print(f"  {categoria}: {count} itens")
        
        # Produtos de maior quantidade
        top_quantidade = df.nlargest(3, 'Quant')
        print("\nProdutos com maiores quantidades:")
        for _, row in top_quantidade.iterrows():
            print(f"  Item {row['Item']} ({row['Descrição'][:50]}...): {row['Quant']} {row['Unid']}")


class RondoniaExtractor(Extractor):
    """
    Extrator específico para o município de Rondônia/Presidente Médici.
    """
    def extract(self) -> pd.DataFrame:
        """
        Extrai dados do edital de Rondônia/Presidente Médici.
        
        Returns:
            DataFrame com os dados extraídos
        """
        # Implementar método específico para Rondônia
        # Como não há uma implementação específica no código original, criaremos um modelo básico
        
        items = []
        
        # Padrão genérico para itens de licitação (ajustar conforme necessário)
        pattern = r'(\d+)\s+([^R\n]+)\s+(\d+)\s+([A-Z]+)\s+R\$\s*([0-9,.]+)\s+R\$\s*([0-9,.]+)'
        
        matches = re.findall(pattern, self.content)
        
        for match in matches:
            item_num = match[0].strip()
            descricao = match[1].strip()
            quantidade = match[2].strip()
            unidade = match[3].strip()
            valor_unit = match[4].strip()
            valor_total = match[5].strip()
            
            items.append({
                'ITEM': item_num,
                'DESCRIÇÃO': descricao,
                'QUANTIDADE': quantidade,
                'UNIDADE': unidade,
                'VALOR_UNITARIO': valor_unit,
                'VALOR_TOTAL': valor_total
            })
        
        return pd.DataFrame(items)


class MunicipioFactory:
    """
    Factory para criar o extrator adequado com base no município.
    """
    @staticmethod
    def get_extractor(municipio: str, input_file: str) -> Extractor:
        """
        Retorna o extrator adequado com base no município.
        
        Args:
            municipio: Nome do município (case insensitive)
            input_file: Caminho para o arquivo JSON do edital
            
        Returns:
            Instância do extrator adequado
        """
        municipio = municipio.lower()
        
        if 'cavalcante' in municipio:
            return CavalcanteExtractor(input_file)
        elif 'itumbiara' in municipio:
            return ItumbiaraExtractor(input_file)
        elif 'morrinhos' in municipio:
            return MorrinhosExtractor(input_file)
        elif 'padre bernardo' in municipio or 'padre_bernardo' in municipio:
            return PadreBernardoExtractor(input_file)
        elif 'frutal' in municipio:
            return FrutalExtractor(input_file)
        elif 'rondonia' in municipio or 'presidente medici' in municipio:
            return RondoniaExtractor(input_file)
        elif 'saoroque' in municipio or 'sao roque' in municipio:
            return SaoRoqueExtractor(input_file)
        else:
            raise ValueError(f"Município '{municipio}' não suportado ou não reconhecido")


def process_edital(municipio: str, input_file: str, output_format: str = 'csv', output_file: Optional[str] = None) -> str:
    """
    Processa um edital de licitação e salva o resultado.
    
    Args:
        municipio: Nome do município
        input_file: Caminho para o arquivo JSON do edital
        output_format: Formato de saída ('csv' ou 'excel')
        output_file: Caminho para o arquivo de saída (opcional)
        
    Returns:
        Caminho do arquivo gerado
    """
    # Se output_file não for especificado, cria um nome baseado no município
    if output_file is None:
        municipio_formatado = municipio.lower().replace(" ", "_")
        extension = 'csv' if output_format.lower() == 'csv' else 'xlsx'
        output_file = f"edital_{municipio_formatado}.{extension}"
    
    # Obter o extrator adequado para o município
    extractor = MunicipioFactory.get_extractor(municipio, input_file)
    
    # Extrair os dados
    df = extractor.extract()
    
    # Realizar análises
    extractor.analyze(df)
    
    # Salvar o resultado no formato adequado
    if output_format.lower() == 'csv':
        return extractor.save_to_csv(df, output_file)
    else:
        return extractor.save_to_excel(df, output_file)


        