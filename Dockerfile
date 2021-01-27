FROM node:latest

RUN mkdir -p /app

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
