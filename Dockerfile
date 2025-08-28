FROM node:22.17.1-alpine3.22
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm install -g pm2
COPY . .
CMD ["pm2-runtime", "src/app.js", "--node-args=--experimental-specifier-resolution=node"]