// Compatibility entry point. Process management is provided externally.
require('./src/app')
  .main()
  .catch((e) => {
    console.error(JSON.stringify(require('./src/startup-error').startupFailure(e)));
    process.exitCode = 1;
  });
