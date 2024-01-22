'use strict';
module.exports = {
    'forbid-only': Boolean(process.env.CI),
    color: true,
    'fail-zero': Boolean(process.env.CI),
    reporter: "mocha-multi-reporters",
    'reporter-options': `configFile=${__filename}`,
    'reporterEnabled': "spec, mocha-junit-reporter",
    "mochaJunitReporterReporterOptions": {
        "mochaFile": `${__dirname}/test-results.[hash].xml`,
        "includePending": true,
        "outputs": true
    },
};
