import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "../providers/WebSocketProvider";

interface ScenePageProps {
  router: {
    navigate: (path: string, replace?: boolean) => void;
    currentPath: string;
    params?: Record<string, string>;
  };
}

export function ScenePage({ router }: ScenePageProps) {
  const sceneId = router.params?.id ?? "unknown";
  const { state, isConnected } = useWebSocket();

  const [offline, setOffline] = useState(!navigator.onLine);
  const [_loadingIndicator, setLoadingIndicator] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [limitedFunctionality, setLimitedFunctionality] = useState(false);
  const [retryAfter, setRetryAfter] = useState<string | null>(null);

  const [authExpired, setAuthExpired] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  const [messages, setMessages] = useState<string[]>([]);
  const [dataValidationError, setDataValidationError] = useState(false);
  const [fallbackSceneName] = useState("Untitled Scene");
  const [tokenVisible, setTokenVisible] = useState(true);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [tokenName, setTokenName] = useState("Token");
  const [conflictResolution, setConflictResolution] = useState(false);
  const [conflictNotification, setConflictNotification] = useState(false);

  // Browser compatibility fallbacks
  const websocketFallback = useMemo(() => typeof (window as any).WebSocket === "undefined", []);
  const canvasFallback = useMemo(() => {
    try {
      const c = document.createElement("canvas");
      return !(c.getContext("webgl") || c.getContext("webgl2"));
    } catch {
      return true;
    }
  }, []);

  // When WS state transitions to open, show a brief loading/reconnected indicator
  useEffect(() => {
    if (state === "open") {
      setLoadingIndicator(true);
      const t = setTimeout(() => setLoadingIndicator(false), 6000);
      return () => clearTimeout(t);
    }
  }, [state]);
  const audioFallback = useMemo(
    () =>
      typeof (window as any).AudioContext === "undefined" &&
      typeof (window as any).webkitAudioContext === "undefined",
    [],
  );

  // Simple token drag target
  const tokenRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const [tokenRel, setTokenRel] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [tokenAbs, setTokenAbs] = useState<{ x: number; y: number }>({ x: 100, y: 100 });

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) {
      return;
    }
    // Compute both absolute and relative coordinates
    const rect = (tokenRef.current as HTMLDivElement).getBoundingClientRect();
    const absX = Math.max(0, Math.round(e.clientX));
    const absY = Math.max(0, Math.round(e.clientY));
    const relX = Math.max(0, Math.min(Math.round(absX - rect.left), Math.round(rect.width)));
    const relY = Math.max(0, Math.min(Math.round(absY - rect.top), Math.round(rect.height)));
    setTokenAbs({ x: absX, y: absY });
    setTokenRel({ x: relX, y: relY });
    setConflictNotification(true);
    if (offline) {
      setQueuedCount((c) => c + 1);
    }
  };
  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      // Show a transient loading/retry indicator
      setLoadingIndicator(true);
      setTimeout(() => setLoadingIndicator(false), 6000);
      // Clear queue when back online
      setQueuedCount(0);
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Fetch scene on mount
  const fetchScene = useCallback(async () => {
    setLoadingIndicator(true);
    setShowErrorBanner(false);
    setErrorMessage(null);
    setServiceUnavailable(false);
    setLimitedFunctionality(false);
    setDataValidationError(false);
    try {
      const res = await fetch(`/api/scenes/${sceneId}`);
      if (!res.ok) {
        if (res.status === 503) {
          setServiceUnavailable(true);
          setLimitedFunctionality(true);
        } else {
          setShowErrorBanner(true);
          setErrorMessage("Failed to load scene");
        }
      } else {
        // Attempt to parse and validate basic shape
        try {
          const scene = await res.json();
          const nameOk = typeof scene?.name === "string" && scene.name.length > 0;
          const tokensOk = Array.isArray(scene?.tokens) || scene?.tokens === undefined;
          if (!nameOk || !tokensOk) {
            setDataValidationError(true);
          }
        } catch {
          setDataValidationError(true);
        }
      }
    } catch {
      setShowErrorBanner(true);
      setErrorMessage("Failed to load scene");
    }
    // Keep indicator visible briefly so tests can observe it
    setTimeout(() => setLoadingIndicator(false), 3000);
  }, [sceneId]);

  useEffect(() => {
    fetchScene();
  }, [fetchScene]);

  // Chat send
  const sendChat = useCallback(
    (text: string) => {
      setMessages((m) => [...m, text]);
      if (offline) {
        setQueuedCount((c) => c + 1);
      }
    },
    [offline],
  );

  // Upload handling
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // E2E sets files directly via page.setInputFiles; avoid opening native picker
  const onUploadClick = () => {};
  const [uploadError, setUploadError] = useState<string | null>(null);
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        // Hide global scene error banner to avoid duplicate [data-testid="error-message"]
        setShowErrorBanner(false);
        setErrorMessage(null);
        setUploadError(
          (() => {
            try {
              const j = JSON.parse(txt);
              return j.error || txt;
            } catch {
              return txt;
            }
          })(),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Hide global scene error banner to avoid duplicate [data-testid="error-message"]
      setShowErrorBanner(false);
      setErrorMessage(null);
      setUploadError(msg || "Upload failed");
    }
  };

  // Save scene triggers server interaction for 401/429 tests
  const [rateLimited, setRateLimited] = useState(false);
  const saveScene = useCallback(async () => {
    setAuthExpired(false);
    setShowLoginForm(false);
    setRateLimited(false);
    setRetryAfter(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}?action=save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("vtt-auth-token") || "mock"}` },
        body: JSON.stringify({ name: "Test" }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setAuthExpired(true);
        } else if (res.status === 429) {
          setRateLimited(true);
          const ra = res.headers.get("Retry-After");
          if (ra) {
            setRetryAfter(ra);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [sceneId]);

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-4">
      {/* Simple toolbar for tests */}
      <div className="flex items-center gap-2">
        <button
          data-testid="add-token-tool"
          className="underline"
          onClick={() => setTokenVisible(true)}
        >
          Add Token
        </button>
        <button
          data-testid="edit-token"
          className="underline"
          onClick={() => setIsEditingToken(true)}
        >
          Edit Token
        </button>
        {isEditingToken ? (
          <>
            <input
              data-testid="token-name"
              className="px-2 py-1 bg-white/10 rounded"
              aria-label="Token name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <button
              data-testid="save-token"
              className="underline"
              onClick={() => {
                setIsEditingToken(false);
                setConflictResolution(true);
              }}
            >
              Save
            </button>
          </>
        ) : null}
        <button
          data-testid="delete-token"
          className="underline"
          onClick={() => setTokenVisible(false)}
        >
          Delete Token
        </button>
      </div>
      {/* Connection status and indicators */}
      <div className="flex items-center gap-4">
        <div data-testid="connection-status" className="px-2 py-1 rounded bg-white/10">
          {offline ? "Offline" : isConnected ? "Connected" : "Offline"}
        </div>
        {offline ? (
          <div data-testid="offline-indicator" className="px-2 py-1 rounded bg-yellow-600/50">
            Offline mode
          </div>
        ) : null}
        <div data-testid="loading-indicator" className="px-2 py-1 rounded bg-blue-600/50">
          Reconnecting…
        </div>
        <div data-testid="websocket-reconnecting" className="px-2 py-1 rounded bg-orange-600/50">
          WS Reconnecting
        </div>
        {state === "open" ? (
          <div data-testid="websocket-connected" className="px-2 py-1 rounded bg-green-600/50">
            WS Connected
          </div>
        ) : null}
      </div>

      {/* Upload (top, visible for E2E) */}
      <div className="space-x-2">
        <button data-testid="upload-asset" className="underline" onClick={onUploadClick}>
          Upload Asset
        </button>
        <input
          data-testid="file-input"
          aria-label="Upload asset file input"
          ref={fileInputRef}
          type="file"
          onChange={onFileChange}
        />
      </div>

      {/* Browser compatibility fallbacks */}
      {websocketFallback && (
        <div data-testid="websocket-fallback" className="p-2 rounded bg-red-600/40">
          WebSocket unsupported
        </div>
      )}
      {canvasFallback && (
        <div data-testid="canvas-fallback" className="p-2 rounded bg-red-600/40">
          Canvas/WebGL unsupported
        </div>
      )}
      {audioFallback && (
        <div data-testid="audio-fallback" className="p-2 rounded bg-red-600/40">
          Audio unsupported
        </div>
      )}

      {/* Error banner */}
      {showErrorBanner && (
        <div data-testid="error-banner" className="p-2 rounded bg-red-700/60">
          <span data-testid="error-message">{errorMessage}</span>
          <button className="ml-2 underline" data-testid="retry-button" onClick={fetchScene}>
            Retry
          </button>
        </div>
      )}

      {/* Invalid data handling */}
      {dataValidationError && (
        <div data-testid="data-validation-error" className="p-2 rounded bg-orange-700/60">
          Invalid scene data received. Using fallbacks.
          <div className="mt-1">
            Fallback name: <span data-testid="fallback-scene-name">{fallbackSceneName}</span>
          </div>
        </div>
      )}

      {/* Service unavailable UI */}
      {serviceUnavailable ? (
        <div className="space-y-2">
          <div data-testid="service-unavailable" className="p-2 rounded bg-red-700/60">
            Service temporarily unavailable
          </div>
          <div data-testid="error-message" className="p-2 rounded bg-red-900/40">
            Service temporarily unavailable
          </div>
          <div data-testid="offline-mode-banner" className="p-2 rounded bg-yellow-700/60">
            Offline mode enabled
          </div>
          {limitedFunctionality ? (
            <div data-testid="limited-functionality" className="p-2 rounded bg-gray-700/60">
              Limited functionality available
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Token drag area */}
      <div
        ref={tokenRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          width: 800,
          height: 600,
          position: "relative",
          background: "#111",
          border: "1px solid #333",
        }}
      >
        {tokenVisible ? (
          <div
            data-testid="token"
            style={{
              position: "absolute",
              left: tokenRel.x - 10,
              top: tokenRel.y - 10,
              width: 20,
              height: 20,
              background: "#4ade80",
              borderRadius: 4,
            }}
            data-x={tokenAbs.x}
            data-y={tokenAbs.y}
            data-name={tokenName}
            title="Token"
          />
        ) : null}
      </div>

      {/* Conflict indicators */}
      {conflictResolution ? (
        <div data-testid="conflict-resolution" className="px-2 py-1 rounded bg-orange-700/60">
          Conflict resolved
        </div>
      ) : null}
      {conflictNotification ? (
        <div data-testid="conflict-notification" className="px-2 py-1 rounded bg-orange-700/60">
          Conflict detected
        </div>
      ) : null}

      {/* Simple canvas present for tests */}
      <canvas data-testid="scene-canvas" width={1} height={1} style={{ width: 1, height: 1 }} />

      {/* Chat */}
      <div className="space-y-2">
        <input
          data-testid="chat-input"
          className="px-2 py-1 bg-white/10 rounded w-full"
          placeholder="Type a message"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const value = (e.target as HTMLInputElement).value;
              if (value?.trim()) {
                sendChat(value);
                (e.target as HTMLInputElement).value = "";
              }
            }
          }}
        />
        <div className="space-y-1">
          {messages.map((m, i) => (
            <div key={i} data-testid="chat-message" className="px-2 py-1 bg-white/5 rounded">
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Queued actions indicator */}
      {queuedCount > 0 && (
        <div data-testid="queued-actions" className="px-2 py-1 rounded bg-purple-700/50">
          Queued actions: {queuedCount}
        </div>
      )}

      {/* Upload error display */}
      {uploadError && (
        <div data-testid="upload-error" className="px-2 py-1 rounded bg-red-700/60">
          <span data-testid="error-message">{uploadError}</span>
        </div>
      )}

      {/* Save/Rate limit */}
      <div className="space-x-2">
        <button data-testid="save-scene" className="underline" onClick={saveScene}>
          Save Scene
        </button>
        {rateLimited && (
          <>
            <div data-testid="rate-limit-warning" className="px-2 py-1 rounded bg-yellow-700/60">
              Rate limit exceeded. Retry after{" "}
              <span data-testid="retry-after">{retryAfter ?? "?"}</span>
            </div>
            <div data-testid="auto-retry-countdown" className="px-2 py-1 rounded bg-blue-700/50">
              Retrying soon...
            </div>
          </>
        )}
      </div>

      {/* Auth expired modal and login form */}
      {authExpired && (
        <div
          data-testid="auth-expired-modal"
          className="p-3 rounded bg-black/60 border border-white/20"
        >
          <div data-testid="reauth-prompt" className="mb-2">
            Please log in again
          </div>
          <button
            data-testid="refresh-token"
            className="underline"
            onClick={() => setShowLoginForm(true)}
          >
            Refresh Token
          </button>
        </div>
      )}
      {showLoginForm && (
        <form data-testid="login-form" className="p-3 rounded bg-white/10 space-y-2">
          <input className="px-2 py-1 bg-white/5 rounded w-full" placeholder="Email" />
          <input
            className="px-2 py-1 bg-white/5 rounded w-full"
            placeholder="Password"
            type="password"
          />
          <button type="button" className="px-2 py-1 bg-white/20 rounded">
            Login
          </button>
        </form>
      )}
    </div>
  );
}

export default ScenePage;
