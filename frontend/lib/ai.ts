import { createGateway } from '@ai-sdk/gateway';

// Initialize Vercel AI Gateway
export const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// Default model for most operations (fast)
export const gemini = gateway('google/gemini-2.5-flash');

// Model for complex reasoning tasks
export const geminiPro = gateway('google/gemini-3-pro-preview');
