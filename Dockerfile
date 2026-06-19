# --- Етап 1: Збірка React Фронтенду ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Змінено шляхи копіювання:
COPY package*.json ./
RUN npm install
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build
# --- Етап 2: Фінальний образ з Node.js сервером ---
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./

# Переносимо зібрану статику у відповідну папку сервера
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
ENV NODE_ENV=production

CMD ["node", "server.js"]