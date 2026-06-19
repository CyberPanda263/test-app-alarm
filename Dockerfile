# --- Етап 1: Збірка React Фронтенду ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Копіюємо файли з папки frontend/ хоста в /app/frontend/ контейнера
COPY frontend/package*.json ./
RUN npm install

# Копіюємо решту файлів фронтенду
COPY frontend/vite.config.js ./
COPY frontend/index.html ./
COPY frontend/src/ ./src/

RUN npm run build

# --- Етап 2: Фінальний образ з Node.js сервером ---
FROM node:20-alpine
WORKDIR /app

# Копіюємо файли бекенду з кореня
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./

# Переносимо зібрану статику з першого етапу
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
ENV NODE_ENV=production

CMD ["node", "server.js"]