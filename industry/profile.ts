import { CHANNELS, type EditorialChannel } from "./channels.ts";
const key = typeof process !== "undefined" ? process.env.INDUSTRY_PROFILE : undefined;
if (key && !CHANNELS.some(c => c.key === key)) throw new Error("Unknown INDUSTRY_PROFILE");
export const PROFILE_KEY: EditorialChannel = (key as EditorialChannel | undefined) ?? "ai";
export const PROFILE = CHANNELS.find(c => c.key === PROFILE_KEY)!;
export const PROFILE_DIRECTORY = PROFILE_KEY === "ai" ? "industry" : `industry/profiles/${PROFILE_KEY}`;
