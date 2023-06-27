FROM node:18.16.0-bullseye-slim

# Setup
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV production
ENV HEALTHCHECK_PORT 7546

EXPOSE 7546
EXPOSE 8546
EXPOSE 8547

HEALTHCHECK --interval=10s --retries=3 --start-period=25s --timeout=2s CMD wget -q -O- http://localhost:${HEALTHCHECK_PORT}/health/liveness
WORKDIR /home/node/app/

# Install and Build
COPY package*.json ./
COPY lerna.json ./
COPY --chown=node:node ./packages ./packages
RUN apt-get update && \
    apt-get install --no-install-recommends build-essential -y wget make g++ python3 && \
    npm ci --only=production --ignore-scripts && \
    npm cache clean --force --loglevel=error && \
    chown -R node:node . && \
    rm -rf /var/lib/apt/lists/*

RUN npm install pnpm
RUN npm run build

# Install OS updates
RUN apt-get update && \
    apt-get upgrade -y --no-install-recommends && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

USER node

# Run
ENTRYPOINT ["npm", "run"]
CMD ["start"]
