FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --ignore-scripts

COPY . .

CMD ["npm", "start"]
