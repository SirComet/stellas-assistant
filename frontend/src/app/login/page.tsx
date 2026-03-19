"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import { Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, user } = useAuthStore();
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
  });

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
      return;
    }

    auth.setupStatus()
      .then((res) => {
        setIsSetup(res.data.needsSetup);
      })
      .catch(() => {})
      .finally(() => setCheckingSetup(false));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSetup) {
        const res = await auth.register({
          email: form.email,
          name: form.name,
          password: form.password,
        });
        if (res.success && res.data) {
          setAuth(res.data.user, res.data.token);
          router.push("/dashboard");
        }
      } else {
        const res = await auth.login(form.email, form.password);
        if (res.success && res.data) {
          setAuth(res.data.user, res.data.token);
          router.push("/dashboard");
        }
      }
    } catch {
      toast.error(isSetup ? "Registration failed" : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl gold-accent mb-4">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Stella's Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSetup ? "Create your account to get started" : "Welcome back"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSetup && (
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Stella Jimenez"
              />
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="stella@example.com"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSetup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          AI-powered web management for consultants
        </p>
      </motion.div>
    </div>
  );
}
