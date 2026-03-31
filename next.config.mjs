/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/": ["./data/tests/**/*"],
      "/create-test": ["./data/tests/**/*"],
      "/tests/[testId]": ["./data/tests/**/*"],
      "/tests/[testId]/run": ["./data/tests/**/*"],
      "/api/question": ["./data/tests/**/*"],
      "/api/subject": ["./data/tests/**/*"],
    },
  },
};

export default nextConfig;
