import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  define: {
    // Define environment variables for the app
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
