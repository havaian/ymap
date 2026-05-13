FROM node:24-alpine

WORKDIR /app
RUN addgroup -S nodeapp && adduser -S -G nodeapp nodeapp

# Copy package files
COPY --chown=nodeapp:nodeapp package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY --chown=nodeapp:nodeapp src ./src
USER nodeapp

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["node", "src/index.js"]