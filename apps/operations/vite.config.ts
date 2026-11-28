import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    ...federation({
      name: "operations",
      filename: "remoteEntry.js",
      exposes: {
        "./OperationsDesk": "./src/OperationsDesk.tsx",
      },
      shared: {
        react: { singleton: true, requiredVersion: "18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "18.3.1" },
      },
      bundleAllCSS: true,
      dts: false,
    }),
    react(),
  ],
  server: {
    port: 5174,
    strictPort: true,
    host: "0.0.0.0",
    origin: "http://localhost:5174",
    cors: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
    host: "0.0.0.0",
    cors: true,
  },
  build: {
    target: "chrome89",
  },
});
