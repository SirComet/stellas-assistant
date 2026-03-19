"use client";

import { useState, useCallback } from "react";
import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pages, ai } from "@/lib/api";
import { useBuilderStore, useUiStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Loader2, Save, Eye, EyeOff, Sparkles, Code, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

const CodeMirror = dynamic(
  () => import("@uiw/react-codemirror").then((m) => m.default),
  { ssr: false }
);

interface PageEditorProps {
  params: Promise<{ id: string }>;
}

export default function PageEditor({ params }: PageEditorProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { previewMode, togglePreview } = useBuilderStore();
  const { toggleAiPanel } = useUiStore();

  const [tab, setTab] = useState<"visual" | "html" | "css">("visual");
  const [htmlContent, setHtmlContent] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["page", id],
    queryFn: () => pages.get(id),
    onSuccess: (res: Awaited<ReturnType<typeof pages.get>>) => {
      if (res.success && res.data) {
        const meta = res.data.metadata as { customHtml?: string; customCss?: string };
        setHtmlContent(meta.customHtml ?? "");
        setCssContent(meta.customCss ?? "");
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      pages.update(id, {
        metadata: JSON.stringify({
          ...(data?.data?.metadata ?? {}),
          customHtml: htmlContent,
          customCss: cssContent,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["page", id] });
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
      setIsDirty(false);
      toast.success("Saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const publishMutation = useMutation({
    mutationFn: (status: "draft" | "published") => pages.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["page", id] });
      toast.success("Status updated");
    },
  });

  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await ai.generatePage(aiPrompt);
      if (res.success && res.data) {
        setHtmlContent(res.data.html);
        setCssContent(res.data.css);
        setIsDirty(true);
        toast.success("AI content generated!");
        if (res.data.suggestions.length > 0) {
          toast(res.data.suggestions[0] ?? "", { icon: "💡", duration: 4000 });
        }
      }
    } catch {
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const page = data?.data;
  if (!page) return null;

  return (
    <AppShell>
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/builder"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{page.title}</h1>
            <p className="text-xs text-muted-foreground font-mono">/{page.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex rounded-lg border border-border p-0.5 bg-muted">
            {(["visual", "html", "css"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  tab === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "visual" ? "Visual" : t.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={togglePreview}
            className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={previewMode ? "Edit" : "Preview"}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleAiPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-stella-gold" />
            AI
          </button>

          <button
            onClick={() => publishMutation.mutate(
              page.status === "published" ? "draft" : "published"
            )}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              page.status === "published"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100"
                : "border border-border hover:bg-accent"
            }`}
          >
            {page.status === "published" ? "Published" : "Publish"}
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* AI Prompt Bar */}
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex gap-2 max-w-2xl">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Sparkles className="w-3 h-3 text-stella-gold" />
            AI Generate:
          </div>
          <input
            type="text"
            placeholder="Describe the page you want to create…"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleAiGenerate()}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => void handleAiGenerate()}
            disabled={generating || !aiPrompt.trim()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-xs font-medium disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Generate
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {previewMode ? (
          <div className="w-full h-full">
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><style>${cssContent}</style></head><body>${htmlContent}</body></html>`}
              className="w-full h-full border-0"
              title="Preview"
            />
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            {tab === "visual" && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-6 min-h-64">
                  {htmlContent ? (
                    <div dangerouslySetInnerHTML={{ __html: `<style>${cssContent}</style>${htmlContent}` }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                      <Code className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Use the AI bar above to generate content, or switch to HTML/CSS tabs to write manually
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "html" && (
              <CodeMirror
                value={htmlContent}
                height="100%"
                className="text-sm"
                onChange={(v) => { setHtmlContent(v); setIsDirty(true); }}
              />
            )}

            {tab === "css" && (
              <CodeMirror
                value={cssContent}
                height="100%"
                className="text-sm"
                onChange={(v) => { setCssContent(v); setIsDirty(true); }}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
