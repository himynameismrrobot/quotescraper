/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Add polyfills for node: modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "async_hooks": false,
      "fs": false,
      "net": false,
      "tls": false,
      "util": require.resolve("util/"),
      "events": require.resolve("events/"),
      "stream": require.resolve("stream-browserify"),
      "zlib": require.resolve("browserify-zlib"),
      "buffer": require.resolve("buffer/"),
      "path": false,
      "crypto": false,
    };

    if (!isServer) {
      // Fixes npm packages that depend on `stream` module
      config.resolve.alias = {
        ...config.resolve.alias,
        stream: 'stream-browserify',
      };
    }

    return config;
  },
}

module.exports = nextConfig
