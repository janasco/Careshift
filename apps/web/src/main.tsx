import { Toaster } from "@/components/ui/sonner";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./index.css";

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support unavailable — app still works */
      });
    }
  }, []);
  return null;
}

function RouteSyncer() {
  useEffect(() => {
    // Notify the platform preview shell whenever the SPA route changes.
    const pushRoute = () => {
      try {
        window.parent?.postMessage(
          { type: "iframe-route-change", route: window.location.pathname + window.location.search },
          "*",
        );
      } catch {
        /* parent unreachable (standalone) */
      }
    };
    pushRoute();
    window.addEventListener("popstate", pushRoute);

    // SPA navigations (react-router) patch history methods.
    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);
    window.history.pushState = (...args: Parameters<typeof origPush>) => {
      const res = origPush(...args);
      pushRoute();
      return res;
    };
    window.history.replaceState = (...args: Parameters<typeof origReplace>) => {
      const res = origReplace(...args);
      pushRoute();
      return res;
    };

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("popstate", pushRoute);
      window.removeEventListener("message", handleMessage);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);
  return null;
}

function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const configured = import.meta.env.VITE_API_URL as string | undefined;
    const base = configured
      ? configured.replace(/^http/, "ws").replace(/\/$/, "")
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(`${base}/api/realtime?workspace=default`);
      socket.onmessage = () => {
        void queryClient.invalidateQueries();
      };
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [queryClient]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ServiceWorkerRegistration />
          <RouteSyncer />
          <RealtimeSync />
          <App />
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
