"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { settings } from "@/lib/api";
import { Loader2, Save, Eye, EyeOff, Key, Globe, Server } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [form, setForm] = useState<Record<string, string>>({
    gemini_api_key: "",
    github_token: "",
    site_name: "Stella Jimenez",
    site_domain: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settings.get(),
    onSuccess: (res: Awaited<ReturnType<typeof settings.get>>) => {
      if (res.success && res.data) {
        setForm((f) => ({ ...f, ...res.data }));
      }
    },
  });

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

  const toggleSecret = (key: string) => {
    setShowSecrets((s) => ({ ...s, [key]: !s[key] }));
  };

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.FC<{ className?: string }>; children: React.ReactNode }) => (
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

  const SecretField = ({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) => (
    <div className="field">
      <label>{label}</label>
      <div className="relative">
        <input
          type={showSecrets[name] ? "text" : "password"}
          value={form[name] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => toggleSecret(name)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showSecrets[name] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );

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
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-4">

          <Section title="AI Configuration" icon={Key}>
            <SecretField label="Gemini API Key" name="gemini_api_key" placeholder="AIza…" />
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <span className="font-medium text-foreground">Google AI Studio</span>
            </p>
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
            <SecretField label="Personal Access Token" name="github_token" placeholder="ghp_…" />
            <p className="text-xs text-muted-foreground">
              Used for creating repos and pushing code. Requires <span className="font-mono text-foreground">repo</span> scope.
            </p>
          </Section>

          <Section title="SSH Keys" icon={Server}>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs font-medium mb-2">Your Pi SSH Public Key</p>
              <div className="font-mono text-xs text-muted-foreground break-all bg-background rounded p-2 border border-border">
                ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILQNCwqVPl6rjI0AXvyxom2/KizleVHS9u8nuwNgtseS stellas-assistant@raspberry-pi
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Key is stored at <span className="font-mono">~/.ssh/stella_pi_ed25519</span>
              </p>
            </div>
          </Section>

        </div>
      </div>
    </AppShell>
  );
}
