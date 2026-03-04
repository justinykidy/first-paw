import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite build config for Fancy Chess SPA.
export default defineConfig({
  plugins: [react()],
});
