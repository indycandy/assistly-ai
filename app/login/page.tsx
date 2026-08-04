"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email o password non corretti.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f7fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "36px",
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ marginBottom: "30px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              color: "#111827",
            }}
          >
            Assistly <span style={{ color: "#d946ef" }}>AI</span>
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#64748b",
            }}
          >
            Accedi al tuo assistente aziendale
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 600,
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nome@azienda.it"
            style={{
              width: "100%",
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #dbe1ea",
              borderRadius: "10px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 600,
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #dbe1ea",
              borderRadius: "10px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p
              style={{
                color: "#dc2626",
                marginBottom: "18px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </div>
    </main>
  );
}