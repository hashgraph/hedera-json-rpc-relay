'use strict';
module.exports = {
    'forbid-only': Boolean(process.env.CI),
    color: true,
    'fail-zero': Boolean(process.env.CI),
    reporter: "mocha-multi-reporters",
    'reporter-options': "configFile=.mocharc.js",
    'reporterEnabled': "spec, mocha-junit-reporter",
    "mochaJunitReporterReporterOptions": {
        "mochaFile": "test-results.[hash].xml",
        "includePending": true,
        "outputs": true
    },
};
