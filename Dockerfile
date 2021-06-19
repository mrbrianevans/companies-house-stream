FROM node:16-slim

RUN mkdir -p /app

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm i

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
