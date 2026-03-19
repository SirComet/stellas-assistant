"use client";

import { use, useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { content, ai, type ContentPost } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Send,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface BlogEditorProps {
  params: Promise<{ id: string }>;
}

const emptyForm: Partial<ContentPost> = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  tags: [],
  category: "",
  status: "draft",
  author: "Stella Jimenez",
  featuredImage: "",
  type: "blog",
};

/** Blog post editor page with AI content generation support. */
export default function BlogEditor({ params }: BlogEditorProps) {
  const { id } = use(params);
  const isNew = id === "new";
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Partial<ContentPost>>(emptyForm);
  const [tagsInput, setTagsInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const loadedRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["content-post", id],
    queryFn: () => content.posts.get(id),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Sync form when data loads
  useEffect(() => {
    if (!loadedRef.current && data?.data) {
      loadedRef.current = true;
      setForm(data.data);
      setTagsInput((data.data.tags ?? []).join(", "));
    }
  }, [data]);

  const setField = (key: keyof ContentPost, value: string) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === "title" && !loadedRef.current) {
        updated.slug = slugify(value);
      }
      return updated;
    });
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<ContentPost> = {
        ...form,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        type: "blog",
      };
      if (isNew) {
        return content.posts.create(payload);
      }
      return content.posts.update(id, payload);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["content-posts"] });
      if (isNew && res.data) {
        window.history.replaceState({}, "", `/content/blog/${res.data.id}`);
        loadedRef.current = true;
      }
      setIsDirty(false);
      toast.success(isNew ? "Post created" : "Post saved");
    },
    onError: () => toast.error("Failed to save post"),
  });

  const publishMutation = useMutation({
    mutationFn: () => content.posts.togglePublish(id),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["content-post", id] });
      void queryClient.invalidateQueries({ queryKey: ["content-posts"] });
      // Update local form status
      setForm((f) => ({ ...f, status: res.data?.status as ContentPost["status"] ?? f.status }));
      toast.success(`Post ${res.data?.status === "published" ? "published" : "unpublished"}`);
    },
  });

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await ai.generateCopy("blog_post", aiPrompt);
      if (res.success && res.data) {
        setField("content", res.data.copy);
        toast.success("AI content generated");
      }
    } catch {
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading && !isNew) {
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
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/content/blog"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{isNew ? "New Blog Post" : (form.title || "Edit Post")}</h1>
            {form.slug && (
              <p className="text-xs text-muted-foreground font-mono">/{form.slug}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                form.status === "published"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {form.status === "published" ? "Published" : "Publish"}
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!isDirty && !isNew)}
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

      {/* AI Bar */}
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex gap-2 max-w-2xl">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Sparkles className="w-3 h-3 text-stella-gold" />
            AI Generate:
          </div>
          <input
            type="text"
            placeholder="Describe the blog post content you want…"
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 max-w-3xl mx-auto space-y-5"
        >
          <div className="field">
            <label>Title *</label>
            <input
              value={form.title ?? ""}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Post title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>Slug</label>
              <input
                value={form.slug ?? ""}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="auto-generated-from-title"
                className="font-mono"
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={form.status ?? "draft"}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Excerpt</label>
            <textarea
              rows={2}
              value={form.excerpt ?? ""}
              onChange={(e) => setField("excerpt", e.target.value)}
              placeholder="Short description shown in listings…"
            />
          </div>

          <div className="field">
            <label>Content</label>
            <textarea
              rows={16}
              value={form.content ?? ""}
              onChange={(e) => setField("content", e.target.value)}
              placeholder="Write your blog post content here…"
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>Tags (comma-separated)</label>
              <input
                value={tagsInput}
                onChange={(e) => { setTagsInput(e.target.value); setIsDirty(true); }}
                placeholder="design, strategy, tips"
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                value={form.category ?? ""}
                onChange={(e) => setField("category", e.target.value)}
                placeholder="Business, Design, Tech…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>Author</label>
              <input
                value={form.author ?? ""}
                onChange={(e) => setField("author", e.target.value)}
                placeholder="Author name"
              />
            </div>
            <div className="field">
              <label>Featured Image URL</label>
              <input
                value={form.featuredImage ?? ""}
                onChange={(e) => setField("featuredImage", e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          {form.featuredImage && (
            <div className="rounded-xl overflow-hidden border border-border aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.featuredImage}
                alt="Featured"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
