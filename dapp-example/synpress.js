const { defineConfig } = require('cypress');
const path = require('path');
const synpressPath = path.dirname(require.resolve('@synthetixio/synpress'));

module.exports = defineConfig({
  userAgent: 'synpress',
  fixturesFolder: `${synpressPath}/fixtures`,
  screenshotsFolder: 'screenshots',
  videosFolder: 'videos',
  chromeWebSecurity: true,
  viewportWidth: 1280,
  viewportHeight: 1024,
  video: false,
  screenshotOnRunFailure: false,
  defaultCommandTimeout: 180000,
  pageLoadTimeout: 40000,
  requestTimeout: 40000,
  responseTimeout: 50000,
  taskTimeout: 60000,
  env: {
    coverage: false
  },
  retries: {
    runMode: 3,
    openMode: 0
  },
  e2e: {
    setupNodeEvents: require(`${synpressPath}/plugins/index`),
    baseUrl: 'http://localhost:3000',
    specPattern: 'tests/e2e/specs/**/*.{js,jsx,ts,tsx}',
    supportFile: 'tests/e2e/support.js'
  }
});
