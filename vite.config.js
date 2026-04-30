import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // 配置代理以支持流式响应
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
              // 对于 SSE 请求，设置特殊的超时和缓冲配置
              req.socket.setTimeout(0);
              req.socket.setNoDelay(true);
            }
          });
        }
      }
    }
  }
})
