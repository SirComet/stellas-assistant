"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settings, llm, type LLMProviderDef, type LLMConnection } from "@/lib/api";
import {
  Loader2, Save, Eye, EyeOff, Key, Globe, Server,
  CheckCircle2, XCircle, ExternalLink, Plus, Trash2, ChevronDown,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );
}

// ─── Secret input ─────────────────────────────────────────────────────────────

function SecretField({
  label, name, placeholder, form, setForm,
}: {
  label: string;
  name: string;
  placeholder?: string;
  form: Record<string, string>;
  setForm: (f: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={form[name] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Provider color config ────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
  openai: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
  anthropic: "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800",
  grok: "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700",
  ollama: "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800",
};

const PROVIDER_BADGE: Record<string, string> = {
  gemini: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50",
  openai: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50",
  anthropic: "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50",
  grok: "text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800",
  ollama: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/50",
};

// ─── Connect modal ────────────────────────────────────────────────────────────

function ConnectModal({
  provider, onClose, onConnected,
}: {
  provider: LLMProviderDef;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(provider.defaultModel);

  const connectMutation = useMutation({
    mutationFn: () =>
      llm.connect({
        provider: provider.id,
        apiKey: provider.authType === "apikey" ? apiKey : undefined,
        ollamaUrl: provider.authType === "url" ? ollamaUrl : undefined,
        selectedModel,
      }),
    onSuccess: () => {
      toast.success(`${provider.name} connected!`);
      onConnected();
      onClose();
    },
    onError: () => toast.error("Connection failed"),
  });

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold">Connect {provider.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {provider.authType === "apikey" && (
            <div className="field">
              <label>API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here"
                  className="pr-10 font-mono text-xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <Key className="w-3 h-3 shrink-0" />
                Stored securely on your Pi — never sent back to the browser
              </p>
            </div>
          )}

          {provider.authType === "url" && (
            <div className="field">
              <label>Ollama URL</label>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Point this to your Ollama instance. Must be accessible from the Pi.
              </p>
            </div>
          )}

          <div className="field">
            <label>Default Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.note ? ` — ${m.note}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={() => connectMutation.mutate()}
              disabled={
                connectMutation.isPending ||
                (provider.authType === "apikey" && !apiKey.trim()) ||
                (provider.authType === "url" && !ollamaUrl.trim())
              }
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50"
            >
              {connectMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Connect
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── AI Providers section ─────────────────────────────────────────────────────

function AIProviders() {
  const queryClient = useQueryClient();
  const [connectingProvider, setConnectingProvider] = useState<LLMProviderDef | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: providersData } = useQuery({
    queryKey: ["llm-providers"],
    queryFn: () => llm.providers(),
  });

  const { data: connectionsData, refetch: refetchConnections } = useQuery({
    queryKey: ["llm-connections"],
    queryFn: () => llm.connections(),
  });

  const { data: activeData, refetch: refetchActive } = useQuery({
    queryKey: ["llm-active"],
    queryFn: () => llm.getActive(),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => llm.disconnect(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["llm-connections"] });
      void queryClient.invalidateQueries({ queryKey: ["llm-active"] });
      toast.success("Provider disconnected");
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ connectionId, model }: { connectionId: string; model: string }) =>
      llm.setActive(connectionId, model),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["llm-active"] });
      void queryClient.invalidateQueries({ queryKey: ["llm-connections"] });
      toast.success("Active AI updated");
    },
  });

  // Handle OAuth redirect back
  useEffect(() => {
    const connected = searchParams.get("llm_connected");
    const error = searchParams.get("llm_error");

    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected via Google!`);
      void queryClient.invalidateQueries({ queryKey: ["llm-connections"] });
      void queryClient.invalidateQueries({ queryKey: ["llm-active"] });
      router.replace("/settings");
    }
    if (error) {
      toast.error(`Connection failed: ${error.replace(/_/g, " ")}`);
      router.replace("/settings");
    }
  }, [searchParams, queryClient, router]);

  const providers = providersData?.data ?? [];
  const connections = connectionsData?.data ?? [];
  const active = activeData?.data;

  const getConnection = (providerId: string): LLMConnection | undefined =>
    connections.find((c) => c.provider === providerId);

  const handleGoogleOAuth = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("stella_token") : null;
    window.location.href = `${API_BASE}/api/llm/oauth/google/start?token=${token ?? ""}`;
  };

  return (
    <div className="space-y-3">
      {/* Active banner */}
      {active?.connectionId && (
        <div className="flex items-center gap-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Active: {active.displayName}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono truncate">{active.model}</p>
          </div>
        </div>
      )}

      {/* Providers */}
      {providers.map((provider) => {
        const conn = getConnection(provider.id);
        const isActive = conn?.id === active?.connectionId;
        const isExpanded = expandedProvider === provider.id;

        return (
          <div
            key={provider.id}
            className={cn(
              "border rounded-xl overflow-hidden transition-all",
              PROVIDER_COLORS[provider.id] ?? "bg-card border-border",
              conn && isActive && "ring-2 ring-emerald-400/50 dark:ring-emerald-600/50",
            )}
          >
            <div className="flex items-center gap-3 p-3.5">
              <div className={cn("w-2 h-2 rounded-full shrink-0", conn ? "bg-emerald-500" : "bg-muted-foreground/30")} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{provider.name}</p>
                  {provider.freeTier && (
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", PROVIDER_BADGE[provider.id] ?? "")}>
                      Free
                    </span>
                  )}
                  {isActive && conn && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{provider.freeNote}</p>
                {conn?.email && (
                  <p className="text-xs text-muted-foreground font-mono truncate">{conn.email}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {conn ? (
                  <>
                    {!isActive && (
                      <button
                        onClick={() => setActiveMutation.mutate({ connectionId: conn.id, model: conn.selectedModel })}
                        disabled={setActiveMutation.isPending}
                        className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                      >
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                      className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Disconnect ${provider.name}?`)) disconnectMutation.mutate(conn.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (provider.authType === "oauth") handleGoogleOAuth();
                      else setConnectingProvider(provider);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0",
                      provider.authType === "oauth"
                        ? "bg-[#4285F4] hover:bg-[#3b78e7] text-white"
                        : "bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 hover:opacity-90"
                    )}
                  >
                    {provider.authType === "oauth" ? (
                      <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        Connect
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Model selector (expanded) */}
            <AnimatePresence>
              {isExpanded && conn && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-border/50"
                >
                  <div className="p-3.5 pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Model</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {provider.models.map((model) => {
                        const isCurrent = conn.selectedModel === model.id;
                        return (
                          <button
                            key={model.id}
                            onClick={() => setActiveMutation.mutate({ connectionId: conn.id, model: model.id })}
                            disabled={setActiveMutation.isPending}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all",
                              isCurrent
                                ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                : "border-border hover:bg-accent"
                            )}
                          >
                            <span className="text-xs font-medium">{model.name}</span>
                            <div className="flex items-center gap-2">
                              {model.note && <span className="text-xs text-muted-foreground">{model.note}</span>}
                              {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Info note */}
      <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs text-muted-foreground space-y-1.5">
        <p>
          <strong className="text-foreground">Gemini via Google</strong> uses your personal free quota
          (15 req/min, 1M tokens/day). No billing needed.
        </p>
        <p>
          Google OAuth requires{" "}
          <code className="font-mono text-foreground text-[11px]">GOOGLE_CLIENT_ID</code> +{" "}
          <code className="font-mono text-foreground text-[11px]">GOOGLE_CLIENT_SECRET</code> in your Pi&apos;s{" "}
          <code className="font-mono text-foreground text-[11px]">.env</code>.{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-medium hover:underline inline-flex items-center gap-0.5"
          >
            Set up in Google Cloud <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </p>
      </div>

      <AnimatePresence>
        {connectingProvider && (
          <ConnectModal
            provider={connectingProvider}
            onClose={() => setConnectingProvider(null)}
            onConnected={() => {
              void queryClient.invalidateQueries({ queryKey: ["llm-connections"] });
              void queryClient.invalidateQueries({ queryKey: ["llm-active"] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [form, setForm] = useState<Record<string, string>>({
    github_token: "",
    site_name: "Stella Jimenez",
    site_domain: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settings.get(),
  });

  useEffect(() => {
    if (data?.success && data.data) {
      setForm((f) => ({ ...f, ...data.data }));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => settings.update(form),
    onSuccess: () => toast.success("Settings saved"),
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Header
        title="Settings"
        subtitle="Configure your assistant"
        actions={
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50 hover:opacity-90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <Section title="AI Providers" icon={Sparkles}>
            <AIProviders />
          </Section>

          <Section title="Site" icon={Globe}>
            <div className="field">
              <label>Site Name</label>
              <input
                value={form.site_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
                placeholder="Stella Jimenez"
              />
            </div>
            <div className="field">
              <label>Domain</label>
              <input
                value={form.site_domain ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, site_domain: e.target.value }))}
                placeholder="stellajimenez.com"
              />
            </div>
          </Section>

          <Section title="GitHub" icon={Key}>
            <SecretField
              label="Personal Access Token"
              name="github_token"
              placeholder="ghp_…"
              form={form}
              setForm={setForm}
            />
            <p className="text-xs text-muted-foreground">
              Requires <code className="font-mono text-foreground">repo</code> scope.
            </p>
          </Section>

          <Section title="SSH Keys" icon={Server}>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-medium mb-2">Your Pi SSH Public Key</p>
              <div className="font-mono text-xs text-muted-foreground break-all bg-background rounded p-2 border border-border">
                ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILQNCwqVPl6rjI0AXvyxom2/KizleVHS9u8nuwNgtseS stellas-assistant@raspberry-pi
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Stored at <code className="font-mono">~/.ssh/stella_pi_ed25519</code>
              </p>
            </div>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
