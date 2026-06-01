/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TS — let Next transpile them.
  transpilePackages: ["@jobagent/shared", "@jobagent/core", "@jobagent/db", "@jobagent/inbox", "@jobagent/google"],
  experimental: {
    // pg + googleapis are server-only deps; never bundle them for the client.
    serverComponentsExternalPackages: ["pg", "googleapis"],
  },
};

export default nextConfig;
