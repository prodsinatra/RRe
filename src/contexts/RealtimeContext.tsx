import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { PresenceUser, ReadinessProject } from "../types";
import { useAuth } from "./AuthContext";

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "reconnecting";

interface RealtimeContextType {
  status: ConnectionStatus;
  latencyMs: number;
  viewers: PresenceUser[];
  activeRoomId: string | null;
  joinRoom: (projectId: string, activeTab?: string) => void;
  leaveRoom: () => void;
  updatePresence: (activeTab?: string, activeField?: string, statusMessage?: string) => void;
  subscribeToProject: (projectId: string, cb: (project: ReadinessProject, eventLog?: any) => void) => () => void;
  subscribeToEvents: (projectId: string, cb: (event: any) => void) => () => void;
  subscribeToPresence: (cb: (viewers: PresenceUser[]) => void) => () => void;
  subscribeToProjectList: (cb: (update: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const lastPingTimeRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);

  // Callbacks registries
  const projectSubscribersRef = useRef<Map<string, Set<(project: ReadinessProject, eventLog?: any) => void>>>(new Map());
  const eventSubscribersRef = useRef<Map<string, Set<(event: any) => void>>>(new Map());
  const presenceSubscribersRef = useRef<Set<(viewers: PresenceUser[]) => void>>(new Set());
  const projectListSubscribersRef = useRef<Set<(update: any) => void>>(new Set());

  const currentTabRef = useRef<string>("overview");
  const currentFieldRef = useRef<string | undefined>(undefined);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      setStatus("connecting");

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        // If room is active, re-join
        if (activeRoomId && user) {
          ws.send(JSON.stringify({
            type: "join",
            projectId: activeRoomId,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              avatarColor: user.avatarColor
            },
            activeTab: currentTabRef.current,
            activeField: currentFieldRef.current
          }));
        }

        // Start ping loop
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            lastPingTimeRef.current = performance.now();
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleIncomingMessage(msg);
        } catch (e) {
          console.warn("[WS Client Parse Error]:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Attempt reconnection
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          setStatus("reconnecting");
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn("[WS Client Error]:", err);
        ws.close();
      };
    } catch (err) {
      console.error("[WS Init Error]:", err);
      setStatus("disconnected");
    }
  }, [activeRoomId, user]);

  const handleIncomingMessage = (msg: any) => {
    switch (msg.type) {
      case "pong": {
        const roundTrip = Math.round(performance.now() - lastPingTimeRef.current);
        setLatencyMs(roundTrip > 0 ? roundTrip : 8);
        break;
      }

      case "presence:sync": {
        if (msg.viewers) {
          setViewers(msg.viewers);
          presenceSubscribersRef.current.forEach((cb) => cb(msg.viewers));
        }
        break;
      }

      case "project:updated": {
        const { projectId, project, eventLog } = msg;
        const subs = projectSubscribersRef.current.get(projectId);
        if (subs) {
          subs.forEach((cb) => cb(project, eventLog));
        }
        break;
      }

      case "event:created": {
        const { projectId, event } = msg;
        const subs = eventSubscribersRef.current.get(projectId);
        if (subs) {
          subs.forEach((cb) => cb(event));
        }
        break;
      }

      case "project:list_updated": {
        projectListSubscribersRef.current.forEach((cb) => cb(msg));
        break;
      }

      default:
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // When user persona / role changes, broadcast immediately
  useEffect(() => {
    if (user && activeRoomId && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "join",
        projectId: activeRoomId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarColor: user.avatarColor
        },
        activeTab: currentTabRef.current,
        activeField: currentFieldRef.current
      }));
    }
  }, [user, activeRoomId]);

  const joinRoom = useCallback((projectId: string, activeTab?: string) => {
    setActiveRoomId(projectId);
    if (activeTab) currentTabRef.current = activeTab;

    if (socketRef.current?.readyState === WebSocket.OPEN && user) {
      socketRef.current.send(JSON.stringify({
        type: "join",
        projectId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarColor: user.avatarColor
        },
        activeTab: currentTabRef.current,
        activeField: currentFieldRef.current
      }));
    }
  }, [user]);

  const leaveRoom = useCallback(() => {
    if (activeRoomId && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "leave",
        projectId: activeRoomId
      }));
    }
    setActiveRoomId(null);
    setViewers([]);
  }, [activeRoomId]);

  const updatePresence = useCallback((activeTab?: string, activeField?: string, statusMessage?: string) => {
    if (activeTab) currentTabRef.current = activeTab;
    currentFieldRef.current = activeField;

    if (socketRef.current?.readyState === WebSocket.OPEN && activeRoomId) {
      socketRef.current.send(JSON.stringify({
        type: "presence:update",
        activeTab: currentTabRef.current,
        activeField,
        statusMessage
      }));
    }
  }, [activeRoomId]);

  const subscribeToProject = useCallback((projectId: string, cb: (project: ReadinessProject, eventLog?: any) => void) => {
    if (!projectSubscribersRef.current.has(projectId)) {
      projectSubscribersRef.current.set(projectId, new Set());
    }
    projectSubscribersRef.current.get(projectId)!.add(cb);

    return () => {
      const subs = projectSubscribersRef.current.get(projectId);
      if (subs) {
        subs.delete(cb);
        if (subs.size === 0) {
          projectSubscribersRef.current.delete(projectId);
        }
      }
    };
  }, []);

  const subscribeToEvents = useCallback((projectId: string, cb: (event: any) => void) => {
    if (!eventSubscribersRef.current.has(projectId)) {
      eventSubscribersRef.current.set(projectId, new Set());
    }
    eventSubscribersRef.current.get(projectId)!.add(cb);

    return () => {
      const subs = eventSubscribersRef.current.get(projectId);
      if (subs) {
        subs.delete(cb);
        if (subs.size === 0) {
          eventSubscribersRef.current.delete(projectId);
        }
      }
    };
  }, []);

  const subscribeToPresence = useCallback((cb: (viewers: PresenceUser[]) => void) => {
    presenceSubscribersRef.current.add(cb);
    return () => {
      presenceSubscribersRef.current.delete(cb);
    };
  }, []);

  const subscribeToProjectList = useCallback((cb: (update: any) => void) => {
    projectListSubscribersRef.current.add(cb);
    return () => {
      projectListSubscribersRef.current.delete(cb);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        latencyMs,
        viewers,
        activeRoomId,
        joinRoom,
        leaveRoom,
        updatePresence,
        subscribeToProject,
        subscribeToEvents,
        subscribeToPresence,
        subscribeToProjectList
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return ctx;
};
