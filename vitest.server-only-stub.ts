// Stub for 'server-only' package in vitest test environment
// The real package throws at import time to prevent client-side usage,
// but in tests we want to allow importing server modules directly.
export {}
