FROM ghcr.io/swiss-digital-assets-institute/nodejs:main

ENV NODE_ENV production

ARG UID=1000

RUN useradd --home /node --no-log-init --create-home -Uu ${UID} -s /bin/bash node && \
  mkdir /app && \
  chown -R node:node /app

RUN microdnf install --nodocs -y \
        wget \
        make \
        g++ \
        python3 && \
    rm -rf /var/lib/apt/lists/*


ENV LANG=C.UTF-8 NODE_OPTIONS=--max_old_space_size=4096
WORKDIR /app

COPY --chown=node:node package*.json lerna.json /app/
COPY --chown=node:node ./packages/ /app/packages/

RUN npm ci -q --omit=dev --ignore-scripts && \
    npm cache clean --force --loglevel=error

RUN npm run setup && \
    npm install pnpm && \
    npm run build

USER node 
WORKDIR /app

CMD ["npm", "run", "start"]
