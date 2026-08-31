import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Service = "pranzo" | "cena";

type BookingContext = {
  guests: number | null;
  service: Service | null;
  date: string | null;
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
  bookingUrl?: string;
  reply?: string;
  message?: string;
};

function getAdminSupabase() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Configurazione Supabase mancante"
    );
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function formatItalianDate(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function buildMessageWithContext(
  message: string,
  context: BookingContext
) {
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

  const clean =
    message.trim();

  if (
    !context.guests &&
    /^\d{1,2}$/.test(clean)
  ) {
    parts.push(
      `per ${clean} persone`
    );
  } else {
    parts.push(clean);
  }

  return parts.join(" ");
}

function getMissingReply(
  missing: string[]
) {
  if (
    missing.length === 1 &&
    missing.includes("data")
  ) {
    return "Certo 😊 Per quale giorno vuoi prenotare?";
  }

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
    return "Va bene 😊 Preferisci pranzo o cena?";
  }

  if (
    missing.includes("data") &&
    missing.includes(
      "pranzo o cena"
    )
  ) {
    return "Certo 😊 Per quale giorno vuoi prenotare e preferisci pranzo o cena?";
  }

  if (
    missing.includes("data") &&
    missing.includes(
      "numero di persone"
    )
  ) {
    return "Certo 😊 Per quale giorno e per quante persone?";
  }

  if (
    missing.includes(
      "pranzo o cena"
    ) &&
    missing.includes(
      "numero di persone"
    )
  ) {
    return "Va bene 😊 Preferisci pranzo o cena e per quante persone?";
  }

  return "Certo 😊 Indicami giorno, pranzo o cena e numero di persone.";
}

async function sendWhatsAppMessage(
  phone: string,
  message: string
) {
  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN;

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID;

  /*
   * Finché Meta non è configurato,
   * il webhook può comunque essere
   * testato localmente.
   */
  if (
    !accessToken ||
    !phoneNumberId
  ) {
    console.log(
      "WhatsApp non ancora configurato. Risposta simulata:",
      {
        phone,
        message,
      }
    );

    return {
      sent: false,
      simulated: true,
    };
  }

  const response =
    await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          messaging_product:
            "whatsapp",

          to: phone,

          type: "text",

          text: {
            body: message,
          },
        }),
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Errore invio WhatsApp: ${errorText}`
    );
  }

  return {
    sent: true,
    simulated: false,
  };
}

/*
 * ---------------------------------------
 * GET
 * Verifica webhook Meta
 * ---------------------------------------
 */

export async function GET(
  request: Request
) {
  const url =
    new URL(request.url);

  const mode =
    url.searchParams.get(
      "hub.mode"
    );

  const token =
    url.searchParams.get(
      "hub.verify_token"
    );

  const challenge =
    url.searchParams.get(
      "hub.challenge"
    );

  const verifyToken =
    process.env
      .WHATSAPP_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken
  ) {
    return new Response(
      challenge ?? "",
      {
        status: 200,
      }
    );
  }

  return NextResponse.json(
    {
      error:
        "Verifica webhook non valida",
    },
    {
      status: 403,
    }
  );
}

/*
 * ---------------------------------------
 * POST
 * Ricezione messaggi WhatsApp
 * ---------------------------------------
 */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    /*
     * Meta può inviare anche
     * notifiche che non contengono
     * un nuovo messaggio.
     */
    const value =
      body?.entry?.[0]
        ?.changes?.[0]
        ?.value;

    const incomingMessage =
      value?.messages?.[0];

    if (!incomingMessage) {
      return NextResponse.json({
        ok: true,
        ignored: true,
      });
    }

    /*
     * Per ora gestiamo solo
     * messaggi testuali.
     */
    if (
      incomingMessage.type !==
      "text"
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason:
          "Tipo messaggio non supportato",
      });
    }

    const phone =
      typeof incomingMessage.from ===
      "string"
        ? incomingMessage.from.trim()
        : "";

    const message =
      typeof incomingMessage.text
        ?.body === "string"
        ? incomingMessage.text.body.trim()
        : "";

    if (
      !phone ||
      !message
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
      });
    }

    const companyId =
      process.env
        .NEXT_PUBLIC_PILOT_COMPANY_ID;

    if (!companyId) {
      throw new Error(
        "NEXT_PUBLIC_PILOT_COMPANY_ID non configurato"
      );
    }

    const supabase =
      getAdminSupabase();

    /*
     * 1. Recuperiamo eventuale
     * memoria conversazionale.
     */

    const {
      data: conversation,
      error: conversationError,
    } =
      await supabase
        .from(
          "whatsapp_conversations"
        )
        .select(
          "guests, service, reservation_date"
        )
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "phone",
          phone
        )
        .maybeSingle();

    if (conversationError) {
      console.error(
        "Errore lettura conversazione WhatsApp:",
        conversationError
      );
    }

    const context: BookingContext =
      {
        guests:
          conversation?.guests ??
          null,

        service:
          conversation?.service ??
          null,

        date:
          conversation
            ?.reservation_date ??
          null,
      };

    /*
     * 2. Uniamo memoria +
     * nuovo messaggio.
     */

    const bookingMessage =
      buildMessageWithContext(
        message,
        context
      );

    /*
     * 3. Utilizziamo il motore
     * booking-link già testato.
     */

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

    const mergedContext:
      BookingContext = {
        guests:
          bookingData.parsed
            ?.guests ??
          context.guests,

        service:
          bookingData.parsed
            ?.service ??
          context.service,

        date:
          bookingData.parsed
            ?.date ??
          context.date,
      };

    /*
     * 4. Prenotazione completa.
     */

    if (
      bookingResponse.ok &&
      bookingData.complete ===
        true &&
      bookingData.bookingUrl
    ) {
      const reply =
        `Certo 😊 Ho preparato la prenotazione` +
        `${
          mergedContext.guests
            ? ` per ${mergedContext.guests} persone`
            : ""
        }` +
        `${
          mergedContext.service
            ? ` a ${mergedContext.service}`
            : ""
        }` +
        `${
          mergedContext.date
            ? ` per il ${formatItalianDate(
                mergedContext.date
              )}`
            : ""
        }.` +
        `\n\nPuoi vedere gli orari disponibili e completarla qui:\n${bookingData.bookingUrl}`;

      /*
       * La richiesta è completa:
       * eliminiamo la memoria
       * temporanea.
       */

      await supabase
        .from(
          "whatsapp_conversations"
        )
        .delete()
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "phone",
          phone
        );

      const sendResult =
        await sendWhatsAppMessage(
          phone,
          reply
        );

      return NextResponse.json({
        ok: true,

        complete: true,

        phone,

        reply,

        bookingUrl:
          bookingData.bookingUrl,

        sendResult,
      });
    }

    /*
     * 5. Prenotazione incompleta.
     * Salviamo ciò che abbiamo
     * già capito.
     */

    const {
      error: saveError,
    } =
      await supabase
        .from(
          "whatsapp_conversations"
        )
        .upsert(
          {
            company_id:
              companyId,

            phone,

            guests:
              mergedContext.guests,

            service:
              mergedContext.service,

            reservation_date:
              mergedContext.date,

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "company_id,phone",
          }
        );

    if (saveError) {
      throw saveError;
    }

    const missing =
      bookingData.missing ??
      [];

    const reply =
      getMissingReply(
        missing
      );

    const sendResult =
      await sendWhatsAppMessage(
        phone,
        reply
      );

    return NextResponse.json({
      ok: true,

      complete: false,

      phone,

      context:
        mergedContext,

      missing,

      reply,

      sendResult,
    });
  } catch (error) {
    console.error(
      "Errore webhook WhatsApp:",
      error
    );

    /*
     * Meta preferisce ricevere
     * velocemente un 200 per evitare
     * continui retry.
     */
    return NextResponse.json({
      ok: false,
      error:
        "Errore gestione webhook",
    });
  }
}
