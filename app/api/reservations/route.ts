import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type Service = "pranzo" | "cena";

type AtomicReservationResult = {
  ok: boolean;

  reason?: string;
  message?: string;

  reservation?: {
    id: string;
    customer_name: string;
    customer_phone: string | null;
    reservation_date: string;
    reservation_time: string;
    guests: number;
    notes: string | null;
    status: string;
    table_id: string | null;
  };

  table?: {
    id: string;
    name: string;
    seats: number;
    area: string | null;
  };

  maxGuests?: number;
  alreadyBookedGuests?: number;
  remainingGuests?: number;
};

function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number
): string[] {
  const slots: string[] = [];

  const [startHour, startMinute] = startTime
    .split(":")
    .map(Number);

  const [endHour, endMinute] = endTime
    .split(":")
    .map(Number);

  let current =
    startHour * 60 + startMinute;

  let end =
    endHour * 60 + endMinute;

  if (end <= current) {
    end += 24 * 60;
  }

  while (current < end) {
    const normalized =
      current % (24 * 60);

    const hour = Math.floor(
      normalized / 60
    )
      .toString()
      .padStart(2, "0");

    const minute = (
      normalized % 60
    )
      .toString()
      .padStart(2, "0");

    slots.push(
      `${hour}:${minute}`
    );

    current += slotMinutes;
  }

  return slots;
}

export async function POST(
  request: Request
) {
  try {
    /*
     * -----------------------------------------
     * 1. DATI RICEVUTI
     * -----------------------------------------
     */

    const body =
      await request.json();

    const companyId =
      typeof body.companyId === "string"
        ? body.companyId
        : "";

    const customerName =
      typeof body.customerName === "string"
        ? body.customerName.trim()
        : "";

    const customerPhone =
      typeof body.customerPhone === "string"
        ? body.customerPhone.trim()
        : "";

    const customerEmail =
      typeof body.customerEmail === "string"
        ? body.customerEmail.trim()
        : "";

    const reservationDate =
      typeof body.reservationDate === "string"
        ? body.reservationDate
        : "";

    const reservationTime =
      typeof body.reservationTime === "string"
        ? body.reservationTime.slice(0, 5)
        : "";

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    const service =
      body.service as Service;

    const guests =
      Number(body.guests);

    /*
     * -----------------------------------------
     * 2. VALIDAZIONE
     * -----------------------------------------
     */

    if (
      !companyId ||
      !customerName ||
      !customerPhone ||
      !reservationDate ||
      !reservationTime ||
      !["pranzo", "cena"].includes(service) ||
      !Number.isInteger(guests) ||
      guests < 1 ||
      guests > 999
    ) {
      return NextResponse.json(
        {
          error:
            "Dati della prenotazione non validi",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 3. IMPOSTAZIONI RISTORANTE
     * -----------------------------------------
     */

    const {
      data: restaurantSettings,
      error: restaurantSettingsError,
    } = await supabaseAdmin
      .from("restaurant_settings")
      .select(`
        restaurant_name,
        phone,
        table_duration_minutes,
        max_guests_per_reservation
      `)
      .eq(
        "company_id",
        companyId
      )
      .maybeSingle();

    if (restaurantSettingsError) {
      console.error(
        "Errore impostazioni ristorante:",
        restaurantSettingsError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile verificare le impostazioni del ristorante",
        },
        {
          status: 500,
        }
      );
    }

    const restaurantName =
      restaurantSettings
        ?.restaurant_name ??
      null;

    const restaurantPhone =
      restaurantSettings
        ?.phone ??
      null;

    const tableDurationMinutes =
      Number(
        restaurantSettings
          ?.table_duration_minutes ??
          120
      );

    const maxGuestsPerReservation =
      Number(
        restaurantSettings
          ?.max_guests_per_reservation ??
          10
      );

    /*
     * -----------------------------------------
     * 4. LIMITE PRENOTAZIONE ONLINE
     * -----------------------------------------
     */

    if (
      guests >
      maxGuestsPerReservation
    ) {
      return NextResponse.json(
        {
          error:
            restaurantPhone
              ? `Per prenotazioni superiori a ${maxGuestsPerReservation} persone contatta direttamente il locale al ${restaurantPhone}.`
              : `Per prenotazioni superiori a ${maxGuestsPerReservation} persone contatta direttamente il locale.`,

          requiresContact: true,

          phone:
            restaurantPhone,

          restaurantName,

          maxGuestsPerReservation,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------
     * 5. CONTROLLO DATA
     * -----------------------------------------
     */

    const selectedDate =
      new Date(
        `${reservationDate}T12:00:00`
      );

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Data non valida",
        },
        {
          status: 400,
        }
      );
    }

    const selectedDay =
      selectedDate.getDay();

    /*
     * -----------------------------------------
     * 6. CONTROLLO APERTURA E SERVIZIO
     * -----------------------------------------
     */

    const {
      data: availability,
      error: availabilityError,
    } = await supabaseAdmin
      .from(
        "reservation_availability"
      )
      .select(`
        start_time,
        end_time,
        slot_minutes
      `)
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "day_of_week",
        selectedDay
      )
      .eq(
        "service",
        service
      )
      .eq(
        "is_active",
        true
      )
      .limit(1)
      .maybeSingle();

    if (availabilityError) {
      console.error(
        "Errore controllo disponibilità:",
        availabilityError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile verificare la disponibilità",
        },
        {
          status: 500,
        }
      );
    }

    if (!availability) {
      return NextResponse.json(
        {
          error:
            "Il ristorante non è disponibile nella data selezionata",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 7. CONTROLLO CHE L'ORARIO SIA VALIDO
     * -----------------------------------------
     */

    const validSlots =
      generateSlots(
        availability.start_time,
        availability.end_time,
        Number(
          availability.slot_minutes
        )
      );

    if (
      !validSlots.includes(
        reservationTime
      )
    ) {
      return NextResponse.json(
        {
          error:
            "L’orario selezionato non è valido",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * 8. CREAZIONE ATOMICA
     * -----------------------------------------
     *
     * Da questo momento PostgreSQL controlla:
     *
     * - capienza totale
     * - prenotazioni sovrapposte
     * - tavoli disponibili
     * - dimensione del tavolo
     * - assegnazione automatica
     * - inserimento prenotazione
     *
     * tutto nella stessa transazione.
     */

    const {
      data: atomicResult,
      error: atomicError,
    } = await supabaseAdmin.rpc(
      "create_reservation_atomic",
      {
        p_company_id:
          companyId,

        p_customer_name:
          customerName,

        p_customer_phone:
          customerPhone,

        p_reservation_date:
          reservationDate,

        p_reservation_time:
          reservationTime,

        p_guests:
          guests,

        p_notes:
          notes,

        p_table_duration_minutes:
          tableDurationMinutes,
      }
    );

    if (atomicError) {
      console.error(
        "Errore create_reservation_atomic:",
        atomicError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile completare la prenotazione. Riprova.",
        },
        {
          status: 500,
        }
      );
    }

    const result =
      atomicResult as
        | AtomicReservationResult
        | null;

    /*
     * -----------------------------------------
     * 9. PRENOTAZIONE RIFIUTATA
     * -----------------------------------------
     */

    if (
      !result ||
      result.ok !== true
    ) {
      /*
       * Capienza terminata
       */

      if (
        result?.reason ===
        "capacity_full"
      ) {
        return NextResponse.json(
          {
            error:
              result.message ??
              "Questo orario non ha più abbastanza posti disponibili.",

            available:
              false,

            reason:
              "capacity_full",

            maxGuests:
              result.maxGuests,

            alreadyBookedGuests:
              result.alreadyBookedGuests,

            remainingGuests:
              result.remainingGuests,

            tableDurationMinutes,
          },
          {
            status: 409,
          }
        );
      }

      /*
       * Nessun tavolo adatto/libero
       */

      if (
        result?.reason ===
        "no_table_available"
      ) {
        return NextResponse.json(
          {
            error:
              result.message ??
              "Non ci sono tavoli disponibili per questo orario.",

            available:
              false,

            reason:
              "no_table_available",

            noTableAvailable:
              true,

            maxGuests:
              result.maxGuests,

            alreadyBookedGuests:
              result.alreadyBookedGuests,

            remainingGuests:
              result.remainingGuests,

            tableDurationMinutes,
          },
          {
            status: 409,
          }
        );
      }

      /*
       * Capienza non configurata
       */

      if (
        result?.reason ===
        "capacity_not_configured"
      ) {
        return NextResponse.json(
          {
            error:
              result.message ??
              "Capienza del ristorante non configurata.",

            available:
              false,

            reason:
              "capacity_not_configured",
          },
          {
            status: 400,
          }
        );
      }

      /*
       * Altro errore gestito
       */

      return NextResponse.json(
        {
          error:
            result?.message ??
            "Prenotazione non disponibile.",

          available:
            false,

          reason:
            result?.reason ??
            "reservation_unavailable",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -----------------------------------------
     * 10. PRENOTAZIONE CREATA
     * -----------------------------------------
     */

    return NextResponse.json(
      {
        ok: true,

        reservation:
          result.reservation,

        table:
          result.table,

        customerEmail:
          customerEmail ||
          null,

        restaurantName,

        phone:
          restaurantPhone,

        maxGuests:
          result.maxGuests,

        alreadyBookedGuests:
          result.alreadyBookedGuests,

        remainingGuests:
          result.remainingGuests,

        maxGuestsPerReservation,

        tableDurationMinutes,
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
      "Errore API prenotazione:",
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