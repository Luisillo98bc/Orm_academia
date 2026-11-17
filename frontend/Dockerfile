FROM node:22-alpine

WORKDIR /app

# Argumento de build para la URL del API (se incrusta en el bundle de Next.js)
ARG NEXT_PUBLIC_API_URL=http://localhost:3003/api/v1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3002
ARG NEXT_PUBLIC_WS_URL=http://localhost:3003
ARG NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_configure_me
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_CULQI_PUBLIC_KEY=$NEXT_PUBLIC_CULQI_PUBLIC_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Copiamos package.json y package-lock.json
COPY package*.json ./

# Instalamos dependencias
RUN npm ci

# Copiamos el resto del código
COPY . .

# Construimos la aplicación de Next.js (NEXT_PUBLIC_* se incrusta aquí)
RUN npm run build

# Exponemos el puerto de Next.js
EXPOSE 3000

# Comando para iniciar la aplicación en modo producción
CMD ["npm", "run", "start"]
