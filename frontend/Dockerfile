# FROM node:22.20.0-alpine

# WORKDIR /app
# # Installation of dependencies
# COPY package*.json ./
# RUN npm install

# COPY . .

# # Build Angular app
# RUN npm run build --prod

# EXPOSE 4200

# # Run Angular dev server (for development)
# CMD ["npm", "start"]

# frontend/Dockerfile
FROM node:22.20.0-bullseye

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4200

CMD ["node_modules/.bin/ng", "serve", "--host", "0.0.0.0", "--port", "4200"]
