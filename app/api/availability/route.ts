import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

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

type ReservationRow = {
  reservation_time: string;
  guests: number | null;
  status: string | null;
  table_id: string | null;
};

type RestaurantTable = {
  id: string;
  table_name: string;
  seats: number;
  area: string | null;
};

function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number
): string[] {
  const slots: string[] = [];

  const [startHour, startMinute] =
    startTime
      .split(":")
      .map(Number);

  const [endHour, endMinute] =
    endTime
      .split(":")
      .map(Number);

  let current =
    startHour * 60 +
    startMinute;

  let end =
    endHour * 60 +
    endMinute;

  if (end <= current) {
    end += 24 * 60;
  }

  while (current < end) {
    const normalized =
      current % (24 * 60);

    const hour =
      Math.floor(normalized / 60)
        .toString()
        .padStart(2, "0");

    const minute =
      (normalized % 60)
        .toString()
        .padStart(2, "0");

    slots.push(
      `${hour}:${minute}`
    );

    current += slotMinutes;
  }

  return slots;
}

function timeToMinutes(
  time: string
): number {
  const [hour, minute] =
    String(time)
      .slice(0, 5)
      .split(":")
      .map(Number);

  return (
    hour * 60 +
    minute
  );
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
) {
  return (
    startA < endB &&
    startB < endA
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl.searchParams;

    const companyId =
      searchParams.get(
        "companyId"
      );

    const date =
      searchParams.get(
        "date"
      );

    const guestsParam =
      searchParams.get(
        "guests"
      );

    const service =
      searchParams.get(
        "service"
      ) as Service | null;

    const guests =
      Number(
        guestsParam ?? 1
      );

    if (
      !companyId ||
      !date ||
      !service ||
      ![
        "pranzo",
        "cena",
      ].includes(service) ||
      !Number.isInteger(
        guests
      ) ||
      guests < 1 ||
      guests > 999
    ) {
      return NextResponse.json(
        {
          error:
            "Parametri non validi",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------
     * 1. IMPOSTAZIONI RISTORANTE
     * ----------------------------------
     */

    const {
      data: restaurantSettings,
      error:
        restaurantSettingsError,
    } = await supabaseAdmin
      .from(
        "restaurant_settings"
      )
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

    if (
      restaurantSettingsError
    ) {
      console.error(
        "Errore impostazioni ristorante:",
        restaurantSettingsError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile caricare le impostazioni del ristorante",
        },
        {
          status: 500,
        }
      );
    }

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

    const restaurantPhone =
      restaurantSettings
        ?.phone ??
      null;

    const restaurantName =
      restaurantSettings
        ?.restaurant_name ??
      null;

    /*
     * ----------------------------------
     * 2. GRUPPI NUMEROSI
     * ----------------------------------
     */

    if (
      guests >
      maxGuestsPerReservation
    ) {
      const message =
        restaurantPhone
          ? `Per prenotazioni superiori a ${maxGuestsPerReservation} persone contatta direttamente il locale al ${restaurantPhone}.`
          : `Per prenotazioni superiori a ${maxGuestsPerReservation} persone contatta direttamente il locale per verificare la disponibilità.`;

      return NextResponse.json(
        {
          slots: [],

          requiresContact:
            true,

          contactReason:
            "large_group",

          message,

          phone:
            restaurantPhone,

          restaurantName,

          requestedGuests:
            guests,

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
    }

    /*
     * ----------------------------------
     * 3. DATA
     * ----------------------------------
     */

    const selectedDate =
      new Date(
        `${date}T12:00:00`
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
     * ----------------------------------
     * 4. ORARI
     * ----------------------------------
     */

    const {
      data: availability,
      error:
        availabilityError,
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

    if (
      availabilityError
    ) {
      console.error(
        "Errore caricamento disponibilità:",
        availabilityError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile caricare gli orari",
        },
        {
          status: 500,
        }
      );
    }

    if (!availability) {
      return NextResponse.json({
        slots: [],

        message:
          "Nessun orario configurato per il servizio selezionato",

        requiresContact:
          false,
      });
    }

    /*
     * ----------------------------------
     * 5. CAPIENZA GENERALE
     * ----------------------------------
     */

    const {
      data: capacity,
      error:
        capacityError,
    } = await supabaseAdmin
      .from(
        "reservation_capacity"
      )
      .select(
        "max_guests"
      )
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "day_of_week",
        selectedDay
      )
      .eq(
        "is_active",
        true
      )
      .limit(1)
      .maybeSingle();

    if (capacityError) {
      console.error(
        "Errore caricamento capienza:",
        capacityError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile caricare la capienza",
        },
        {
          status: 500,
        }
      );
    }

    if (!capacity) {
      return NextResponse.json(
        {
          error:
            "Capienza non configurata per il giorno selezionato",
        },
        {
          status: 400,
        }
      );
    }

    const maxGuests =
      Number(
        capacity.max_guests
      );

    /*
     * ----------------------------------
     * 6. TAVOLI REALI
     * ----------------------------------
     */

    const {
      data: tables,
      error:
        tablesError,
    } = await supabaseAdmin
      .from(
        "restaurant_tables"
      )
      .select(`
        id,
        table_name,
        seats,
        area
      `)
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "seats",
        {
          ascending: true,
        }
      );

    if (tablesError) {
      console.error(
        "Errore caricamento tavoli:",
        tablesError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile caricare i tavoli",
        },
        {
          status: 500,
        }
      );
    }

    const activeTables =
      (tables ??
        []) as RestaurantTable[];

    /*
     * Tavoli che possono
     * fisicamente ospitare
     * il gruppo.
     */

    const suitableTables =
      activeTables.filter(
        (table) =>
          Number(
            table.seats
          ) >= guests
      );

    /*
     * Se non esiste neanche
     * un tavolo abbastanza grande,
     * non ha senso mostrare slot.
     */

    if (
      suitableTables.length ===
      0
    ) {
      return NextResponse.json(
        {
          slots: [],

          requiresContact:
            false,

          noSuitableTable:
            true,

          message:
            `Non è disponibile un tavolo singolo per ${guests} persone.`,

          maxGuests,

          maxGuestsPerReservation,

          tableDurationMinutes,

          phone:
            restaurantPhone,

          restaurantName,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * ----------------------------------
     * 7. PRENOTAZIONI DEL GIORNO
     * ----------------------------------
     */

    const {
      data: reservations,
      error:
        reservationsError,
    } = await supabaseAdmin
      .from("reservation")
      .select(`
        reservation_time,
        guests,
        status,
        table_id
      `)
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "reservation_date",
        date
      )
      .neq(
        "status",
        "cancelled"
      );

    if (
      reservationsError
    ) {
      console.error(
        "Errore caricamento prenotazioni:",
        reservationsError
      );

      return NextResponse.json(
        {
          error:
            "Impossibile verificare gli slot",
        },
        {
          status: 500,
        }
      );
    }

    const reservationRows =
      (reservations ??
        []) as ReservationRow[];

    /*
     * ----------------------------------
     * 8. GENERAZIONE SLOT
     * ----------------------------------
     */

    const generatedTimes =
      generateSlots(
        availability.start_time,
        availability.end_time,
        Number(
          availability.slot_minutes
        )
      );

    const slots =
      generatedTimes.map(
        (slotTime) => {
          const slotStart =
            timeToMinutes(
              slotTime
            );

          const slotEnd =
            slotStart +
            tableDurationMinutes;

          /*
           * Prenotazioni che
           * si sovrappongono
           * temporalmente.
           */

          const overlappingReservations =
            reservationRows.filter(
              (
                reservation
              ) => {
                const reservationStart =
                  timeToMinutes(
                    reservation
                      .reservation_time
                  );

                const reservationEnd =
                  reservationStart +
                  tableDurationMinutes;

                return intervalsOverlap(
                  slotStart,
                  slotEnd,
                  reservationStart,
                  reservationEnd
                );
              }
            );

          /*
           * Capacità generale
           */

          const alreadyBookedGuests =
            overlappingReservations.reduce(
              (
                total,
                reservation
              ) =>
                total +
                Number(
                  reservation.guests ??
                    0
                ),
              0
            );

          const remainingGuests =
            Math.max(
              maxGuests -
                alreadyBookedGuests,
              0
            );

          const capacityAvailable =
            remainingGuests >=
            guests;

          /*
           * Tavoli già occupati
           * nell'intervallo.
           */

          const occupiedTableIds =
            new Set(
              overlappingReservations
                .map(
                  (
                    reservation
                  ) =>
                    reservation.table_id
                )
                .filter(
                  (
                    tableId
                  ): tableId is string =>
                    Boolean(
                      tableId
                    )
                )
            );

          /*
           * Tavoli adatti e
           * liberi nell'intervallo.
           */

          const freeSuitableTables =
            suitableTables.filter(
              (table) =>
                !occupiedTableIds.has(
                  table.id
                )
            );

          /*
           * Essendo ordinati
           * per numero di posti,
           * prendiamo il tavolo
           * più piccolo possibile.
           */

          const suggestedTable =
            freeSuitableTables[
              0
            ] ?? null;

          const tableAvailable =
            Boolean(
              suggestedTable
            );

          const available =
            capacityAvailable &&
            tableAvailable;

          let label =
            "Disponibile";

          if (
            !capacityAvailable
          ) {
            label =
              "Completo";
          } else if (
            !tableAvailable
          ) {
            label =
              "Nessun tavolo libero";
          } else if (
            remainingGuests <=
            5
          ) {
            label =
              `Ultimi ${remainingGuests} posti`;
          }

          return {
            time:
              slotTime,

            available,

            remainingGuests,

            alreadyBookedGuests,

            label,

            /*
             * Informazioni utili
             * per il prossimo step.
             */

            suggestedTableId:
              suggestedTable
                ?.id ??
              null,

            suggestedTableName:
              suggestedTable
                ?.table_name ??
              null,

            suggestedTableSeats:
              suggestedTable
                ?.seats ??
              null,

            suggestedTableArea:
              suggestedTable
                ?.area ??
              null,

            freeSuitableTables:
              freeSuitableTables.length,
          };
        }
      );

    /*
     * ----------------------------------
     * 9. RISPOSTA
     * ----------------------------------
     */

    return NextResponse.json(
      {
        slots,

        maxGuests,

        maxGuestsPerReservation,

        tableDurationMinutes,

        requiresContact:
          false,

        phone:
          restaurantPhone,

        restaurantName,

        activeTables:
          activeTables.length,

        suitableTables:
          suitableTables.length,
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
      "Errore API availability:",
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