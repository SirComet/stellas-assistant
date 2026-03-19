"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deploy, type DeployTarget, type Deployment } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Plus,
  Server,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  X,
  Terminal,
  Wifi,
  WifiOff,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const emptyForm = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "key" as "key" | "password",
  privateKey: "",
  password: "",
  remotePath: "",
  webUrl: "",
};

export default function DeployPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [postCommand, setPostCommand] = useState("");
  const [execCommand, setExecCommand] = useState("");
  const [execResult, setExecResult] = useState<string | null>(null);
  const [execTargetId, setExecTargetId] = useState<string | null>(null);

  const { data: targetsData } = useQuery({
    queryKey: ["deploy-targets"],
    queryFn: () => deploy.targets.list(),
  });

  const { data: deploymentsData, refetch: refetchDeployments } = useQuery({
    queryKey: ["deployments"],
    queryFn: () => deploy.deployments.list(),
    refetchInterval: (query) => {
      const d = query.state.data as { data?: Array<{ status: string }> } | undefined;
      const running = d?.data?.some((dep) => dep.status === "running");
      return running ? 2000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => deploy.targets.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deploy-targets"] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success("Deploy target added");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deploy.targets.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deploy-targets"] });
      toast.success("Target removed");
    },
  });

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await deploy.targets.test(id);
      if (res.data.success) {
        toast.success(`Connected! Latency: ${res.data.latency}ms`);
      } else {
        toast.error(`Connection failed: ${res.data.message}`);
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleDeploy = async (id: string) => {
    setDeployingId(id);
    try {
      const res = await deploy.targets.deploy(id, { postCommand: postCommand || undefined });
      if (res.data) {
        toast.success("Deployment started!");
        void refetchDeployments();
      }
    } catch {
      toast.error("Deploy failed");
    } finally {
      setDeployingId(null);
    }
  };

  const handleExec = async () => {
    if (!execTargetId || !execCommand) return;
    try {
      const res = await deploy.targets.exec(execTargetId, execCommand);
      if (res.success) {
        setExecResult(res.data.stdout || res.data.stderr || "(no output)");
      }
    } catch {
      toast.error("Command failed");
    }
  };

  const targets = targetsData?.data ?? [];
  const deployments = deploymentsData?.data ?? [];

  const getStatusIcon = (status: Deployment["status"]) => {
    if (status === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <AppShell>
      <Header
        title="Deploy"
        subtitle="Manage deployment targets"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Target
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Targets */}
          <section>
            <h2 className="text-sm font-semibold mb-3">Deploy Targets</h2>
            {targets.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <Server className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No deploy targets configured</p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {targets.map((target) => (
                  <motion.div
                    key={target.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold">{target.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">
                          {target.username}@{target.host}:{target.port}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          → {target.remotePath}
                        </p>
                      </div>
                      {target.lastDeployedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last: {formatRelative(target.lastDeployedAt)}
                        </span>
                      )}
                    </div>

                    {/* SSH exec */}
                    {execTargetId === target.id && (
                      <div className="mb-3 p-3 bg-muted rounded-lg">
                        <div className="flex gap-2 mb-2">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="font-mono mr-1">$</span>
                          </div>
                          <input
                            type="text"
                            value={execCommand}
                            onChange={(e) => setExecCommand(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void handleExec()}
                            placeholder="ls -la /var/www"
                            className="flex-1 bg-transparent text-xs font-mono outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => void handleExec()}
                            className="text-xs px-2 py-0.5 rounded bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900"
                          >
                            Run
                          </button>
                        </div>
                        {execResult && (
                          <pre className="text-xs font-mono text-emerald-600 dark:text-emerald-400 whitespace-pre-wrap mt-2 max-h-32 overflow-auto">
                            {execResult}
                          </pre>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleTest(target.id)}
                        disabled={testingId === target.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs hover:bg-accent transition-colors"
                      >
                        {testingId === target.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wifi className="w-3 h-3" />
                        )}
                        Test
                      </button>
                      <button
                        onClick={() => void handleDeploy(target.id)}
                        disabled={deployingId === target.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {deployingId === target.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Deploy
                      </button>
                      <button
                        onClick={() => setExecTargetId(execTargetId === target.id ? null : target.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs hover:bg-accent"
                      >
                        <Terminal className="w-3 h-3" />
                        SSH
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${target.name}"?`)) deleteMutation.mutate(target.id);
                        }}
                        className="ml-auto p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Deployments log */}
          {deployments.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Deployment History</h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {deployments.slice(0, 10).map((dep) => (
                  <div
                    key={dep.id}
                    className="border-b border-border last:border-0 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {getStatusIcon(dep.status)}
                        <div>
                          <p className="text-sm font-medium capitalize">{dep.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelative(dep.startedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowLogs(showLogs === dep.id ? null : dep.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Logs
                        {showLogs === dep.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {showLogs === dep.id && dep.log && (
                      <pre className="mt-3 p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                        {dep.log}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">New Deploy Target</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="field col-span-2">
                  <label>Name *</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Production Server" />
                </div>
                <div className="field">
                  <label>Host *</label>
                  <input required value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="example.com or IP" />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value) }))} />
                </div>
                <div className="field">
                  <label>Username *</label>
                  <input required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="deploy" />
                </div>
                <div className="field">
                  <label>Auth Type</label>
                  <select value={form.authType} onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as "key" | "password" }))}>
                    <option value="key">SSH Key</option>
                    <option value="password">Password</option>
                  </select>
                </div>
                {form.authType === "key" ? (
                  <div className="field col-span-2">
                    <label>Private Key</label>
                    <textarea rows={3} value={form.privateKey} onChange={(e) => setForm((f) => ({ ...f, privateKey: e.target.value }))} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" className="font-mono text-xs" />
                  </div>
                ) : (
                  <div className="field col-span-2">
                    <label>Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  </div>
                )}
                <div className="field col-span-2">
                  <label>Remote Path *</label>
                  <input required value={form.remotePath} onChange={(e) => setForm((f) => ({ ...f, remotePath: e.target.value }))} placeholder="/var/www/html" />
                </div>
                <div className="field col-span-2">
                  <label>Web URL (optional)</label>
                  <input type="url" value={form.webUrl} onChange={(e) => setForm((f) => ({ ...f, webUrl: e.target.value }))} placeholder="https://example.com" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent">Cancel</button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add Target
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
