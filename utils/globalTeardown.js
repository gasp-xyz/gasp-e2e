module.exports = async function (globalConfig, projectConfig) {
  // eslint-disable-next-line no-undef
  await globalThis.server.stop();
};
