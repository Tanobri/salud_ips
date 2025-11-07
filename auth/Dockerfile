FROM node:20-alpine
WORKDIR /app

# Solo instala prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# Código
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]