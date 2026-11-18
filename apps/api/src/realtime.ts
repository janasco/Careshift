export class WorkspaceRoom {
  private sockets = new Set<WebSocket>();

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    this.sockets.add(server);

    const remove = () => this.sockets.delete(server);
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);

    server.addEventListener("message", (event) => {
      for (const socket of this.sockets) {
        try {
          socket.send(event.data);
        } catch {
          this.sockets.delete(socket);
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
