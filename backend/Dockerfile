FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["node", "src/index.js"]