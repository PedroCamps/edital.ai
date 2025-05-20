import styles from "../page.module.css";

export default function Tabs({ selectedTab }: { selectedTab: number }) {
	return (
		<>
			<div
				className={`${styles.tabContent} ${
					selectedTab == 0 ? styles.active : ""
				}`}
				id="chatTab"
			>
				<div className={styles.card}>
					<div className={styles.cardHeader}>
						Assistente de Consulta
					</div>
					<div className={styles.cardBody}>
						<div className={styles.chatContainer}>
							<div
								className={styles.chatMessages}
								id="chatMessages"
							>
								<div
									className={`${styles.message} ${styles.system}`}
								>
									Olá! Eu sou seu assistente para análise de
									editais. Após o processamento do PDF, você
									poderá me fazer perguntas sobre o conteúdo.
								</div>
							</div>
							<div className={styles.chatInput}>
								<input
									type="text"
									id="chatInput"
									placeholder="Digite sua pergunta..."
								/>
								<button
									className={`${styles.btn} ${styles.btnPrimary}`}
									id="sendButton"
									disabled
								>
									Enviar
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div
				className={`${styles.tabContent} ${
					selectedTab == 1 ? styles.active : ""
				}`}
				id="dashboardTab"
			>
				<div className={styles.dashboard}>
					<div className={styles.dashboardCard}>
						<h3>Total de Arquivos</h3>
						<div className={styles.value} id="totalFiles">
							0
						</div>
						<div className={styles.description}>
							Arquivos processados
						</div>
					</div>

					<div className={styles.dashboardCard}>
						<h3>Tabelas Extraídas</h3>
						<div className={styles.value} id="tablesExtracted">
							0
						</div>
						<div className={styles.description}>
							Total de tabelas encontradas
						</div>
					</div>

					<div className={styles.dashboardCard}>
						<h3>Tempo de Processamento</h3>
						<div className={styles.value} id="processingTime">
							0s
						</div>
						<div className={styles.description}>
							Tempo total de processamento
						</div>
					</div>

					<div className={styles.dashboardCard}>
						<h3>Taxa de Sucesso</h3>
						<div className={styles.value} id="successRate">
							0%
						</div>
						<div className={styles.description}>
							Arquivos processados com sucesso
						</div>
					</div>
				</div>

				<div className={styles.card} style={{ marginTop: "1.5rem" }}>
					<div className={styles.cardHeader}>
						Estatísticas de Processamento
					</div>
					<div className={styles.cardBody}>
						<div id="chartContainer" style={{ height: "300px" }}>
							{/* <!-- Chart will be displayed here --> */}
							<div
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
									color: "var(-Secondary)",
								}}
							>
								Carregando estatísticas...
							</div>
						</div>
					</div>
				</div>
			</div>

			<div
				className={`${styles.tabContent} ${
					selectedTab == 2 ? styles.active : ""
				}`}
				id="resultsTab"
			>
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
										<th>Ações</th>
									</tr>
								</thead>
								<tbody id="resultsTable">
									{/* <!-- Results will be displayed here --> */}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
