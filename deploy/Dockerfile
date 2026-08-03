FROM node:18-alpine

WORKDIR /app

# Копируем зависимости
COPY backend/package*.json ./
RUN npm install --production

# Копируем весь код
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY config/ ./config/

# Создаём папки для данных
RUN mkdir -p backend/db

# Генерируем ключ шифрования при старте
RUN echo '#!/bin/sh\n\
if [ ! -f config/encryption.key ]; then\n\
    openssl rand -base64 32 > config/encryption.key\n\
fi\n\
node backend/server.js' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]
