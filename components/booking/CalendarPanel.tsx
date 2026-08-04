"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReservationStatus = "pending" | "confirmed" | "cancelled";

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  notes: string | null;
  status: ReservationStatus;
};

const statusLabels: Record<ReservationStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

export default function CalendarPanel() {
  const [selectedDate, setSelectedDate] = useState(
    getLocalDateValue(new Date())
  );

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("reservation")
      .select(
        `
          id,
          customer_name,
          customer_phone,
          reservation_date,
          reservation_time,
          guests,
          notes,
          status
        `
      )
      .eq("reservation_date", selectedDate)
      .order("reservation_time", { ascending: true });

    if (error) {
      console.error("Errore calendario prenotazioni:", error);
      setReservations([]);
      setErrorMessage(
        "Non è stato possibile caricare le prenotazioni."
      );
      setLoading(false);
      return;
    }

    setReservations((data ?? []) as Reservation[]);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const activeReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.status !== "cancelled"
      ),
    [reservations]
  );

  const totalGuests = useMemo(
    () =>
      activeReservations.reduce(
        (total, reservation) =>
          total + Number(reservation.guests ?? 0),
        0
      ),
    [activeReservations]
  );

  const confirmedReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.status === "confirmed"
      ).length,
    [reservations]
  );

  const pendingReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.status === "pending"
      ).length,
    [reservations]
  );

  const groupedReservations = useMemo(() => {
    const groups = new Map<string, Reservation[]>();

    reservations.forEach((reservation) => {
      const time = formatTime(reservation.reservation_time);
      const current = groups.get(time) ?? [];

      groups.set(time, [...current, reservation]);
    });

    return Array.from(groups.entries());
  }, [reservations]);

  function changeDay(offset: number) {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + offset);

    setSelectedDate(getLocalDateValue(current));
  }

  function goToToday() {
    setSelectedDate(getLocalDateValue(new Date()));
  }

  return (
    <section className="calendar-panel">
      <div className="calendar-panel-header">
        <div>
          <span className="calendar-panel-eyebrow">
            AGENDA RISTORANTE
          </span>

          <h2>Calendario prenotazioni</h2>

          <p>
            Visualizza gli arrivi e i coperti previsti per ogni
            giornata.
          </p>
        </div>

        <button
          type="button"
          className="calendar-refresh"
          onClick={loadReservations}
          disabled={loading}
        >
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      <div className="calendar-date-navigation">
        <button
          type="button"
          className="calendar-arrow"
          onClick={() => changeDay(-1)}
          aria-label="Giorno precedente"
        >
          ←
        </button>

        <div className="calendar-selected-date">
          <span>{getWeekdayName(selectedDate)}</span>

          <strong>{formatLongEuropeanDate(selectedDate)}</strong>
        </div>

        <button
          type="button"
          className="calendar-arrow"
          onClick={() => changeDay(1)}
          aria-label="Giorno successivo"
        >
          →
        </button>

        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          aria-label="Seleziona una data"
        />

        <button
          type="button"
          className="calendar-today"
          onClick={goToToday}
        >
          Oggi
        </button>
      </div>

      <div className="calendar-metrics">
        <div>
          <span>Prenotazioni</span>
          <strong>{loading ? "—" : activeReservations.length}</strong>
        </div>

        <div>
          <span>Coperti</span>
          <strong>{loading ? "—" : totalGuests}</strong>
        </div>

        <div>
          <span>Confermate</span>
          <strong>{loading ? "—" : confirmedReservations}</strong>
        </div>

        <div>
          <span>In attesa</span>
          <strong>{loading ? "—" : pendingReservations}</strong>
        </div>
      </div>

      {errorMessage && (
        <div className="calendar-error">{errorMessage}</div>
      )}

      {loading && (
        <div className="calendar-empty">
          Caricamento dell’agenda...
        </div>
      )}

      {!loading && reservations.length === 0 && (
        <div className="calendar-empty">
          <strong>Nessuna prenotazione</strong>

          <span>
            Non risultano prenotazioni per questa giornata.
          </span>
        </div>
      )}

      {!loading && reservations.length > 0 && (
        <div className="calendar-timeline">
          {groupedReservations.map(([time, items]) => (
            <div className="calendar-time-group" key={time}>
              <div className="calendar-time-column">
                <strong>{time}</strong>

                <span>
                  {items.reduce(
                    (total, reservation) =>
                      reservation.status === "cancelled"
                        ? total
                        : total + reservation.guests,
                    0
                  )}{" "}
                  coperti
                </span>
              </div>

              <div className="calendar-reservations-column">
                {items.map((reservation) => (
                  <article
                    className={[
                      "calendar-reservation-card",
                      `calendar-reservation-${reservation.status}`,
                    ].join(" ")}
                    key={reservation.id}
                  >
                    <div className="calendar-reservation-main">
                      <div>
                        <h3>{reservation.customer_name}</h3>

                        <p>
                          {reservation.guests}{" "}
                          {reservation.guests === 1
                            ? "persona"
                            : "persone"}
                        </p>
                      </div>

                      <span
                        className={[
                          "calendar-reservation-status",
                          `calendar-status-${reservation.status}`,
                        ].join(" ")}
                      >
                        {statusLabels[reservation.status]}
                      </span>
                    </div>

                    <div className="calendar-reservation-info">
                      {reservation.customer_phone && (
                        <span>
                          Telefono:{" "}
                          <strong>
                            {reservation.customer_phone}
                          </strong>
                        </span>
                      )}

                      <span>
                        Orario: <strong>{time}</strong>
                      </span>
                    </div>

                    {reservation.notes && (
                      <div className="calendar-reservation-notes">
                        <strong>Note:</strong> {reservation.notes}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatTime(value: string) {
  return value?.slice(0, 5) || "";
}

function getLocalDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongEuropeanDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getWeekdayName(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return date.toLocaleDateString("it-IT", {
    weekday: "long",
  });
}