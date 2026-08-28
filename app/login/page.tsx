"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginMode =
  | "login"
  | "forgot"
  | "reset";

export default function LoginPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [mode, setMode] =
    useState<LoginMode>("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          setError("");
          setSuccess("");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogin(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(
        "Email o password non corretti."
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleForgotPassword(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(
        "Inserisci il tuo indirizzo email."
      );
      setLoading(false);
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo,
        }
      );

    if (resetError) {
      console.log(
        "Errore recupero password:",
        resetError
      );

      if (
        resetError.message
          .toLowerCase()
          .includes("rate limit")
      ) {
        setError(
          "Sono state effettuate troppe richieste. Attendi qualche minuto prima di riprovare."
        );
      } else {
        setError(
          "Non è stato possibile inviare l'email di recupero. Riprova tra poco."
        );
      }

      setLoading(false);
      return;
    }

    setSuccess(
      "Email inviata. Controlla la posta e clicca sul link per impostare una nuova password."
    );

    setLoading(false);
  }

  async function handleNewPassword(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError(
        "La nuova password deve contenere almeno 8 caratteri."
      );
      setLoading(false);
      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setError(
        "Le due password non coincidono."
      );
      setLoading(false);
      return;
    }

    const { error: updateError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (updateError) {
      console.log(
        "Errore aggiornamento password:",
        updateError
      );

      setError(
        "Il link potrebbe essere scaduto. Richiedi una nuova email di recupero."
      );

      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setMode("login");

    setSuccess(
      "Password aggiornata correttamente. Ora puoi effettuare l'accesso."
    );

    setLoading(false);
  }

  function goToLogin() {
    setMode("login");
    setError("");
    setSuccess("");
    setPassword("");
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
          boxShadow:
            "0 12px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              color: "#111827",
            }}
          >
            Assistly{" "}
            <span
              style={{
                color: "#d946ef",
              }}
            >
              AI
            </span>
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            {mode === "login" &&
              "Accedi al tuo assistente aziendale"}

            {mode === "forgot" &&
              "Recupera l'accesso al tuo account"}

            {mode === "reset" &&
              "Imposta la tua nuova password"}
          </p>
        </div>

        {mode === "login" && (
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
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
              placeholder="nome@azienda.it"
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "20px",
                border:
                  "1px solid #dbe1ea",
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
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "10px",
                border:
                  "1px solid #dbe1ea",
                borderRadius: "10px",
                fontSize: "16px",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                textAlign: "right",
                marginBottom: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "#7c3aed",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Password dimenticata?
              </button>
            </div>

            {error && (
              <Message
                type="error"
                text={error}
              />
            )}

            {success && (
              <Message
                type="success"
                text={success}
              />
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
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                opacity: loading
                  ? 0.7
                  : 1,
              }}
            >
              {loading
                ? "Accesso..."
                : "Accedi"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form
            onSubmit={
              handleForgotPassword
            }
          >
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
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
              placeholder="nome@azienda.it"
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "20px",
                border:
                  "1px solid #dbe1ea",
                borderRadius: "10px",
                fontSize: "16px",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <Message
                type="error"
                text={error}
              />
            )}

            {success && (
              <Message
                type="success"
                text={success}
              />
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "10px",
                background:
                  "linear-gradient(135deg, #d946ef, #7c3aed)",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                opacity: loading
                  ? 0.7
                  : 1,
              }}
            >
              {loading
                ? "Invio..."
                : "Invia email di recupero"}
            </button>

            <button
              type="button"
              onClick={goToLogin}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px",
                border: "none",
                background: "transparent",
                color: "#64748b",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Torna al login
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form
            onSubmit={
              handleNewPassword
            }
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Nuova password
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(
                  e.target.value
                )
              }
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimo 8 caratteri"
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "20px",
                border:
                  "1px solid #dbe1ea",
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
              Conferma password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Ripeti la password"
              style={{
                width: "100%",
                padding: "14px",
                marginBottom: "20px",
                border:
                  "1px solid #dbe1ea",
                borderRadius: "10px",
                fontSize: "16px",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <Message
                type="error"
                text={error}
              />
            )}

            {success && (
              <Message
                type="success"
                text={success}
              />
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "10px",
                background:
                  "linear-gradient(135deg, #d946ef, #7c3aed)",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                opacity: loading
                  ? 0.7
                  : 1,
              }}
            >
              {loading
                ? "Aggiornamento..."
                : "Salva nuova password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Message({
  type,
  text,
}: {
  type: "error" | "success";
  text: string;
}) {
  const isError = type === "error";

  return (
    <div
      style={{
        padding: "12px 14px",
        marginBottom: "18px",
        borderRadius: "10px",
        background: isError
          ? "#fef2f2"
          : "#f0fdf4",
        border: `1px solid ${
          isError
            ? "#fecaca"
            : "#bbf7d0"
        }`,
        color: isError
          ? "#dc2626"
          : "#15803d",
        fontSize: "14px",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}