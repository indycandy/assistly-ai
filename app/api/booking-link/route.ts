import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Service = "pranzo" | "cena";

type ParsedBookingRequest = {
  guests: number | null;
  service: Service | null;
  date: string | null;
};

type AIParsedBookingRequest = {
  guests?: number | null;
  service?: Service | null;
  date?: string | null;
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

    const difference =
      (
        weekdayNumber -
        currentDay +
        7
      ) % 7;

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

function isValidDateString(
  value: unknown
): value is string {
  if (
    typeof value !==
    "string"
  ) {
    return false;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(Number);

  const candidate =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );

  return (
    candidate.getFullYear() ===
      year &&
    candidate.getMonth() ===
      month - 1 &&
    candidate.getDate() ===
      day
  );
}

function cleanAIJson(
  value: string
) {
  return value
    .trim()
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();
}

async function enrichWithAI(
  message: string,
  current:
    ParsedBookingRequest
): Promise<ParsedBookingRequest> {
  /*
   * Se il parser normale ha già
   * capito tutto, NON usiamo AI.
   */
  if (
    current.guests &&
    current.service &&
    current.date
  ) {
    return current;
  }

  /*
   * Se la chiave non è configurata,
   * continuiamo normalmente senza AI.
   */
  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    return current;
  }

  try {
    const today =
      formatDate(
        getTodayInRome()
      );

    const response =
      await openai.responses.create({
        model:
          "gpt-4.1-mini",

        input: [
          {
            role: "system",

            content: `
Sei un parser di richieste di prenotazione ristorante.

Devi estrarre ESCLUSIVAMENTE:
- guests: numero di persone
- service: "pranzo" oppure "cena"
- date: data in formato YYYY-MM-DD

La data di oggi in Italia (Europe/Rome) è ${today}.

REGOLE IMPORTANTI:

1. Rispondi SOLO con JSON valido.
2. Non aggiungere spiegazioni.
3. Se un dato non è chiaramente ricavabile, usa null.
4. Non inventare mai dati.
5. guests deve essere un intero tra 1 e 30 oppure null.
6. service può essere soltanto "pranzo", "cena" oppure null.
7. date deve essere YYYY-MM-DD oppure null.
8. Interpreta espressioni naturali italiane come:
   - io e mia moglie = 2 persone
   - io e mio marito = 2 persone
   - siamo io, mia moglie e mio figlio = 3 persone
   - verso sera = cena
   - a mezzogiorno = pranzo
9. Se viene indicato un intervallo ambiguo come "questo weekend" senza un giorno preciso, NON scegliere arbitrariamente sabato o domenica: date deve essere null.
10. Non modificare i valori che il parser deterministico ha già trovato.

Valori già trovati dal parser:
${JSON.stringify(current)}

Formato esatto:
{
  "guests": number | null,
  "service": "pranzo" | "cena" | null,
  "date": "YYYY-MM-DD" | null
}
            `,
          },

          {
            role: "user",
            content: message,
          },
        ],
      });

    const clean =
      cleanAIJson(
        response.output_text
      );

    const aiResult =
      JSON.parse(
        clean
      ) as AIParsedBookingRequest;

    let aiGuests:
      number | null =
        null;

    if (
      typeof aiResult.guests ===
        "number" &&
      Number.isInteger(
        aiResult.guests
      ) &&
      aiResult.guests >= 1 &&
      aiResult.guests <= 30
    ) {
      aiGuests =
        aiResult.guests;
    }

    let aiService:
      Service | null =
        null;

    if (
      aiResult.service ===
        "pranzo" ||
      aiResult.service ===
        "cena"
    ) {
      aiService =
        aiResult.service;
    }

    let aiDate:
      string | null =
        null;

    if (
      isValidDateString(
        aiResult.date
      )
    ) {
      aiDate =
        aiResult.date;
    }

    /*
     * I dati deterministici
     * hanno sempre la precedenza.
     */
    return {
      guests:
        current.guests ??
        aiGuests,

      service:
        current.service ??
        aiService,

      date:
        current.date ??
        aiDate,
    };
  } catch (error) {
    /*
     * Se OpenAI non risponde,
     * restituisce JSON non valido
     * o c'è qualsiasi problema,
     * il sistema continua usando
     * il parser normale.
     */

    console.error(
      "Fallback AI booking-link:",
      error
    );

    return current;
  }
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

    /*
     * PRIMA:
     * parser rapido e gratuito.
     */
    const deterministic =
      parseMessage(message);

    /*
     * DOPO:
     * AI solo se manca
     * almeno un'informazione.
     */
    const parsed =
      await enrichWithAI(
        message,
        deterministic
      );

    const usedAI =
      (
        !deterministic.guests ||
        !deterministic.service ||
        !deterministic.date
      ) &&
      (
        parsed.guests !==
          deterministic.guests ||
        parsed.service !==
          deterministic.service ||
        parsed.date !==
          deterministic.date
      );

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

        parser:
          usedAI
            ? "ai_fallback"
            : "deterministic",

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

        parser:
          usedAI
            ? "ai_fallback"
            : "deterministic",

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
