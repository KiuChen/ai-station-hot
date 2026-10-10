import { redirect } from "react-router";
import { channelForPath, channelPath } from "@aihot/industry/channels";

// Open the source list of the current channel after signing in.
export function loader({ request }: { request: Request }) {
  const channel = channelForPath(new URL(request.url).pathname);
  throw redirect(channelPath("/admin/sources", channel.key));
}

export default function AdminIndex() {
  return null;
}
