import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";

export interface ConnectedUser {
  id: string;
  name: string;
  email: string;
  role: "operator" | "approver" | "client" | "engineer";
  avatarColor: string;
  activeTab?: string;
  activeField?: string;
  statusMessage?: string;
  joinedAt: string;
  lastSeen: number;
}

interface ClientConnection {
  ws: WebSocket;
  user: ConnectedUser;
  projectId?: string;
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  // projectId -> Set of WebSockets
  private rooms: Map<string, Set<WebSocket>> = new Map();

  public init(httpServer: HttpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: "/ws"
    });

    this.wss.on("connection", (ws: WebSocket) => {
      // Default connection state
      const defaultUser: ConnectedUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: "Anonymous Operator",
        email: "operator@808szn.com",
        role: "operator",
        avatarColor: "#a3e635",
        joinedAt: new Date().toISOString(),
        lastSeen: Date.now()
      };

      this.clients.set(ws, { ws, user: defaultUser });

      ws.on("message", (raw: string) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch (err) {
          console.warn("[WS Parse Error]:", err);
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (err) => {
        console.warn("[WS Socket Error]:", err);
        this.handleDisconnect(ws);
      });

      // Send initial hello
      this.send(ws, {
        type: "connection:ready",
        serverTime: new Date().toISOString(),
        protocol: "808-MATRIX-REALTIME-v1"
      });
    });

    // Heartbeat cleanup every 15s
    setInterval(() => {
      const now = Date.now();
      for (const [ws, conn] of this.clients.entries()) {
        if (now - conn.user.lastSeen > 60000) {
          try {
            ws.terminate();
          } catch (e) {}
          this.handleDisconnect(ws);
        }
      }
    }, 15000);

    console.log("⚡ [Realtime Hub] WebSocket server mounted on /ws (authoritative broadcast engine)");
  }

  private handleMessage(ws: WebSocket, msg: any) {
    const conn = this.clients.get(ws);
    if (!conn) return;

    conn.user.lastSeen = Date.now();

    switch (msg.type) {
      case "join": {
        const { projectId, user, activeTab, activeField } = msg;
        if (!projectId) return;

        // Leave previous room if any
        if (conn.projectId && conn.projectId !== projectId) {
          this.leaveRoom(ws, conn.projectId);
        }

        conn.projectId = projectId;
        if (user) {
          conn.user = {
            ...conn.user,
            ...user,
            activeTab: activeTab || "overview",
            activeField: activeField || undefined,
            lastSeen: Date.now()
          };
        }

        this.joinRoom(ws, projectId);
        this.broadcastRoomPresence(projectId);
        break;
      }

      case "leave": {
        const { projectId } = msg;
        if (projectId) {
          this.leaveRoom(ws, projectId);
          conn.projectId = undefined;
          this.broadcastRoomPresence(projectId);
        }
        break;
      }

      case "presence:update": {
        const { activeTab, activeField, statusMessage } = msg;
        conn.user.activeTab = activeTab ?? conn.user.activeTab;
        conn.user.activeField = activeField;
        conn.user.statusMessage = statusMessage;
        conn.user.lastSeen = Date.now();

        if (conn.projectId) {
          this.broadcastRoomPresence(conn.projectId);
        }
        break;
      }

      case "ping": {
        this.send(ws, { type: "pong", timestamp: Date.now() });
        break;
      }

      default:
        break;
    }
  }

  private joinRoom(ws: WebSocket, projectId: string) {
    if (!this.rooms.has(projectId)) {
      this.rooms.set(projectId, new Set());
    }
    this.rooms.get(projectId)!.add(ws);

    // Notify user of immediate sync
    this.broadcastRoomPresence(projectId);
  }

  private leaveRoom(ws: WebSocket, projectId: string) {
    const room = this.rooms.get(projectId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(projectId);
      }
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const conn = this.clients.get(ws);
    if (conn) {
      if (conn.projectId) {
        this.leaveRoom(ws, conn.projectId);
        this.broadcastRoomPresence(conn.projectId);
      }
      this.clients.delete(ws);
    }
  }

  private send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  public broadcastRoomPresence(projectId: string) {
    const room = this.rooms.get(projectId);
    if (!room) return;

    const viewers: ConnectedUser[] = [];
    for (const ws of room) {
      const conn = this.clients.get(ws);
      if (conn && conn.user) {
        viewers.push(conn.user);
      }
    }

    const payload = {
      type: "presence:sync",
      projectId,
      viewers,
      viewerCount: viewers.length,
      timestamp: new Date().toISOString()
    };

    for (const ws of room) {
      this.send(ws, payload);
    }
  }

  public broadcastProjectUpdate(projectId: string, project: any, eventLog?: any) {
    const room = this.rooms.get(projectId);
    const payload = {
      type: "project:updated",
      projectId,
      project,
      eventLog,
      timestamp: new Date().toISOString()
    };

    // Also broadcast to global listeners if any
    if (room) {
      for (const ws of room) {
        this.send(ws, payload);
      }
    }

    // Broadcast globally to users on dashboard
    for (const [ws, conn] of this.clients.entries()) {
      if (!conn.projectId || conn.projectId === "global") {
        this.send(ws, {
          type: "project:list_updated",
          projectId,
          title: project.title,
          state: project.state,
          revision: project.revision,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public broadcastProjectEvent(projectId: string, event: any) {
    const room = this.rooms.get(projectId);
    if (!room) return;

    const payload = {
      type: "event:created",
      projectId,
      event,
      timestamp: new Date().toISOString()
    };

    for (const ws of room) {
      this.send(ws, payload);
    }
  }
}

export const realtimeHub = new RealtimeHub();
