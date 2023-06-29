/** @type {import('mocha').MochaOptions} */
module.exports = {
  "node-option": [
    "experimental-specifier-resolution=node",
    "loader=ts-node/esm",
  ],
  file: ["tests/setup.ts"],
  timeout: 5000,
};
