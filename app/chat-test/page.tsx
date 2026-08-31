"use client";

import {
  FormEvent,
  useState,
} from "react";

type BookingState = {
  complete?: boolean;
  guests?: number | null;
  service?: string | null;
  date?: string | null;
  bookingUrl?: string;
  missing?: string[];
};

type ChatResponse = {
  ok?: boolean;
  type?: string;
  message?: string;
  booking?: BookingState;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function renderMessageText(
  text: string
) {
  const parts = text.split(
    /(https?:\/\/[^\s]+)/g
  );

  return parts.map(
    (part, index) => {
      if (
        part.startsWith("http://") ||
        part.startsWith("https://")
      ) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#2563eb",
              fontWeight: 700,
              textDecoration:
                "underline",
              wordBreak:
                "break-all",
            }}
          >
            {part}
          </a>
        );
      }

      return part;
    }
  );
}
export default function ChatTestPage() {
  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [
    bookingContext,
    setBookingContext,
  ] =
    useState<BookingState | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  async function sendMessage(
    event: FormEvent
  ) {
    event.preventDefault();

    const cleanMessage =
      message.trim();

    if (!cleanMessage) {
      return;
    }

    setMessages(
      (current) => [
        ...current,
        {
          role: "user",
          text: cleanMessage,
        },
      ]
    );

    setMessage("");
    setLoading(true);

    try {
      const apiResponse =
        await fetch("/api/chat", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message:
              cleanMessage,

            bookingContext,
          }),
        });

      const data =
        (await apiResponse.json()) as
          ChatResponse;

      if (data.error) {
        setMessages(
          (current) => [
            ...current,
            {
              role:
                "assistant",
              text:
                `Errore: ${data.error}`,
            },
          ]
        );

        return;
      }

      if (data.booking) {
        setBookingContext(
          data.booking
        );
      }

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",

            text:
              data.message ??
              "Nessuna risposta.",
          },
        ]
      );
    } catch (error) {
      console.error(
        "Errore chat test:",
        error
      );

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            text:
              "Errore di connessione.",
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setMessage("");
    setBookingContext(null);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "#f5f7fb",
        padding: "40px 20px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 1,
                color: "#6b7280",
              }}
            >
              ASSISTLY AI
            </div>

            <h1
              style={{
                margin:
                  "8px 0 0",
                fontSize: 32,
                color: "#111827",
              }}
            >
              Test conversazione
            </h1>

            <p
              style={{
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              Prova una vera
              conversazione di
              prenotazione.
            </p>
          </div>

          <button
            type="button"
            onClick={
              resetConversation
            }
            style={{
              border:
                "1px solid #d1d5db",
              background:
                "#ffffff",
              borderRadius: 10,
              padding:
                "10px 14px",
              cursor: "pointer",
            }}
          >
            Nuova chat
          </button>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 20,
            minHeight: 350,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          {messages.length ===
          0 ? (
            <div
              style={{
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              Inizia scrivendo ad
              esempio:
              <br />
              <strong>
                vorrei prenotare
                domani sera
              </strong>
            </div>
          ) : (
            messages.map(
              (
                chatMessage,
                index
              ) => (
                <div
                  key={index}
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      chatMessage.role ===
                      "user"
                        ? "flex-end"
                        : "flex-start",

                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      maxWidth:
                        "80%",

                      padding:
                        "12px 14px",

                      borderRadius:
                        14,

                      background:
                        chatMessage.role ===
                        "user"
                          ? "#111827"
                          : "#f3f4f6",

                      color:
                        chatMessage.role ===
                        "user"
                          ? "#ffffff"
                          : "#111827",

                      whiteSpace:
                        "pre-wrap",

                      lineHeight:
                        1.5,
                    }}
                  >
                    {
                      renderMessageText(
  chatMessage.text
)
                    }
                  </div>
                </div>
              )
            )
          )}

          {loading && (
            <div
              style={{
                color: "#6b7280",
                marginTop: 10,
              }}
            >
              Assistly sta
              pensando...
            </div>
          )}
        </div>

        <form
          onSubmit={sendMessage}
          style={{
            marginTop: 16,
            background: "#ffffff",
            borderRadius: 18,
            padding: 16,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <textarea
            value={message}
            onChange={(event) =>
              setMessage(
                event.target.value
              )
            }
            placeholder="Scrivi un messaggio..."
            rows={3}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border:
                "1px solid #d1d5db",
              fontSize: 16,
              resize: "vertical",
              boxSizing:
                "border-box",
            }}
          />

          <button
            type="submit"
            disabled={
              loading ||
              !message.trim()
            }
            style={{
              width: "100%",
              marginTop: 10,
              padding: 14,
              border: 0,
              borderRadius: 12,
              background:
                "#111827",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 16,
              cursor:
                loading
                  ? "wait"
                  : "pointer",
            }}
          >
            Invia
          </button>
        </form>

        {bookingContext && (
          <div
            style={{
              marginTop: 16,
              background: "#ffffff",
              padding: 16,
              borderRadius: 14,
              fontSize: 14,
              color: "#4b5563",
            }}
          >
            <strong>
              Memoria prenotazione
            </strong>

            <div
              style={{
                marginTop: 8,
              }}
            >
              Persone:{" "}
              {bookingContext.guests ??
                "—"}
              {" · "}
              Servizio:{" "}
              {bookingContext.service ??
                "—"}
              {" · "}
              Data:{" "}
              {bookingContext.date ??
                "—"}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
