import 'dotenv/config';
import { z } from 'zod';

// Validate configuration once at startup so a missing secret fails loudly
// instead of causing confusing errors later.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  LLM_PROVIDER: z.enum(['openrouter', 'gemini', 'anthropic', 'none']).default('none'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-haiku-5.5'),
  GEMINI_API_KEY: z.string().optional(),
  // gemini-2.5-flash is no longer offered to new API projects.
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-5-5'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
