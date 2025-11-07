FROM node:20-alpine
WORKDIR /app

# Solo instala prod deps
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
# o, para ver el motivo exacto en el log:
# RUN npm ci --omit=dev || (echo "---- NPM LOG ----" && cat /root/.npm/_logs/*-debug-0.log && exit 1)

# Código
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]