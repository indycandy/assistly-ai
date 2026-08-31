import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Service = "pranzo" | "cena";

type BookingContext = {
  guests?: number | null;
  service?: Service | null;
  date?: string | null;
};

type BookingLinkResponse = {
  ok?: boolean;
  complete?: boolean;

  parsed?: {
    guests?: number | null;
    service?: Service | null;
    date?: string | null;
  };

  missing?: string[];
  message?: string;
  reply?: string;
  bookingUrl?: string;
};

function hasBookingContext(
  context: BookingContext | null
) {
  return Boolean(
    context?.guests ||
      context?.service ||
      context?.date
  );
}

function looksLikeBookingRequest(
  message: string
) {
  const normalized =
    message.toLowerCase();

  const patterns = [
    /\bprenot/i,
    /\btavol/i,
    /\bpranzo\b/i,
    /\bcena\b/i,
    /\bpranzare\b/i,
    /\bcenare\b/i,
    /\bstasera\b/i,
    /\bdomani\b/i,
    /\bdopodomani\b/i,
    /\bpersone\b/i,
    /\bpersona\b/i,
    /\bcoperti\b/i,
    /\bposti\b/i,
    /\bsiamo\b/i,
    /\bper\s+\d+\b/i,
  ];

  return patterns.some((pattern) =>
    pattern.test(normalized)
  );
}

function formatItalianDate(
  value: string | null | undefined
) {
  if (!value) {
    return "";
  }

  const [year, month, day] =
    value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function buildBookingMessage(
  message: string,
  context: BookingContext | null
) {
  if (!context) {
    return message;
  }

  const parts: string[] = [];

  if (context.date) {
    parts.push(
      formatItalianDate(
        context.date
      )
    );
  }

  if (context.service) {
    parts.push(
      context.service
    );
  }

  if (context.guests) {
    parts.push(
      `per ${context.guests} persone`
    );
  }

  /*
   * Caso tipico:
   *
   * Assistly: Per quante persone?
   * Cliente: 4
   *
   * booking-link normalmente non
   * capirebbe "4" da solo.
   */
  const cleanMessage =
    message.trim();

  if (
    !context.guests &&
    /^\d{1,2}$/.test(
      cleanMessage
    )
  ) {
    parts.push(
      `per ${cleanMessage} persone`
    );
  } else {
    parts.push(
      cleanMessage
    );
  }

  return parts.join(" ");
}

function mergeBookingContext(
  oldContext: BookingContext | null,
  parsed:
    | BookingLinkResponse["parsed"]
    | undefined
): BookingContext {
  return {
    guests:
      parsed?.guests ??
      oldContext?.guests ??
      null,

    service:
      parsed?.service ??
      oldContext?.service ??
      null,

    date:
      parsed?.date ??
      oldContext?.date ??
      null,
  };
}

function getMissingBookingReply(
  missing: string[]
) {
  if (
    missing.length === 1 &&
    missing.includes(
      "numero di persone"
    )
  ) {
    return "Certo 😊 Per quante persone vuoi prenotare?";
  }

  if (
    missing.length === 1 &&
    missing.includes(
      "pranzo o cena"
    )
  ) {
    return "Va bene 😊 Preferisci prenotare a pranzo o a cena?";
  }

  if (
    missing.length === 1 &&
    missing.includes(
      "data"
    )
  ) {
    return "Certo 😊 Per quale giorno vuoi prenotare?";
  }

  if (
    missing.includes(
      "numero di persone"
    ) &&
    missing.includes(
      "pranzo o cena"
    ) &&
    missing.includes("data")
  ) {
    return "Certo 😊 Indicami giorno, pranzo o cena e numero di persone.";
  }

  if (
    missing.includes(
      "pranzo o cena"
    ) &&
    missing.includes("data")
  ) {
    return "Va bene 😊 Per quale giorno vuoi prenotare e preferisci pranzo o cena?";
  }

  if (
    missing.includes(
      "numero di persone"
    ) &&
    missing.includes("data")
  ) {
    return "Certo 😊 Per quale giorno e per quante persone?";
  }

  if (
    missing.includes(
      "numero di persone"
    ) &&
    missing.includes(
      "pranzo o cena"
    )
  ) {
    return "Va bene 😊 Per quante persone e preferisci pranzo o cena?";
  }

  return "Mi servono alcune informazioni in più per preparare la prenotazione.";
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const message =
      typeof body.message ===
      "string"
        ? body.message.trim()
        : "";

    const bookingContext: BookingContext | null =
      body.bookingContext &&
      typeof body.bookingContext ===
        "object"
        ? body.bookingContext
        : null;

    if (!message) {
      return NextResponse.json(
        {
          error:
            "Messaggio non valido",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 1. AUTENTICAZIONE
     */

    const supabase =
      await createClient();

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getClaims();

    const userId =
      authData?.claims?.sub;

    if (
      authError ||
      !userId
    ) {
      return NextResponse.json(
        {
          error:
            "Non autorizzato",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * 2. AZIENDA
     */

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

    if (
      profileError ||
      !profile?.company_id
    ) {
      return NextResponse.json(
        {
          error:
            "Azienda non trovata",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 3. PRENOTAZIONI
     *
     * Continuiamo il flusso anche
     * quando il messaggio corrente
     * è semplicemente "4", "cena",
     * ecc., se abbiamo già un
     * bookingContext.
     */

    const isBooking =
      looksLikeBookingRequest(
        message
      ) ||
      hasBookingContext(
        bookingContext
      );

    if (isBooking) {
      try {
        const bookingMessage =
          buildBookingMessage(
            message,
            bookingContext
          );

        const bookingApiUrl =
          new URL(
            "/api/booking-link",
            request.url
          );

        const bookingResponse =
          await fetch(
            bookingApiUrl,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  message:
                    bookingMessage,
                }),

              cache: "no-store",
            }
          );

        const bookingData =
          (await bookingResponse.json()) as
            BookingLinkResponse;

        const mergedContext =
          mergeBookingContext(
            bookingContext,
            bookingData.parsed
          );

        /*
         * Prenotazione completa.
         */

        if (
          bookingResponse.ok &&
          bookingData.complete ===
            true &&
          bookingData.bookingUrl
        ) {
          const guests =
            mergedContext.guests;

          const service =
            mergedContext.service;

          const date =
            formatItalianDate(
              mergedContext.date
            );

          const reply =
            `Certo 😊 Ho preparato la prenotazione` +
            `${
              guests
                ? ` per ${guests} persone`
                : ""
            }` +
            `${
              service
                ? ` a ${service}`
                : ""
            }` +
            `${
              date
                ? ` per il ${date}`
                : ""
            }.` +
            `\n\nPuoi vedere gli orari disponibili e completarla qui:\n${bookingData.bookingUrl}`;

          return NextResponse.json({
            ok: true,

            type:
              "booking_link",

            message: reply,

            booking: {
              complete: true,

              guests:
                mergedContext.guests ??
                null,

              service:
                mergedContext.service ??
                null,

              date:
                mergedContext.date ??
                null,

              bookingUrl:
                bookingData.bookingUrl,
            },
          });
        }

        /*
         * Prenotazione incompleta.
         */

        if (
          bookingData.complete ===
            false &&
          bookingData.missing &&
          bookingData.missing
            .length > 0
        ) {
          return NextResponse.json({
            ok: true,

            type:
              "booking_question",

            message:
              getMissingBookingReply(
                bookingData.missing
              ),

            booking: {
              complete: false,

              guests:
                mergedContext.guests ??
                null,

              service:
                mergedContext.service ??
                null,

              date:
                mergedContext.date ??
                null,

              missing:
                bookingData.missing,
            },
          });
        }
      } catch (bookingError) {
        console.error(
          "Errore integrazione booking-link:",
          bookingError
        );
      }
    }

    /*
     * 4. PRODOTTI
     */

    const {
      data: products,
      error: productsError,
    } =
      await supabase
        .from("products")
        .select(
          "name, brand, category, price, stock, description, is_active"
        )
        .eq(
          "company_id",
          profile.company_id
        )
        .eq(
          "is_active",
          true
        );

    if (productsError) {
      console.error(
        "Errore caricamento prodotti:",
        productsError
      );
    }

    /*
     * 5. FAQ
     */

    const {
      data: faqs,
      error: faqsError,
    } =
      await supabase
        .from("faqs")
        .select(
          "question, answer, is_active"
        )
        .eq(
          "company_id",
          profile.company_id
        )
        .eq(
          "is_active",
          true
        );

    if (faqsError) {
      console.error(
        "Errore caricamento FAQ:",
        faqsError
      );
    }

    const businessContext = `
PRODOTTI DISPONIBILI:
${(products ?? [])
  .map(
    (product) =>
      `- ${product.name} | Brand: ${
        product.brand ??
        "N/D"
      } | Categoria: ${
        product.category ??
        "N/D"
      } | Prezzo: ${
        product.price ??
        "N/D"
      } | Stock: ${
        product.stock ?? 0
      } | Descrizione: ${
        product.description ??
        "N/D"
      }`
  )
  .join("\n")}

FAQ AZIENDALI:
${(faqs ?? [])
  .map(
    (faq) =>
      `- Domanda: ${faq.question}\n  Risposta: ${faq.answer}`
  )
  .join("\n")}
`;

    /*
     * 6. RISPOSTA AI NORMALE
     */

    const response =
      await openai.responses.create({
        model:
          "gpt-4.1-mini",

        input: [
          {
            role: "system",

            content: `
Sei Assistly AI, assistente clienti dell'azienda.

Rispondi sempre in italiano, in modo chiaro, breve e professionale.

Usa esclusivamente le informazioni aziendali fornite qui sotto quando la domanda riguarda prodotti, prezzi, disponibilità o FAQ.

Se un'informazione non è presente nei dati, non inventarla.
Di' semplicemente che l'informazione non è disponibile e che può essere verificata con un operatore.

${businessContext}
            `,
          },

          {
            role: "user",
            content: message,
          },
        ],
      });

    return NextResponse.json({
      ok: true,
      type: "ai",
      message:
        response.output_text,
    });
  } catch (error) {
    console.error(
      "Errore API chat:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Errore interno",
      },
      {
        status: 500,
      }
    );
  }
}
