import { CHANNELS, type EditorialChannel } from "@aihot/industry/channels";
export function channelApiBase(key: EditorialChannel): string {
  if (key === "ai") return process.env.API_BASE_URL || "http://127.0.0.1:3001";
  const profile = CHANNELS.find(channel => channel.key === key)!;
  return process.env[`CHANNEL_API_BASE_${key.toUpperCase()}`] || `http://127.0.0.1:${profile.apiPort}`;
}
