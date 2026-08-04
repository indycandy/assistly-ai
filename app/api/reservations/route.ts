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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const companyId =
      typeof body.companyId === "string" ? body.companyId : "";

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
      typeof body.notes === "string" ? body.notes.trim() : "";

    const service = body.service as Service;
    const guests = Number(body.guests);

    if (
      !companyId ||
      !customerName ||
      !customerPhone ||
      !reservationDate ||
      !reservationTime ||
      !["pranzo", "cena"].includes(service) ||
      !Number.isInteger(guests) ||
      guests < 1 ||
      guests > 20
    ) {
      return NextResponse.json(
        { error: "Dati della prenotazione non validi" },
        { status: 400 }
      );
    }

    const selectedDate = new Date(
      `${reservationDate}T12:00:00`
    );

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
        "Errore controllo disponibilità:",
        availabilityError
      );

      return NextResponse.json(
        { error: "Impossibile verificare la disponibilità" },
        { status: 500 }
      );
    }

    if (!availability) {
      return NextResponse.json(
        {
          error:
            "Il ristorante non è disponibile nella data selezionata",
        },
        { status: 400 }
      );
    }

    const validSlots = generateSlots(
      availability.start_time,
      availability.end_time,
      Number(availability.slot_minutes)
    );

    if (!validSlots.includes(reservationTime)) {
      return NextResponse.json(
        { error: "L’orario selezionato non è valido" },
        { status: 400 }
      );
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
        "Errore controllo capienza:",
        capacityError
      );

      return NextResponse.json(
        { error: "Impossibile verificare la capienza" },
        { status: 500 }
      );
    }

    if (!capacity) {
      return NextResponse.json(
        { error: "Capienza del ristorante non configurata" },
        { status: 400 }
      );
    }

    const { data: existingReservations, error: reservationsError } =
      await supabaseAdmin
        .from("reservation")
        .select("guests")
        .eq("company_id", companyId)
        .eq("reservation_date", reservationDate)
        .eq("reservation_time", reservationTime)
        .neq("status", "cancelled");

    if (reservationsError) {
      console.error(
        "Errore controllo prenotazioni:",
        reservationsError
      );

      return NextResponse.json(
        { error: "Impossibile verificare i posti disponibili" },
        { status: 500 }
      );
    }

    const alreadyBookedGuests = (
      existingReservations ?? []
    ).reduce(
      (total, reservation) =>
        total + Number(reservation.guests ?? 0),
      0
    );

    const maxGuests = Number(capacity.max_guests);
    const remainingGuests = maxGuests - alreadyBookedGuests;

    if (remainingGuests < guests) {
      return NextResponse.json(
        {
          error:
            "Questo orario non ha abbastanza posti disponibili. Scegli un altro slot.",
        },
        { status: 409 }
      );
    }

    const { data: newReservation, error: insertError } =
      await supabaseAdmin
        .from("reservation")
        .insert({
          company_id: companyId,
          customer_name: customerName,
          customer_phone: customerPhone,
          reservation_date: reservationDate,
          reservation_time: reservationTime,
          guests,
          notes: notes || null,
          status: "pending",
        })
        .select(
          "id, customer_name, customer_phone, reservation_date, reservation_time, guests, notes, status"
        )
        .single();

    if (insertError || !newReservation) {
      console.error(
        "Errore inserimento prenotazione:",
        insertError
      );

      return NextResponse.json(
        { error: "Impossibile salvare la prenotazione" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservation: newReservation,
      customerEmail: customerEmail || null,
      remainingGuests: remainingGuests - guests,
    });
  } catch (error) {
    console.error("Errore API prenotazione:", error);

    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}