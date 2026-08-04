import { NextRequest, NextResponse } from "next/server";
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

  let current = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end <= current) {
    end += 24 * 60;
  }

  while (current < end) {
    const normalized = current % (24 * 60);

    const hour = Math.floor(normalized / 60)
      .toString()
      .padStart(2, "0");

    const minute = (normalized % 60)
      .toString()
      .padStart(2, "0");

    slots.push(`${hour}:${minute}`);
    current += slotMinutes;
  }

  return slots;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const companyId = searchParams.get("companyId");
    const date = searchParams.get("date");
    const guestsParam = searchParams.get("guests");
    const service = searchParams.get("service") as Service | null;

    const guests = Number(guestsParam ?? 1);

    if (
      !companyId ||
      !date ||
      !service ||
      !["pranzo", "cena"].includes(service) ||
      !Number.isInteger(guests) ||
      guests < 1 ||
      guests > 20
    ) {
      return NextResponse.json(
        { error: "Parametri non validi" },
        { status: 400 }
      );
    }

    const selectedDate = new Date(`${date}T12:00:00`);

    if (Number.isNaN(selectedDate.getTime())) {
      return NextResponse.json(
        { error: "Data non valida" },
        { status: 400 }
      );
    }

    const selectedDay = selectedDate.getDay();

    const { data: availability, error: availabilityError } =
      await supabaseAdmin
        .from("reservation_availability")
        .select("start_time, end_time, slot_minutes")
        .eq("company_id", companyId)
        .eq("day_of_week", selectedDay)
        .eq("service", service)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

    if (availabilityError) {
      console.error(
        "Errore caricamento disponibilità:",
        availabilityError
      );

      return NextResponse.json(
        { error: "Impossibile caricare gli orari" },
        { status: 500 }
      );
    }

    if (!availability) {
      return NextResponse.json({
        slots: [],
        message:
          "Nessun orario configurato per il servizio selezionato",
      });
    }

    const { data: capacity, error: capacityError } =
      await supabaseAdmin
        .from("reservation_capacity")
        .select("max_guests")
        .eq("company_id", companyId)
        .eq("day_of_week", selectedDay)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

    if (capacityError) {
      console.error(
        "Errore caricamento capienza:",
        capacityError
      );

      return NextResponse.json(
        { error: "Impossibile caricare la capienza" },
        { status: 500 }
      );
    }

    if (!capacity) {
      return NextResponse.json(
        {
          error:
            "Capienza non configurata per il giorno selezionato",
        },
        { status: 400 }
      );
    }

    const { data: reservations, error: reservationsError } =
      await supabaseAdmin
        .from("reservation")
        .select("reservation_time, guests, status")
        .eq("company_id", companyId)
        .eq("reservation_date", date)
        .neq("status", "cancelled");

    if (reservationsError) {
      console.error(
        "Errore caricamento prenotazioni:",
        reservationsError
      );

      return NextResponse.json(
        { error: "Impossibile verificare gli slot" },
        { status: 500 }
      );
    }

    const generatedTimes = generateSlots(
      availability.start_time,
      availability.end_time,
      Number(availability.slot_minutes)
    );

    const maxGuests = Number(capacity.max_guests);

    const slots = generatedTimes.map((slotTime) => {
      const alreadyBookedGuests = (reservations ?? [])
        .filter(
          (reservation) =>
            String(reservation.reservation_time).slice(0, 5) ===
            slotTime
        )
        .reduce(
          (total, reservation) =>
            total + Number(reservation.guests ?? 0),
          0
        );

      const remainingGuests = Math.max(
        maxGuests - alreadyBookedGuests,
        0
      );

      const available = remainingGuests >= guests;

      let label = "Disponibile";

      if (!available) {
        label = "Completo";
      } else if (remainingGuests <= 5) {
        label = `Ultimi ${remainingGuests} posti`;
      }

      return {
        time: slotTime,
        available,
        remainingGuests,
        label,
      };
    });

    return NextResponse.json(
      {
        slots,
        maxGuests,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Errore API availability:", error);

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}