// Compatibility entry point. Process management is provided externally.
require('./src/app')
  .main()
  .catch((e) => {
    console.error(
      JSON.stringify({ event: 'startup_failed', code: e.code || 'CONFIG_OR_LOCAL_STORAGE_ERROR' }),
    );
    process.exitCode = 1;
  });
