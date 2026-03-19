"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import { useUiStore } from "@/lib/store";
import { ai } from "@/lib/api";
import { cn, formatRelative } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function AiPanel() {
  const { aiPanelOpen, toggleAiPanel, activeAiSession, setAiSession } = useUiStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn: () => ai.sessions(),
    enabled: aiPanelOpen,
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) =>
      ai.chat({ message: msg, sessionId: currentSessionId ?? undefined }),
    onSuccess: (data) => {
      if (data.success && data.data) {
        setCurrentSessionId(data.data.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.data.response,
            timestamp: new Date().toISOString(),
          },
        ]);
        void queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      }
    },
    onError: () => toast.error("AI response failed"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming || chatMutation.isPending) return;

    const msg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg, timestamp: new Date().toISOString() },
    ]);
    chatMutation.mutate(msg);
  }, [input, isStreaming, chatMutation]);

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (id: string) => {
    await ai.deleteSession(id);
    await queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
    if (currentSessionId === id) handleNewSession();
  };

  return (
    <AnimatePresence>
      {aiPanelOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed right-0 top-0 h-screen w-[380px] bg-card border-l border-border flex flex-col shadow-2xl z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-stella-gold" />
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewSession}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="New conversation"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={toggleAiPanel}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <div className="w-12 h-12 rounded-full gold-accent flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">How can I help you today?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask me to write copy, build pages, or analyze your CRM data.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full mt-2">
                  {[
                    "Write a hero section for my homepage",
                    "Analyze my client pipeline",
                    "Generate a services page",
                    "Write a compelling bio",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    msg.role === "user"
                      ? "chat-bubble-user"
                      : "chat-bubble-assistant"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                    "text-xs mt-1 opacity-60",
                    msg.role === "user" ? "text-right" : "text-left"
                  )}>
                    {formatRelative(msg.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}

            {chatMutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="chat-bubble-assistant flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything… (⏎ to send)"
                rows={2}
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="px-3 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 hover:opacity-90 disabled:opacity-40 transition-all self-end"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Recent sessions */}
            {sessions?.data && sessions.data.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">Recent</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {sessions.data.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 group rounded px-2 py-1 cursor-pointer hover:bg-accent transition-colors",
                        currentSessionId === s.id && "bg-accent"
                      )}
                      onClick={() => setCurrentSessionId(s.id)}
                    >
                      <span className="text-xs flex-1 truncate">{s.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
