FROM node:18-alpine

WORKDIR /app

# Instalar dependencias de compilación para sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY seed.js ./

# Directorios persistentes (se montan como volúmenes)
RUN mkdir -p /app/uploads /app/data

EXPOSE 3000 8083 1883

CMD ["node", "src/index.js"]
