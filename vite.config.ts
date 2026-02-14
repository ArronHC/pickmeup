import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.VITE_GH_AI_KEY': JSON.stringify(env.VITE_GH_AI_KEY),
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
      'process.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'import.meta.env.VITE_GH_AI_KEY': JSON.stringify(env.VITE_GH_AI_KEY),
      'import.meta.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
