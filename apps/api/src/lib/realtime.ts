import type { Bindings } from "../env";

export type WorkspaceEvent = {
  type: string;
  entity?: string;
  action?: string;
  id?: string;
  at: number;
};

export async function broadcastWorkspace(
  env: Bindings,
  event: WorkspaceEvent,
  workspace = "default",
) {
  try {
    const id = env.WORKSPACE_ROOM.idFromName(workspace);
    await env.WORKSPACE_ROOM.get(id).fetch("https://room/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error("Realtime broadcast failed", error);
  }
}
