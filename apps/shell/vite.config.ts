import { federation } from "@module-federation/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const operationsEntry = process.env.OPERATIONS_ENTRY ?? "http://localhost:5174/remoteEntry.js";

export default defineConfig({
  plugins: [
    ...federation({
      name: "shell",
      remotes: {
        operations: {
          type: "module",
          name: "operations",
          entry: operationsEntry,
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: "18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "18.3.1" },
      },
      dts: false,
    }),
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    origin: "http://localhost:5173",
    cors: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    cors: true,
  },
  build: {
    target: "chrome89",
  },
});
