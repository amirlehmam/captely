# Dockerfile
FROM node:18-alpine
WORKDIR /src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "-H", "0.0.0.0"]
