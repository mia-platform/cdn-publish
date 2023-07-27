/** @type {import('mocha').MochaOptions} */
module.exports = {
  "node-option": [
    "no-warnings",
    "experimental-specifier-resolution=node",
    "loader=ts-node/esm",
  ],
  file: ["tests/setup.ts"],
  timeout: 30000,
};
