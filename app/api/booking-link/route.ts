import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Service = "pranzo" | "cena";

type ParsedBookingRequest = {
  guests: number | null;
  service: Service | null;
  date: string | null;
};

const NUMBER_WORDS: Record<
  string,
  number
> = {
  uno: 1,
  una: 1,
  un: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  tredici: 13,
  quattordici: 14,
  quindici: 15,
  sedici: 16,
  diciassette: 17,
  diciotto: 18,
  diciannove: 19,
  venti: 20,
};

const MONTHS: Record<
  string,
  number
> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const WEEKDAYS: Record<
  string,
  number
> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
};

function normalizeText(
  value: string
) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function formatDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
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

function parseNumberWord(
  value: string
) {
  const normalized =
    normalizeText(value);

  return (
    NUMBER_WORDS[
      normalized
    ] ?? null
  );
}

function parseGuests(
  message: string
): number | null {
  const normalized =
    normalizeText(message);

  /*
   * Numeri:
   * "per 4"
   * "4 persone"
   * "siamo in 4"
   */
  const numericPatterns = [
    /(?:per|in)\s+(\d{1,2})\b/i,

    /(\d{1,2})\s*(?:persone|persona|posti|coperti)\b/i,

    /siamo\s+(?:in\s+)?(\d{1,2})\b/i,
  ];

  for (
    const pattern of
      numericPatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

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

  /*
   * Numeri scritti in lettere:
   * "per quattro"
   * "siamo in quattro"
   * "due persone"
   */
  const words =
    Object.keys(
      NUMBER_WORDS
    ).join("|");

  const wordPatterns = [
    new RegExp(
      `(?:per|in)\\s+(${words})\\b`,
      "i"
    ),

    new RegExp(
      `\\b(${words})\\s+(?:persone|persona|posti|coperti)\\b`,
      "i"
    ),

    new RegExp(
      `\\bsiamo\\s+(?:in\\s+)?(${words})\\b`,
      "i"
    ),
  ];

  for (
    const pattern of
      wordPatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (!match) {
      continue;
    }

    const guests =
      parseNumberWord(
        match[1]
      );

    if (
      guests &&
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
    normalizeText(message);

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
    normalizeText(message);

  const today =
    getTodayInRome();

  /*
   * Oggi / domani /
   * dopodomani
   */

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

  /*
   * Formato numerico:
   * 05/09
   * 5-9
   * 05/09/2026
   */

  const numericDate =
    normalized.match(
      /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
    );

  if (numericDate) {
    const day =
      Number(
        numericDate[1]
      );

    const month =
      Number(
        numericDate[2]
      );

    let year =
      numericDate[3]
        ? Number(
            numericDate[3]
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
      if (
        !numericDate[3] &&
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

  /*
   * Data scritta:
   * "5 settembre"
   * "il 5 settembre"
   * "5 settembre 2026"
   */

  const monthNames =
    Object.keys(
      MONTHS
    ).join("|");

  const writtenDate =
    normalized.match(
      new RegExp(
        `\\b(?:il\\s+)?(\\d{1,2})\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
        "i"
      )
    );

  if (writtenDate) {
    const day =
      Number(
        writtenDate[1]
      );

    const month =
      MONTHS[
        writtenDate[2]
      ];

    let year =
      writtenDate[3]
        ? Number(
            writtenDate[3]
          )
        : today.getFullYear();

    let candidate =
      new Date(
        year,
        month - 1,
        day,
        12,
        0,
        0
      );

    if (
      candidate.getFullYear() !==
        year ||
      candidate.getMonth() !==
        month - 1 ||
      candidate.getDate() !==
        day
    ) {
      return null;
    }

    if (
      !writtenDate[3] &&
      candidate < today
    ) {
      year += 1;

      candidate =
        new Date(
          year,
          month - 1,
          day,
          12,
          0,
          0
        );
    }

    return formatDate(
      candidate
    );
  }

  /*
   * Giorni della settimana:
   * sabato
   * venerdì
   * sabato prossimo
   * questo sabato
   */

  for (
    const [
      weekdayName,
      weekdayNumber,
    ] of Object.entries(
      WEEKDAYS
    )
  ) {
    const weekdayRegex =
      new RegExp(
        `\\b(?:questo\\s+)?${weekdayName}(?:\\s+prossimo)?\\b`,
        "i"
      );

    if (
      !weekdayRegex.test(
        normalized
      )
    ) {
      continue;
    }

    const currentDay =
      today.getDay();

    let difference =
      (
        weekdayNumber -
        currentDay +
        7
      ) % 7;

    /*
     * Se scrive il nome
     * del giorno che è oggi,
     * interpretiamo oggi.
     */
    const candidate =
      addDays(
        today,
        difference
      );

    return formatDate(
      candidate
    );
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

function formatItalianDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value.split("-");

  return `${day}/${month}/${year}`;
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

    const friendlyDate =
      formatItalianDate(
        parsed.date!
      );

    return NextResponse.json(
      {
        ok: true,

        complete: true,

        parsed,

        bookingUrl,

        reply:
          `Certo 👌 Ho trovato la richiesta per ${parsed.guests} persone a ${parsed.service} il ${friendlyDate}. Puoi vedere gli orari disponibili qui: ${bookingUrl}`,
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
