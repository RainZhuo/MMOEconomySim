import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter '' ensures we load all variables, including VITE_API_KEY.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Explicitly substitute process.env.API_KEY with the value from .env
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      // Polyfill process.env for other libraries that might access it
      'process.env': {} 
    }
  };
});