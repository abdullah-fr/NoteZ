import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const getApiKey = (keyName: string) =>
    env[keyName] ||
    env[`VITE_${keyName}`] ||
    process.env[keyName] ||
    process.env[`VITE_${keyName}`] ||
    '';

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api/generate-ai-exam': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => {
            const key = getApiKey('GEMINI_EXAM_API_KEY');
            return `/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
          },
        },
        '/api/generate-ai-flashcards': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => {
            const key = getApiKey('GEMINI_FLASHCARDS_API_KEY');
            return `/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
          },
        },
        '/api/editor-ai-assist': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => {
            const key = getApiKey('GEMINI_AI_ASSIST_API_KEY');
            return `/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
          },
        },
        '/api/generate-activities-from-doc': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => {
            const key = getApiKey('GEMINI_ACTIVITIES_API_KEY');
            return `/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
          },
        },
        '/api/ai-chat-proxy': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => {
            const key = getApiKey('GEMINI_CHAT_API_KEY');
            return `/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
