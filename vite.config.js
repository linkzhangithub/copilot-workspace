import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            if (
              req.headers.accept &&
              req.headers.accept.includes("text/event-stream")
            ) {
              req.socket.setTimeout(0);
              req.socket.setNoDelay(true);
            }
          });
        },
      },
    },
  },
});
