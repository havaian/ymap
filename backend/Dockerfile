# Use a specific version for reproducibility
FROM node:24-alpine

# Set the working directory
WORKDIR /app

# Create a system group and user
RUN addgroup -S nodeapp && adduser -S -G nodeapp nodeapp

# Create necessary directories and set ownership BEFORE switching users
# We create 'uploads' and 'node_modules' to ensure permissions are correct
RUN mkdir -p /app/uploads /app/node_modules && \
    chown -R nodeapp:nodeapp /app

# Copy package files with correct ownership
COPY --chown=nodeapp:nodeapp package*.json ./

# Switch to the non-root user
USER nodeapp

# Install dependencies (runs as nodeapp)
# npm ci is perfect for production environments
RUN npm ci --only=production

# Copy source code (keeping ownership consistent)
COPY --chown=nodeapp:nodeapp src ./src

# Expose the application port
EXPOSE 4000

# Use the production node environment
ENV NODE_ENV=production

CMD ["node", "src/index.js"]