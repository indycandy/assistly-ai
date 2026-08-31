import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Service = "pranzo" | "cena";

type ParsedBookingRequest = {
  guests: number | null;
  service: Service | null;
  date: string | null;
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayInRome() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const year =
    Number(
      parts.find(
        (part) =>
          part.type === "year"
      )?.value
    );

  const month =
    Number(
      parts.find(
        (part) =>
          part.type === "month"
      )?.value
    );

  const day =
    Number(
      parts.find(
        (part) =>
          part.type === "day"
      )?.value
    );

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );
}

function addDays(
  date: Date,
  days: number
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function parseGuests(
  message: string
): number | null {
  const patterns = [
    /(?:per|in)\s+(\d{1,2})\b/i,
    /(\d{1,2})\s*(?:persone|persona|posti|coperti)\b/i,
    /siamo\s+(?:in\s+)?(\d{1,2})\b/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      message.match(pattern);

    if (!match) {
      continue;
    }

    const guests =
      Number(match[1]);

    if (
      Number.isInteger(
        guests
      ) &&
      guests >= 1 &&
      guests <= 30
    ) {
      return guests;
    }
  }

  return null;
}

function parseService(
  message: string
): Service | null {
  const normalized =
    message.toLowerCase();

  if (
    normalized.includes(
      "pranzo"
    ) ||
    normalized.includes(
      "pranzare"
    ) ||
    normalized.includes(
      "mezzogiorno"
    )
  ) {
    return "pranzo";
  }

  if (
    normalized.includes(
      "cena"
    ) ||
    normalized.includes(
      "cenare"
    ) ||
    normalized.includes(
      "sera"
    ) ||
    normalized.includes(
      "stasera"
    )
  ) {
    return "cena";
  }

  return null;
}

function parseDate(
  message: string
): string | null {
  const normalized =
    message.toLowerCase();

  const today =
    getTodayInRome();

  if (
    normalized.includes(
      "dopodomani"
    )
  ) {
    return formatDate(
      addDays(today, 2)
    );
  }

  if (
    normalized.includes(
      "domani"
    )
  ) {
    return formatDate(
      addDays(today, 1)
    );
  }

  if (
    normalized.includes(
      "oggi"
    ) ||
    normalized.includes(
      "stasera"
    )
  ) {
    return formatDate(
      today
    );
  }

  const italianDateMatch =
    normalized.match(
      /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
    );

  if (
    italianDateMatch
  ) {
    const day =
      Number(
        italianDateMatch[1]
      );

    const month =
      Number(
        italianDateMatch[2]
      );

    let year =
      italianDateMatch[3]
        ? Number(
            italianDateMatch[3]
          )
        : today.getFullYear();

    if (year < 100) {
      year += 2000;
    }

    const candidate =
      new Date(
        year,
        month - 1,
        day,
        12,
        0,
        0
      );

    if (
      candidate.getFullYear() ===
        year &&
      candidate.getMonth() ===
        month - 1 &&
      candidate.getDate() ===
        day
    ) {
      /*
       * Se il cliente scrive
       * solo giorno/mese e quella
       * data è già passata,
       * interpretiamo l'anno
       * successivo.
       */
      if (
        !italianDateMatch[3] &&
        candidate < today
      ) {
        candidate.setFullYear(
          year + 1
        );
      }

      return formatDate(
        candidate
      );
    }
  }

  return null;
}

function parseMessage(
  message: string
): ParsedBookingRequest {
  return {
    guests:
      parseGuests(message),

    service:
      parseService(message),

    date:
      parseDate(message),
  };
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

    const parsed =
      parseMessage(message);

    const missing: string[] =
      [];

    if (!parsed.guests) {
      missing.push(
        "numero di persone"
      );
    }

    if (!parsed.service) {
      missing.push(
        "pranzo o cena"
      );
    }

    if (!parsed.date) {
      missing.push(
        "data"
      );
    }

    /*
     * Se mancano informazioni
     * non inventiamo nulla.
     * Assistly potrà chiedere
     * al cliente solo ciò che manca.
     */
    if (
      missing.length > 0
    ) {
      return NextResponse.json({
        ok: false,

        complete: false,

        parsed,

        missing,

        message:
          `Mi manca: ${missing.join(
            ", "
          )}.`,
      });
    }

    const params =
      new URLSearchParams({
        guests:
          String(
            parsed.guests
          ),

        service:
          parsed.service!,

        date:
          parsed.date!,
      });

    const baseUrl =
      process.env
        .NEXT_PUBLIC_APP_URL ??
      "https://assistly-ai-indy4.vercel.app";

    const bookingUrl =
      `${baseUrl}/prenota?${params.toString()}`;

    return NextResponse.json(
      {
        ok: true,

        complete: true,

        parsed,

        bookingUrl,

        reply:
          `Certo 👌 Ho trovato la richiesta per ${parsed.guests} persone a ${parsed.service} il ${parsed.date}. Puoi vedere gli orari disponibili qui: ${bookingUrl}`,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Errore booking-link:",
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
