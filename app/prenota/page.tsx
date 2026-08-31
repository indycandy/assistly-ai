"use client";

import { useEffect, useState } from "react";

type Session = "pranzo" | "cena" | "";

type Slot = {
  time: string;
  available: boolean;
  remainingGuests: number;
  label: string;
};

export default function PrenotaPage() {
  const [step, setStep] = useState(1);

  const [guests, setGuests] =
    useState(2);

  const [session, setSession] =
    useState<Session>("");

  const [date, setDate] =
    useState("");

  const [time, setTime] =
    useState("");
    useEffect(() => {
  const params = new URLSearchParams(
    window.location.search
  );

  const guestsParam = Number(
    params.get("guests")
  );

  const serviceParam =
    params.get("service");

  const dateParam =
    params.get("date");

  let validGuests = false;
  let validService = false;
  let validDate = false;

  if (
    Number.isInteger(guestsParam) &&
    guestsParam >= 1 &&
    guestsParam <= 30
  ) {
    setGuests(guestsParam);
    validGuests = true;
  }

  if (
    serviceParam === "pranzo" ||
    serviceParam === "cena"
  ) {
    setSession(serviceParam);
    validService = true;
  }

  if (
    dateParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      dateParam
    )
  ) {
    const candidateDate =
      new Date(
        `${dateParam}T12:00:00`
      );

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (
      !Number.isNaN(
        candidateDate.getTime()
      ) &&
      candidateDate >= today
    ) {
      setDate(dateParam);

      setCalendarMonth(
        new Date(
          candidateDate.getFullYear(),
          candidateDate.getMonth(),
          1
        )
      );

      validDate = true;
    }
  }

  if (
    validGuests &&
    validService &&
    validDate
  ) {
    setStep(4);
  }
}, []);

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState("");

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    privacyAccepted,
    setPrivacyAccepted,
  ] = useState(false);

  const [slots, setSlots] =
    useState<Slot[]>([]);

  const [
    slotsLoading,
    setSlotsLoading,
  ] = useState(false);

  const [
    slotsError,
    setSlotsError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  /*
   * GRUPPI NUMEROSI
   */

  const [
    requiresContact,
    setRequiresContact,
  ] = useState(false);

  const [
    contactMessage,
    setContactMessage,
  ] = useState("");

  const [
    restaurantPhone,
    setRestaurantPhone,
  ] = useState("");

  const [
    maxGuestsPerReservation,
    setMaxGuestsPerReservation,
  ] = useState<number | null>(
    null
  );

  const today = new Date();

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    )
  );

  /*
   * CARICAMENTO DISPONIBILITÀ
   */

  useEffect(() => {
    async function loadSlots() {
      if (!date || !session) {
        setSlots([]);
        setSlotsError("");
        setTime("");

        setRequiresContact(false);
        setContactMessage("");
        setRestaurantPhone("");
        setMaxGuestsPerReservation(
          null
        );

        return;
      }

      const companyId =
        process.env
          .NEXT_PUBLIC_PILOT_COMPANY_ID;

      if (!companyId) {
        setSlots([]);

        setSlotsError(
          "Azienda non configurata."
        );

        return;
      }

      setSlotsLoading(true);

      setSlotsError("");

      setTime("");

      setRequiresContact(false);

      setContactMessage("");

      setRestaurantPhone("");

      try {
        const params =
          new URLSearchParams({
            companyId,
            date,
            guests:
              String(guests),
            service:
              session,
          });

        const response =
          await fetch(
            `/api/availability?${params.toString()}`,
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setSlots([]);

          setSlotsError(
            data.error ||
              "Impossibile caricare gli orari."
          );

          return;
        }

        /*
         * Se il gruppo supera
         * il limite configurato
         * dal ristorante.
         */

        if (
          data.requiresContact
        ) {
          setSlots([]);

          setRequiresContact(
            true
          );

          setContactMessage(
            data.message ||
              "Per questo numero di persone contatta direttamente il locale."
          );

          setRestaurantPhone(
            data.phone || ""
          );

          setMaxGuestsPerReservation(
            data.maxGuestsPerReservation ??
              null
          );

          return;
        }

        /*
         * Prenotazione normale.
         */

        setRequiresContact(
          false
        );

        setContactMessage("");

        setRestaurantPhone(
          data.phone || ""
        );

        setMaxGuestsPerReservation(
          data.maxGuestsPerReservation ??
            null
        );

        setSlots(
          data.slots ?? []
        );
      } catch (error) {
        console.error(
          "Errore caricamento slot:",
          error
        );

        setSlots([]);

        setSlotsError(
          "Errore di connessione."
        );
      } finally {
        setSlotsLoading(
          false
        );
      }
    }

    loadSlots();
  }, [
    date,
    guests,
    session,
  ]);

  /*
   * NAVIGAZIONE
   */

  function goNext() {
    if (
      step === 2 &&
      !session
    ) {
      alert(
        "Seleziona Pranzo oppure Cena."
      );

      return;
    }

    if (
      step === 3 &&
      !date
    ) {
      alert(
        "Seleziona una data."
      );

      return;
    }

    if (
      step === 4 &&
      requiresContact
    ) {
      return;
    }

    if (
      step === 4 &&
      !time
    ) {
      alert(
        "Seleziona un orario disponibile."
      );

      return;
    }

    setStep(
      (current) =>
        Math.min(
          5,
          current + 1
        )
    );
  }

  function goBack() {
    setStep(
      (current) =>
        Math.max(
          1,
          current - 1
        )
    );
  }

  /*
   * CONFERMA PRENOTAZIONE
   */

  async function confirmBooking() {
    if (
      requiresContact
    ) {
      alert(
        "Per questo numero di persone contatta direttamente il locale."
      );

      return;
    }

    if (
      !customerName.trim() ||
      !customerPhone.trim()
    ) {
      alert(
        "Inserisci nome e telefono."
      );

      return;
    }

    if (
      !privacyAccepted
    ) {
      alert(
        "Devi accettare l’informativa privacy."
      );

      return;
    }

    const companyId =
      process.env
        .NEXT_PUBLIC_PILOT_COMPANY_ID;

    if (!companyId) {
      alert(
        "Azienda non configurata."
      );

      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/reservations",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                companyId,
                customerName,
                customerPhone,
                customerEmail,
                reservationDate:
                  date,
                reservationTime:
                  time,
                guests,
                notes,
                service:
                  session,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Errore durante la prenotazione."
        );

        if (
          response.status ===
          409
        ) {
          setStep(4);

          setTime("");
        }

        return;
      }

      alert(
        "Prenotazione inviata correttamente! ✅"
      );

      setStep(1);

      setGuests(2);

      setSession("");

      setDate("");

      setTime("");

      setSlots([]);

      setCustomerName("");

      setCustomerPhone("");

      setCustomerEmail("");

      setNotes("");

      setPrivacyAccepted(
        false
      );

      setRequiresContact(
        false
      );

      setContactMessage("");

      setRestaurantPhone("");

      setMaxGuestsPerReservation(
        null
      );
    } catch (error) {
      console.error(
        "Errore conferma prenotazione:",
        error
      );

      alert(
        "Errore di connessione."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  /*
   * DATA
   */

  function formatEuropeanDate(
    value: string
  ) {
    if (!value) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      value.split("-");

    return `${day}/${month}/${year}`;
  }

  function formatDateValue(
    value: Date
  ) {
    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${year}-${month}-${day}`;
  }

  function isPastDate(
    value: Date
  ) {
    const candidate =
      new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
      );

    const current =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

    return (
      candidate <
      current
    );
  }

  function getCalendarDays() {
    const year =
      calendarMonth
        .getFullYear();

    const month =
      calendarMonth
        .getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1
      );

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      );

    const mondayBasedStart =
      (firstDay.getDay() +
        6) %
      7;

    const days:
      Array<Date | null> =
        [];

    for (
      let index = 0;
      index <
      mondayBasedStart;
      index++
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <=
      lastDay.getDate();
      day++
    ) {
      days.push(
        new Date(
          year,
          month,
          day
        )
      );
    }

    return days;
  }

  function previousMonth() {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() -
            1,
          1
        )
    );
  }

  function nextMonth() {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() +
            1,
          1
        )
    );
  }

  return (
    <main className="booking-page">
      <div className="booking-container">
        <div className="booking-heading">
          <span>
            ASSISTLY AI
          </span>

          <h1>
            Prenota un tavolo
          </h1>

          <p>
            Completa la
            prenotazione in pochi
            passaggi.
          </p>
        </div>

        <div className="booking-progress">
          {[
            1,
            2,
            3,
            4,
            5,
          ].map(
            (number) => (
              <div
                className="booking-progress-item"
                key={
                  number
                }
              >
                <div
                  className={[
                    "booking-dot",

                    step ===
                    number
                      ? "booking-dot-active"
                      : "",

                    step >
                    number
                      ? "booking-dot-completed"
                      : "",
                  ].join(
                    " "
                  )}
                >
                  {step >
                  number
                    ? "✓"
                    : number}
                </div>

                {number <
                  5 && (
                  <div
                    className={[
                      "booking-progress-line",

                      step >
                      number
                        ? "completed"
                        : "",
                    ].join(
                      " "
                    )}
                  />
                )}
              </div>
            )
          )}
        </div>

        <section className="booking-card">
          {step === 1 && (
            <div className="booking-step">
              <span className="booking-step-label">
                PASSAGGIO 1 DI 5
              </span>

              <h2>
                Quante persone?
              </h2>

              <p>
                Usa i pulsanti per
                scegliere il numero
                di ospiti.
              </p>

              <div className="guest-selector">
                <button
                  type="button"
                  disabled={
                    guests === 1
                  }
                  onClick={() =>
                    setGuests(
                      (
                        current
                      ) =>
                        Math.max(
                          1,
                          current -
                            1
                        )
                    )
                  }
                  aria-label="Riduci il numero di persone"
                >
                  −
                </button>

                <div className="guest-count">
                  <strong>
                    {guests}
                  </strong>

                  <span>
                    {guests ===
                    1
                      ? "OSPITE"
                      : "OSPITI"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGuests(
                      (
                        current
                      ) =>
                        Math.min(
                          20,
                          current +
                            1
                        )
                    )
                  }
                  aria-label="Aumenta il numero di persone"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="booking-step">
              <span className="booking-step-label">
                PASSAGGIO 2 DI 5
              </span>

              <h2>
                Scegli il servizio
              </h2>

              <p>
                Seleziona il momento
                della giornata.
              </p>

              <div className="session-grid">
                <button
                  type="button"
                  className={[
                    "session-card",

                    session ===
                    "pranzo"
                      ? "selected"
                      : "",
                  ].join(
                    " "
                  )}
                  onClick={() => {
                    setSession(
                      "pranzo"
                    );

                    setTime("");
                  }}
                >
                  <span className="session-icon">
                    ☀️
                  </span>

                  <strong>
                    Pranzo
                  </strong>

                  <small>
                    Servizio diurno
                  </small>
                </button>

                <button
                  type="button"
                  className={[
                    "session-card",

                    session ===
                    "cena"
                      ? "selected"
                      : "",
                  ].join(
                    " "
                  )}
                  onClick={() => {
                    setSession(
                      "cena"
                    );

                    setTime("");
                  }}
                >
                  <span className="session-icon">
                    🌙
                  </span>

                  <strong>
                    Cena
                  </strong>

                  <small>
                    Servizio serale
                  </small>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="booking-step">
              <span className="booking-step-label">
                PASSAGGIO 3 DI 5
              </span>

              <h2>
                Scegli la data
              </h2>

              <p>
                Seleziona il giorno
                della prenotazione.
              </p>

              <div className="custom-calendar">
                <div className="calendar-header">
                  <button
                    type="button"
                    onClick={
                      previousMonth
                    }
                  >
                    ←
                  </button>

                  <strong>
                    {calendarMonth.toLocaleDateString(
                      "it-IT",
                      {
                        month:
                          "long",

                        year:
                          "numeric",
                      }
                    )}
                  </strong>

                  <button
                    type="button"
                    onClick={
                      nextMonth
                    }
                  >
                    →
                  </button>
                </div>

                <div className="calendar-weekdays">
                  {[
                    "Lun",
                    "Mar",
                    "Mer",
                    "Gio",
                    "Ven",
                    "Sab",
                    "Dom",
                  ].map(
                    (
                      weekday
                    ) => (
                      <span
                        key={
                          weekday
                        }
                      >
                        {
                          weekday
                        }
                      </span>
                    )
                  )}
                </div>

                <div className="calendar-grid">
                  {getCalendarDays().map(
                    (
                      calendarDay,
                      index
                    ) => {
                      if (
                        !calendarDay
                      ) {
                        return (
                          <span
                            key={`empty-${index}`}
                          />
                        );
                      }

                      const value =
                        formatDateValue(
                          calendarDay
                        );

                      const disabled =
                        isPastDate(
                          calendarDay
                        );

                      const selected =
                        date ===
                        value;

                      return (
                        <button
                          type="button"
                          key={
                            value
                          }
                          disabled={
                            disabled
                          }
                          className={[
                            "calendar-day",

                            selected
                              ? "selected"
                              : "",
                          ].join(
                            " "
                          )}
                          onClick={() => {
                            setDate(
                              value
                            );

                            setTime(
                              ""
                            );
                          }}
                        >
                          {calendarDay.getDate()}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {date && (
                <div className="booking-selection-summary">
                  Data
                  selezionata:{" "}
                  <strong>
                    {formatEuropeanDate(
                      date
                    )}
                  </strong>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="booking-step">
              <span className="booking-step-label">
                PASSAGGIO 4 DI 5
              </span>

              <h2>
                {requiresContact
                  ? "Prenotazione gruppo"
                  : "Scegli l’orario"}
              </h2>

              {!requiresContact && (
                <p>
                  Slot disponibili
                  per{" "}
                  <strong>
                    {session ===
                    "pranzo"
                      ? "il pranzo"
                      : "la cena"}
                  </strong>
                  .
                </p>
              )}

              {slotsLoading && (
                <div className="booking-selection-summary">
                  Caricamento
                  degli orari
                  disponibili...
                </div>
              )}

              {!slotsLoading &&
                requiresContact && (
                  <div
                    style={{
                      marginTop:
                        "18px",

                      padding:
                        "24px",

                      border:
                        "1px solid #ddd6fe",

                      borderRadius:
                        "18px",

                      background:
                        "linear-gradient(135deg, #faf8ff, #ffffff)",

                      textAlign:
                        "center",

                      boxShadow:
                        "0 8px 28px rgba(124,58,237,0.08)",
                    }}
                  >
                    <div
                      style={{
                        width:
                          "54px",

                        height:
                          "54px",

                        margin:
                          "0 auto 14px",

                        display:
                          "grid",

                        placeItems:
                          "center",

                        borderRadius:
                          "16px",

                        background:
                          "#f0ebff",

                        fontSize:
                          "25px",
                      }}
                    >
                      👥
                    </div>

                    <strong
                      style={{
                        display:
                          "block",

                        marginBottom:
                          "8px",

                        color:
                          "#172033",

                        fontSize:
                          "18px",
                      }}
                    >
                      Prenotazione
                      per gruppo
                    </strong>

                    <p
                      style={{
                        maxWidth:
                          "520px",

                        margin:
                          "0 auto",

                        color:
                          "#64748b",

                        fontSize:
                          "13px",

                        lineHeight:
                          "1.6",
                      }}
                    >
                      {
                        contactMessage
                      }
                    </p>

                    {maxGuestsPerReservation !==
                      null && (
                      <div
                        style={{
                          marginTop:
                            "13px",

                          color:
                            "#7c3aed",

                          fontSize:
                            "11px",

                          fontWeight:
                            "800",
                        }}
                      >
                        Prenotazione
                        online fino
                        a{" "}
                        {
                          maxGuestsPerReservation
                        }{" "}
                        persone
                      </div>
                    )}

                    {restaurantPhone ? (
                      <a
                        href={`tel:${restaurantPhone.replace(
                          /\s/g,
                          ""
                        )}`}
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          justifyContent:
                            "center",

                          gap:
                            "8px",

                          minHeight:
                            "46px",

                          marginTop:
                            "20px",

                          padding:
                            "0 22px",

                          borderRadius:
                            "12px",

                          color:
                            "#ffffff",

                          background:
                            "linear-gradient(135deg,#7c3aed,#d946ef)",

                          textDecoration:
                            "none",

                          fontSize:
                            "13px",

                          fontWeight:
                            "900",

                          boxShadow:
                            "0 8px 22px rgba(124,58,237,0.18)",
                        }}
                      >
                        📞 Chiama{" "}
                        {
                          restaurantPhone
                        }
                      </a>
                    ) : (
                      <div
                        style={{
                          marginTop:
                            "18px",

                          color:
                            "#64748b",

                          fontSize:
                            "12px",
                        }}
                      >
                        Contatta
                        direttamente
                        il locale per
                        verificare la
                        disponibilità.
                      </div>
                    )}
                  </div>
                )}

              {!slotsLoading &&
                !requiresContact &&
                slotsError && (
                  <div className="booking-selection-summary booking-error">
                    {
                      slotsError
                    }
                  </div>
                )}

              {!slotsLoading &&
                !requiresContact &&
                !slotsError &&
                slots.length ===
                  0 && (
                  <div className="booking-selection-summary">
                    Nessun orario
                    disponibile per
                    il giorno
                    selezionato.
                  </div>
                )}

              {!requiresContact && (
                <div className="time-grid">
                  {slots.map(
                    (slot) => (
                      <button
                        type="button"
                        key={
                          slot.time
                        }
                        disabled={
                          !slot.available
                        }
                        onClick={() =>
                          setTime(
                            slot.time
                          )
                        }
                        className={[
                          "time-slot",

                          time ===
                          slot.time
                            ? "selected"
                            : "",

                          !slot.available
                            ? "unavailable"
                            : "",
                        ].join(
                          " "
                        )}
                      >
                        <span className="slot-time">
                          {
                            slot.time
                          }
                        </span>

                        <span className="slot-status">
                          {
                            slot.label
                          }
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="booking-step">
              <span className="booking-step-label">
                PASSAGGIO 5 DI 5
              </span>

              <h2>
                I tuoi dati
              </h2>

              <p>
                Inserisci i dati
                necessari per
                confermare.
              </p>

              <div className="booking-form-grid">
                <label>
                  Nome e cognome *

                  <input
                    value={
                      customerName
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerName(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Mario Rossi"
                  />
                </label>

                <label>
                  Telefono *

                  <input
                    value={
                      customerPhone
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerPhone(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="+39 333 1234567"
                  />
                </label>

                <label>
                  Email

                  <input
                    type="email"
                    value={
                      customerEmail
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerEmail(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="mario@email.it"
                  />
                </label>

                <label className="booking-full-field">
                  Note

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Allergie, seggiolone, richieste particolari..."
                  />
                </label>
              </div>

              <div className="booking-final-summary">
                <div>
                  <span>
                    Persone
                  </span>

                  <strong>
                    {guests}
                  </strong>
                </div>

                <div>
                  <span>
                    Servizio
                  </span>

                  <strong>
                    {session ===
                    "pranzo"
                      ? "Pranzo"
                      : "Cena"}
                  </strong>
                </div>

                <div>
                  <span>
                    Data
                  </span>

                  <strong>
                    {formatEuropeanDate(
                      date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Orario
                  </span>

                  <strong>
                    {time}
                  </strong>
                </div>
              </div>

              <label className="privacy-check">
                <input
                  type="checkbox"
                  checked={
                    privacyAccepted
                  }
                  onChange={(
                    event
                  ) =>
                    setPrivacyAccepted(
                      event
                        .target
                        .checked
                    )
                  }
                />

                <span>
                  Accetto
                  l’informativa
                  privacy e il
                  trattamento dei
                  dati.
                </span>
              </label>
            </div>
          )}
        </section>

        <div className="booking-actions">
          {step > 1 && (
            <button
              type="button"
              className="booking-back"
              onClick={
                goBack
              }
              disabled={
                submitting
              }
            >
              ← Indietro
            </button>
          )}

          {step < 5 ? (
            /*
             * Se siamo al passaggio
             * orario e il gruppo
             * deve telefonare,
             * non mostriamo Avanti.
             */
            !(
              step === 4 &&
              requiresContact
            ) && (
              <button
                type="button"
                className="booking-next"
                onClick={
                  goNext
                }
              >
                Avanti →
              </button>
            )
          ) : (
            <button
              type="button"
              className="booking-confirm"
              onClick={
                confirmBooking
              }
              disabled={
                submitting
              }
            >
              {submitting
                ? "Invio in corso..."
                : "Conferma prenotazione"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}