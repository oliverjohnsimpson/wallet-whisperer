import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy server/.env.example to server/.env and fill it in.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: required("OPENAI_API_KEY"),
  chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o",
  visionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
};
