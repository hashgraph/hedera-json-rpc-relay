FROM node:22-bullseye

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /home/node/app/

COPY --chown=node:node ./ ./

RUN apt-get update && \
    apt-get upgrade -y --no-install-recommends && \
    apt-get autoremove -y && \
    apt-get install --no-install-recommends build-essential -y wget make g++ python3 && \
    npm ci --only=production --ignore-scripts && \
    npm cache clean --force --loglevel=error && \
    chown -R node:node . && \
    rm -rf /var/lib/apt/lists/*

USER node

RUN npm install
RUN npx hardhat compile
