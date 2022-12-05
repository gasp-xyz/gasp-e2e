module.exports = async function(globalConfig, projectConfig) {
  console.error("it was executed")
  // eslint-disable-next-line no-undef
  await globalThis.server.stop();
  await globalThis.api.disconnect();
};
