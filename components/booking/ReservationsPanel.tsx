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
  created_at?: string;
};

type StatusFilter = "all" | ReservationStatus;

const statusLabels: Record<ReservationStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

function formatEuropeanDate(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value: string) {
  return value?.slice(0, 5) || "";
}

function isToday(value: string) {
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return value === localToday;
}

export default function ReservationsPanel() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

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
          status,
          created_at
        `
      )
      .order("reservation_date", { ascending: true })
      .order("reservation_time", { ascending: true });

    if (error) {
      console.error("Errore caricamento prenotazioni:", error);
      setErrorMessage("Impossibile caricare le prenotazioni.");
      setReservations([]);
      setLoading(false);
      return;
    }

    setReservations((data ?? []) as Reservation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const filteredReservations = useMemo(() => {
    if (statusFilter === "all") {
      return reservations;
    }

    return reservations.filter(
      (reservation) => reservation.status === statusFilter
    );
  }, [reservations, statusFilter]);

  const todayReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          isToday(reservation.reservation_date) &&
          reservation.status !== "cancelled"
      ),
    [reservations]
  );

  const todayGuests = useMemo(
    () =>
      todayReservations.reduce(
        (total, reservation) => total + reservation.guests,
        0
      ),
    [todayReservations]
  );

  async function updateStatus(
    reservationId: string,
    status: ReservationStatus
  ) {
    setActionId(reservationId);
    setErrorMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("reservation")
      .update({ status })
      .eq("id", reservationId)
      .select(
        `
          id,
          customer_name,
          customer_phone,
          reservation_date,
          reservation_time,
          guests,
          notes,
          status,
          created_at
        `
      )
      .single();

    if (error || !data) {
      console.error("Errore aggiornamento prenotazione:", error);
      setErrorMessage(
        "Non è stato possibile aggiornare la prenotazione."
      );
      setActionId(null);
      return;
    }

    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId
          ? (data as Reservation)
          : reservation
      )
    );

    setActionId(null);
  }

  async function deleteReservation(reservation: Reservation) {
    const confirmed = window.confirm(
      `Vuoi eliminare definitivamente la prenotazione di ${reservation.customer_name}?`
    );

    if (!confirmed) return;

    setActionId(reservation.id);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("reservation")
      .delete()
      .eq("id", reservation.id);

    if (error) {
      console.error("Errore eliminazione prenotazione:", error);
      setErrorMessage(
        "Non è stato possibile eliminare la prenotazione."
      );
      setActionId(null);
      return;
    }

    setReservations((current) =>
      current.filter((item) => item.id !== reservation.id)
    );

    setActionId(null);
  }

  return (
    <section className="reservations-panel">
      <div className="reservations-panel-header">
        <div>
          <span className="reservations-eyebrow">
            GESTIONE RISTORANTE
          </span>

          <h2>Prenotazioni</h2>

          <p>
            Conferma, annulla o elimina le prenotazioni ricevute.
          </p>
        </div>

        <button
          type="button"
          className="reservations-refresh"
          onClick={loadReservations}
          disabled={loading}
        >
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>

      <div className="reservations-metrics">
        <div>
          <span>Prenotazioni oggi</span>
          <strong>{todayReservations.length}</strong>
        </div>

        <div>
          <span>Coperti oggi</span>
          <strong>{todayGuests}</strong>
        </div>

        <div>
          <span>In attesa</span>
          <strong>
            {
              reservations.filter(
                (reservation) =>
                  reservation.status === "pending"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Confermate</span>
          <strong>
            {
              reservations.filter(
                (reservation) =>
                  reservation.status === "confirmed"
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="reservations-filters">
        {(
          [
            ["all", "Tutte"],
            ["pending", "In attesa"],
            ["confirmed", "Confermate"],
            ["cancelled", "Annullate"],
          ] as Array<[StatusFilter, string]>
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={
              statusFilter === value
                ? "reservation-filter active"
                : "reservation-filter"
            }
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="reservations-error">{errorMessage}</div>
      )}

      {loading && (
        <div className="reservations-empty">
          Caricamento delle prenotazioni...
        </div>
      )}

      {!loading && filteredReservations.length === 0 && (
        <div className="reservations-empty">
          Nessuna prenotazione presente per questo filtro.
        </div>
      )}

      {!loading && filteredReservations.length > 0 && (
        <div className="reservations-list">
          {filteredReservations.map((reservation) => {
            const isWorking = actionId === reservation.id;

            return (
              <article
                className={[
                  "reservation-card",
                  `reservation-${reservation.status}`,
                ].join(" ")}
                key={reservation.id}
              >
                <div className="reservation-date-column">
                  <span>
                    {isToday(reservation.reservation_date)
                      ? "OGGI"
                      : formatEuropeanDate(
                          reservation.reservation_date
                        )}
                  </span>

                  <strong>
                    {formatTime(reservation.reservation_time)}
                  </strong>
                </div>

                <div className="reservation-details">
                  <div className="reservation-title-row">
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
                      className={`reservation-status status-${reservation.status}`}
                    >
                      {statusLabels[reservation.status]}
                    </span>
                  </div>

                  <div className="reservation-information">
                    <span>
                      Data:{" "}
                      <strong>
                        {formatEuropeanDate(
                          reservation.reservation_date
                        )}
                      </strong>
                    </span>

                    <span>
                      Ora:{" "}
                      <strong>
                        {formatTime(
                          reservation.reservation_time
                        )}
                      </strong>
                    </span>

                    {reservation.customer_phone && (
                      <span>
                        Telefono:{" "}
                        <strong>
                          {reservation.customer_phone}
                        </strong>
                      </span>
                    )}
                  </div>

                  {reservation.notes && (
                    <div className="reservation-notes">
                      <strong>Note:</strong> {reservation.notes}
                    </div>
                  )}

                  <div className="reservation-actions">
                    {reservation.status !== "confirmed" && (
                      <button
                        type="button"
                        className="reservation-confirm"
                        disabled={isWorking}
                        onClick={() =>
                          updateStatus(
                            reservation.id,
                            "confirmed"
                          )
                        }
                      >
                        Conferma
                      </button>
                    )}

                    {reservation.status !== "cancelled" && (
                      <button
                        type="button"
                        className="reservation-cancel"
                        disabled={isWorking}
                        onClick={() =>
                          updateStatus(
                            reservation.id,
                            "cancelled"
                          )
                        }
                      >
                        Annulla
                      </button>
                    )}

                    {reservation.status === "cancelled" && (
                      <button
                        type="button"
                        className="reservation-reopen"
                        disabled={isWorking}
                        onClick={() =>
                          updateStatus(
                            reservation.id,
                            "pending"
                          )
                        }
                      >
                        Ripristina
                      </button>
                    )}

                    <button
                      type="button"
                      className="reservation-delete"
                      disabled={isWorking}
                      onClick={() =>
                        deleteReservation(reservation)
                      }
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}