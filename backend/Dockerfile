FROM node:22-alpine

WORKDIR /app

# Primero copiamos el esquema de Prisma (necesario para el cliente en el backend)
COPY database/prisma ./database/prisma

WORKDIR /app/backend

# Copiamos package.json y package-lock.json (si existe)
COPY backend/package*.json ./

# Instalamos dependencias
RUN npm ci

# Copiamos el resto del código del backend
COPY backend/ ./

# Generamos el Prisma Client
RUN npm run prisma:generate

# Compilamos la aplicación NestJS
RUN npm run build

# Exponemos el puerto que usa NestJS internamente (por defecto suele ser 3000)
EXPOSE 3000

# Comando para ejecutar la app
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../database/prisma/schema.prisma && node dist/src/main"]
