"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled";

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  notes: string | null;
  status: ReservationStatus;
  table_id: string | null;
  seated_at: string | null;
  completed_at: string | null;
  created_at?: string;
};

type RestaurantTable = {
  id: string;
  table_name: string;
  seats: number;
  area: string;
  is_active: boolean;
};

type StatusFilter =
  | "all"
  | ReservationStatus;

type OperationalInfo = {
  type:
    | "upcoming"
    | "late"
    | "occupied"
    | "overtime"
    | "completed";

  title: string;
  text: string;
};

const statusLabels: Record<
  ReservationStatus,
  string
> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

function formatEuropeanDate(
  value: string
) {
  if (!value) return "";

  const [year, month, day] =
    value.split("-");

  return `${day}/${month}/${year}`;
}

function formatTime(
  value: string
) {
  return value?.slice(0, 5) || "";
}

function getLocalDateValue(
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

function isToday(
  value: string
) {
  return (
    value ===
    getLocalDateValue(
      new Date()
    )
  );
}

function timeToMinutes(
  value: string
) {
  const [
    hours,
    minutes,
  ] = formatTime(value)
    .split(":")
    .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

function formatDateTime(
  value: string
) {
  if (!value) return "";

  return new Date(
    value
  ).toLocaleTimeString(
    "it-IT",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getOperationalInfo(
  reservation: Reservation,
  now: Date,
  tableDurationMinutes: number
): OperationalInfo | null {
  if (
    reservation.status ===
    "cancelled"
  ) {
    return null;
  }

  if (
    reservation.completed_at
  ) {
    return {
      type: "completed",
      title:
        "Servizio completato",
      text:
        `Tavolo liberato alle ${formatDateTime(
          reservation.completed_at
        )}`,
    };
  }

  if (
    reservation.seated_at
  ) {
    const seatedAt =
      new Date(
        reservation.seated_at
      );

    const elapsedMinutes =
      Math.max(
        0,
        Math.floor(
          (
            now.getTime() -
            seatedAt.getTime()
          ) /
            60000
        )
      );

    const remaining =
      tableDurationMinutes -
      elapsedMinutes;

    if (
      remaining <= 0
    ) {
      return {
        type: "overtime",
        title:
          "Tempo previsto superato",
        text:
          `${Math.abs(
            remaining
          )} min oltre la durata prevista`,
      };
    }

    return {
      type: "occupied",
      title:
        "Cliente al tavolo",
      text:
        `${remaining} min circa rimanenti`,
    };
  }

  if (
    !isToday(
      reservation.reservation_date
    )
  ) {
    return null;
  }

  const reservationMinutes =
    timeToMinutes(
      reservation.reservation_time
    );

  const currentMinutes =
    now.getHours() *
      60 +
    now.getMinutes();

  const difference =
    reservationMinutes -
    currentMinutes;

  if (
    difference >= 0 &&
    difference <= 30
  ) {
    return {
      type: "upcoming",
      title:
        "Prenotazione imminente",
      text:
        difference === 0
          ? "Arrivo previsto ora"
          : `Arrivo previsto tra ${difference} min`,
    };
  }

  if (
    difference < 0
  ) {
    return {
      type: "late",
      title:
        "Cliente in ritardo",
      text:
        `${Math.abs(
          difference
        )} min di ritardo`,
    };
  }

  return null;
}

function getOperationalStyle(
  type: OperationalInfo["type"]
) {
  if (
    type === "late" ||
    type === "overtime"
  ) {
    return {
      background:
        "#fef2f2",
      border:
        "1px solid #fecaca",
      color:
        "#991b1b",
    };
  }

  if (
    type === "upcoming"
  ) {
    return {
      background:
        "#fffbeb",
      border:
        "1px solid #fde68a",
      color:
        "#92400e",
    };
  }

  if (
    type === "occupied"
  ) {
    return {
      background:
        "#f0fdf4",
      border:
        "1px solid #bbf7d0",
      color:
        "#166534",
    };
  }

  return {
    background:
      "#f8fafc",
    border:
      "1px solid #e2e8f0",
    color:
      "#475569",
  };
}

export default function ReservationsPanel() {
  const [
    reservations,
    setReservations,
  ] = useState<
    Reservation[]
  >([]);

  const [
    tables,
    setTables,
  ] = useState<
    RestaurantTable[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionId,
    setActionId,
  ] = useState<
    string | null
  >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );

  const [
    tableDurationMinutes,
    setTableDurationMinutes,
  ] =
    useState(120);

  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );

  const loadReservations =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage("");

        const companyId =
          process.env
            .NEXT_PUBLIC_PILOT_COMPANY_ID;

        if (!companyId) {
          setErrorMessage(
            "Company ID non configurato."
          );

          setLoading(false);
          return;
        }

        const supabase =
          createClient();

        const [
          reservationsResult,
          tablesResult,
          settingsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "reservation"
              )
              .select(`
                id,
                customer_name,
                customer_phone,
                reservation_date,
                reservation_time,
                guests,
                notes,
                status,
                table_id,
                seated_at,
                completed_at,
                created_at
              `)
              .eq(
                "company_id",
                companyId
              )
              .order(
                "reservation_date",
                {
                  ascending:
                    true,
                }
              )
              .order(
                "reservation_time",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "restaurant_tables"
              )
              .select(`
                id,
                table_name,
                seats,
                area,
                is_active
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
                "area",
                {
                  ascending:
                    true,
                }
              )
              .order(
                "table_name",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "restaurant_settings"
              )
              .select(
                "table_duration_minutes"
              )
              .eq(
                "company_id",
                companyId
              )
              .maybeSingle(),
          ]);

        if (
          reservationsResult.error
        ) {
          console.error(
            "Errore caricamento prenotazioni:",
            reservationsResult.error
          );

          setErrorMessage(
            "Impossibile caricare le prenotazioni."
          );

          setReservations([]);
        } else {
          setReservations(
            (
              reservationsResult.data ??
              []
            ) as Reservation[]
          );
        }

        if (
          tablesResult.error
        ) {
          console.error(
            "Errore caricamento tavoli:",
            tablesResult.error
          );

          setTables([]);
        } else {
          setTables(
            (
              tablesResult.data ??
              []
            ) as RestaurantTable[]
          );
        }

        if (
          settingsResult.error
        ) {
          console.error(
            "Errore caricamento impostazioni:",
            settingsResult.error
          );
        }

        setTableDurationMinutes(
          Number(
            settingsResult.data
              ?.table_duration_minutes ??
              120
          )
        );

        setNow(
          new Date()
        );

        setLoading(false);
      },
      []
    );

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  /*
   * Aggiorna i timer
   * ogni 30 secondi.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(
            new Date()
          );
        },
        30000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  const filteredReservations =
    useMemo(() => {
      if (
        statusFilter ===
        "all"
      ) {
        return reservations;
      }

      return reservations.filter(
        (reservation) =>
          reservation.status ===
          statusFilter
      );
    }, [
      reservations,
      statusFilter,
    ]);

  const todayReservations =
    useMemo(
      () =>
        reservations.filter(
          (reservation) =>
            isToday(
              reservation
                .reservation_date
            ) &&
            reservation.status !==
              "cancelled"
        ),
      [reservations]
    );

  const todayGuests =
    useMemo(
      () =>
        todayReservations.reduce(
          (
            total,
            reservation
          ) =>
            total +
            reservation.guests,
          0
        ),
      [todayReservations]
    );

  const occupiedTables =
    useMemo(
      () =>
        reservations.filter(
          (reservation) =>
            reservation.seated_at &&
            !reservation.completed_at &&
            reservation.status !==
              "cancelled"
        ).length,
      [reservations]
    );

  async function updateStatus(
    reservationId: string,
    status: ReservationStatus
  ) {
    setActionId(
      reservationId
    );

    setErrorMessage("");
    setSuccessMessage("");

    const supabase =
      createClient();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "reservation"
        )
        .update({
          status,
        })
        .eq(
          "id",
          reservationId
        )
        .select(`
          id,
          customer_name,
          customer_phone,
          reservation_date,
          reservation_time,
          guests,
          notes,
          status,
          table_id,
          seated_at,
          completed_at,
          created_at
        `)
        .single();

    if (
      error ||
      !data
    ) {
      console.error(
        "Errore aggiornamento prenotazione:",
        error
      );

      setErrorMessage(
        "Non è stato possibile aggiornare la prenotazione."
      );

      setActionId(null);
      return;
    }

    setReservations(
      (current) =>
        current.map(
          (reservation) =>
            reservation.id ===
            reservationId
              ? (data as Reservation)
              : reservation
        )
    );

    setSuccessMessage(
      status ===
        "confirmed"
        ? "Prenotazione confermata."
        : status ===
            "cancelled"
          ? "Prenotazione annullata."
          : "Prenotazione ripristinata."
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      1800
    );

    setActionId(null);
  }

  async function updateTable(
    reservationId: string,
    tableId: string
  ) {
    setActionId(
      reservationId
    );

    setErrorMessage("");
    setSuccessMessage("");

    const supabase =
      createClient();

    const value =
      tableId === ""
        ? null
        : tableId;

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "reservation"
        )
        .update({
          table_id:
            value,
        })
        .eq(
          "id",
          reservationId
        )
        .select(`
          id,
          customer_name,
          customer_phone,
          reservation_date,
          reservation_time,
          guests,
          notes,
          status,
          table_id,
          seated_at,
          completed_at,
          created_at
        `)
        .single();

    if (
      error ||
      !data
    ) {
      console.error(
        "Errore assegnazione tavolo:",
        error
      );

      setErrorMessage(
        "Non è stato possibile assegnare il tavolo."
      );

      setActionId(null);
      return;
    }

    setReservations(
      (current) =>
        current.map(
          (reservation) =>
            reservation.id ===
            reservationId
              ? (data as Reservation)
              : reservation
        )
    );

    setSuccessMessage(
      value
        ? "Tavolo aggiornato."
        : "Assegnazione tavolo rimossa."
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      1800
    );

    setActionId(null);
  }

  async function updateServiceState(
    reservationId: string,
    action:
      | "seat"
      | "complete"
  ) {
    setActionId(
      reservationId
    );

    setErrorMessage("");
    setSuccessMessage("");

    const supabase =
      createClient();

    const currentDate =
      new Date();

    const timestamp =
      currentDate.toISOString();

    const updatePayload =
      action ===
      "seat"
        ? {
            seated_at:
              timestamp,
            completed_at:
              null,
            status:
              "confirmed" as ReservationStatus,
          }
        : {
            completed_at:
              timestamp,
          };

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "reservation"
        )
        .update(
          updatePayload
        )
        .eq(
          "id",
          reservationId
        )
        .select(`
          id,
          customer_name,
          customer_phone,
          reservation_date,
          reservation_time,
          guests,
          notes,
          status,
          table_id,
          seated_at,
          completed_at,
          created_at
        `)
        .single();

    if (
      error ||
      !data
    ) {
      console.error(
        "Errore aggiornamento servizio:",
        error
      );

      setErrorMessage(
        action ===
          "seat"
          ? "Non è stato possibile segnare il cliente come arrivato."
          : "Non è stato possibile liberare il tavolo."
      );

      setActionId(null);
      return;
    }

    setReservations(
      (current) =>
        current.map(
          (reservation) =>
            reservation.id ===
            reservationId
              ? (data as Reservation)
              : reservation
        )
    );

    setNow(
      currentDate
    );

    setSuccessMessage(
      action ===
        "seat"
        ? "Cliente arrivato. Tavolo occupato."
        : "Tavolo liberato."
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      1800
    );

    setActionId(null);
  }

  async function deleteReservation(
    reservation: Reservation
  ) {
    const confirmed =
      window.confirm(
        `Vuoi eliminare definitivamente la prenotazione di ${reservation.customer_name}?`
      );

    if (!confirmed) {
      return;
    }

    setActionId(
      reservation.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    const supabase =
      createClient();

    const {
      error,
    } =
      await supabase
        .from(
          "reservation"
        )
        .delete()
        .eq(
          "id",
          reservation.id
        );

    if (error) {
      console.error(
        "Errore eliminazione prenotazione:",
        error
      );

      setErrorMessage(
        "Non è stato possibile eliminare la prenotazione."
      );

      setActionId(null);
      return;
    }

    setReservations(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            reservation.id
        )
    );

    setSuccessMessage(
      "Prenotazione eliminata."
    );

    window.setTimeout(
      () => {
        setSuccessMessage(
          ""
        );
      },
      1800
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

          <h2>
            Prenotazioni
          </h2>

          <p>
            Gestisci prenotazioni, tavoli e servizio
            direttamente dalla stessa schermata.
          </p>
        </div>

        <button
          type="button"
          className="reservations-refresh"
          onClick={
            loadReservations
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Aggiornamento..."
            : "Aggiorna"}
        </button>
      </div>

      <div className="reservations-metrics">
        <div>
          <span>
            Prenotazioni oggi
          </span>

          <strong>
            {
              todayReservations.length
            }
          </strong>
        </div>

        <div>
          <span>
            Coperti oggi
          </span>

          <strong>
            {
              todayGuests
            }
          </strong>
        </div>

        <div>
          <span>
            In attesa
          </span>

          <strong>
            {
              reservations.filter(
                (
                  reservation
                ) =>
                  reservation.status ===
                  "pending"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>
            Confermate
          </span>

          <strong>
            {
              reservations.filter(
                (
                  reservation
                ) =>
                  reservation.status ===
                  "confirmed"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>
            Tavoli occupati
          </span>

          <strong>
            {
              occupiedTables
            }
          </strong>
        </div>
      </div>

      <div className="reservations-filters">
        {(
          [
            [
              "all",
              "Tutte",
            ],
            [
              "pending",
              "In attesa",
            ],
            [
              "confirmed",
              "Confermate",
            ],
            [
              "cancelled",
              "Annullate",
            ],
          ] as Array<
            [
              StatusFilter,
              string,
            ]
          >
        ).map(
          ([
            value,
            label,
          ]) => (
            <button
              type="button"
              key={
                value
              }
              className={
                statusFilter ===
                value
                  ? "reservation-filter active"
                  : "reservation-filter"
              }
              onClick={() =>
                setStatusFilter(
                  value
                )
              }
            >
              {
                label
              }
            </button>
          )
        )}
      </div>

      {errorMessage && (
        <div className="reservations-error">
          {
            errorMessage
          }
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginBottom:
              "16px",
            padding:
              "12px 16px",
            borderRadius:
              "12px",
            background:
              "#f0fdf4",
            border:
              "1px solid #bbf7d0",
            color:
              "#166534",
            fontWeight:
              700,
          }}
        >
          {
            successMessage
          }
        </div>
      )}

      {loading && (
        <div className="reservations-empty">
          Caricamento delle prenotazioni...
        </div>
      )}

      {!loading &&
        filteredReservations.length ===
          0 && (
          <div className="reservations-empty">
            Nessuna prenotazione presente per questo
            filtro.
          </div>
        )}

      {!loading &&
        filteredReservations.length >
          0 && (
          <div className="reservations-list">
            {filteredReservations.map(
              (
                reservation
              ) => {
                const isWorking =
                  actionId ===
                  reservation.id;

                const table =
                  tables.find(
                    (
                      item
                    ) =>
                      item.id ===
                      reservation.table_id
                  ) ??
                  null;

                const operationalInfo =
                  getOperationalInfo(
                    reservation,
                    now,
                    tableDurationMinutes
                  );

                return (
                  <article
                    className={[
                      "reservation-card",
                      `reservation-${reservation.status}`,
                    ].join(
                      " "
                    )}
                    key={
                      reservation.id
                    }
                  >
                    <div className="reservation-date-column">
                      <span>
                        {isToday(
                          reservation.reservation_date
                        )
                          ? "OGGI"
                          : formatEuropeanDate(
                              reservation.reservation_date
                            )}
                      </span>

                      <strong>
                        {formatTime(
                          reservation.reservation_time
                        )}
                      </strong>
                    </div>

                    <div className="reservation-details">
                      <div className="reservation-title-row">
                        <div>
                          <h3>
                            {
                              reservation.customer_name
                            }
                          </h3>

                          <p>
                            {
                              reservation.guests
                            }{" "}
                            {reservation.guests ===
                            1
                              ? "persona"
                              : "persone"}
                          </p>
                        </div>

                        <span
                          className={`reservation-status status-${reservation.status}`}
                        >
                          {
                            statusLabels[
                              reservation.status
                            ]
                          }
                        </span>
                      </div>

                      {operationalInfo && (
                        <div
                          style={{
                            ...getOperationalStyle(
                              operationalInfo.type
                            ),

                            padding:
                              "10px 14px",

                            borderRadius:
                              "12px",

                            margin:
                              "12px 0",

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "space-between",

                            gap:
                              "12px",

                            flexWrap:
                              "wrap",
                          }}
                        >
                          <strong>
                            {
                              operationalInfo.title
                            }
                          </strong>

                          <span>
                            {
                              operationalInfo.text
                            }
                          </span>
                        </div>
                      )}

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
                              {
                                reservation.customer_phone
                              }
                            </strong>
                          </span>
                        )}

                        <span className="reservation-table-select">
                          Tavolo:{" "}

                          <select
                            value={
                              reservation.table_id ??
                              ""
                            }
                            disabled={
                              isWorking ||
                              Boolean(
                                reservation.seated_at &&
                                  !reservation.completed_at
                              )
                            }
                            onChange={(
                              event
                            ) =>
                              updateTable(
                                reservation.id,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Non assegnato
                            </option>

                            {tables.map(
                              (
                                tableOption
                              ) => (
                                <option
                                  key={
                                    tableOption.id
                                  }
                                  value={
                                    tableOption.id
                                  }
                                >
                                  {
                                    tableOption.table_name
                                  }{" "}
                                  ·{" "}
                                  {
                                    tableOption.seats
                                  }{" "}
                                  posti ·{" "}
                                  {
                                    tableOption.area
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </span>
                      </div>

                      {table && (
                        <div
                          style={{
                            marginTop:
                              "10px",

                            fontSize:
                              "13px",

                            color:
                              "#64748b",
                          }}
                        >
                          Tavolo assegnato:{" "}

                          <strong>
                            {
                              table.table_name
                            }{" "}
                            ·{" "}
                            {
                              table.seats
                            }{" "}
                            posti ·{" "}
                            {
                              table.area
                            }
                          </strong>
                        </div>
                      )}

                      {reservation.notes && (
                        <div className="reservation-notes">
                          <strong>
                            Note:
                          </strong>{" "}

                          {
                            reservation.notes
                          }
                        </div>
                      )}

                      {reservation.status !==
                        "cancelled" && (
                        <div
                          style={{
                            marginTop:
                              "14px",

                            padding:
                              "14px",

                            borderRadius:
                              "14px",

                            background:
                              "#f8fafc",

                            border:
                              "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              justifyContent:
                                "space-between",

                              gap:
                                "10px",

                              flexWrap:
                                "wrap",
                            }}
                          >
                            <div>
                              <strong>
                                Gestione tavolo
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    "4px",

                                  fontSize:
                                    "13px",

                                  color:
                                    "#64748b",
                                }}
                              >
                                Durata prevista:{" "}
                                {
                                  tableDurationMinutes
                                }{" "}
                                minuti
                              </div>
                            </div>

                            {!reservation.table_id && (
                              <span
                                style={{
                                  fontSize:
                                    "13px",

                                  color:
                                    "#b45309",
                                }}
                              >
                                Assegna prima un tavolo
                              </span>
                            )}

                            {reservation.table_id &&
  !reservation.seated_at &&
  !reservation.completed_at && (
    <button
      type="button"
      disabled={isWorking}
      onClick={() =>
        updateServiceState(
          reservation.id,
          "seat"
        )
      }
      style={{
        minWidth: "190px",
        minHeight: "48px",
        padding: "12px 22px",
        border: "none",
        borderRadius: "12px",
        background: "#16a34a",
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: 800,
        cursor: isWorking
          ? "not-allowed"
          : "pointer",
        opacity: isWorking ? 0.6 : 1,
        boxShadow:
          "0 6px 14px rgba(22, 163, 74, 0.18)",
      }}
    >
      {isWorking
        ? "Aggiornamento..."
        : "✓ Cliente arrivato"}
    </button>
  )}

{reservation.seated_at &&
  !reservation.completed_at && (
    <button
      type="button"
      disabled={isWorking}
      onClick={() =>
        updateServiceState(
          reservation.id,
          "complete"
        )
      }
      style={{
        minWidth: "170px",
        minHeight: "48px",
        padding: "12px 22px",
        border: "2px solid #f59e0b",
        borderRadius: "12px",
        background: "#fffbeb",
        color: "#92400e",
        fontSize: "15px",
        fontWeight: 800,
        cursor: isWorking
          ? "not-allowed"
          : "pointer",
        opacity: isWorking ? 0.6 : 1,
        boxShadow:
          "0 6px 14px rgba(245, 158, 11, 0.12)",
      }}
    >
      {isWorking
        ? "Aggiornamento..."
        : "Libera tavolo"}
    </button>
  )}

                            {reservation.completed_at && (
                              <span
                                style={{
                                  fontSize:
                                    "13px",

                                  fontWeight:
                                    700,

                                  color:
                                    "#475569",
                                }}
                              >
                                Tavolo liberato alle{" "}
                                {formatDateTime(
                                  reservation.completed_at
                                )}
                              </span>
                            )}
                          </div>

                          {reservation.seated_at &&
                            !reservation.completed_at && (
                              <div
                                style={{
                                  marginTop:
                                    "10px",

                                  fontSize:
                                    "13px",

                                  color:
                                    "#475569",
                                }}
                              >
                                Cliente arrivato alle{" "}

                                <strong>
                                  {formatDateTime(
                                    reservation.seated_at
                                  )}
                                </strong>
                              </div>
                            )}
                        </div>
                      )}

                      <div className="reservation-actions">
                        {reservation.status !==
                          "confirmed" &&
                          reservation.status !==
                            "cancelled" && (
                            <button
                              type="button"
                              className="reservation-confirm"
                              disabled={
                                isWorking
                              }
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

                        {reservation.status !==
                          "cancelled" && (
                          <button
                            type="button"
                            className="reservation-cancel"
                            disabled={
                              isWorking
                            }
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

                        {reservation.status ===
                          "cancelled" && (
                          <button
                            type="button"
                            className="reservation-reopen"
                            disabled={
                              isWorking
                            }
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
                          disabled={
                            isWorking
                          }
                          onClick={() =>
                            deleteReservation(
                              reservation
                            )
                          }
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
    </section>
  );
}