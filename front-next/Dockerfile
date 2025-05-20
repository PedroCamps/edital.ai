# 1) Imagem base
FROM node:20

# 2) Define diretório de trabalho
WORKDIR /app

# 3) Copia apenas package.json primeiro
COPY package.json ./

# 4) Instala todas as dependências (incluindo dev)
RUN npm install

# 5) Copia todo o código da aplicação
COPY . .

# 6) Expõe a porta
EXPOSE 3000

# 7) Comando para iniciar a aplicação em desenvolvimento
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
