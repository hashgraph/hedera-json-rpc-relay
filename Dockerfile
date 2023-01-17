FROM node:18-alpine
RUN apk update && apk add g++ make py3-pip

# Setup
ENV NODE_ENV production
EXPOSE 7546
HEALTHCHECK --interval=10s --retries=3 --start-period=25s --timeout=2s CMD wget -q -O- http://localhost:7546/health/liveness
WORKDIR /home/node/app/
RUN chown -R node:node .
COPY --chown=node:node . ./
USER node

# Build
RUN npm ci --only=production && npm cache clean --force --loglevel=error
RUN npm run setup
RUN npm install pnpm
RUN npm run build

# Run
ENTRYPOINT ["npm", "run", "start"]
