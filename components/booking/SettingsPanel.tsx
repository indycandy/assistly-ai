"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type ServiceName = "pranzo" | "cena";

type AvailabilityRow = {
  id: string;
  company_id: string;
  day_of_week: number;
  service: string;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
};

type CapacityRow = {
  id: string;
  company_id: string;
  day_of_week: number;
  max_guests: number;
  is_active: boolean;
};

type RestaurantSettingsRow = {
  id: string;
  company_id: string;
  restaurant_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  table_duration_minutes: number;
  max_guests_per_reservation: number;
};

type RestaurantInfo = {
  restaurantName: string;
  phone: string;
  email: string;
  address: string;
  tableDurationMinutes: number;
  maxGuestsPerReservation: number;
};

type ServiceSettings = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

type DaySettings = {
  dayOfWeek: number;
  label: string;
  shortLabel: string;
  lunch: ServiceSettings;
  dinner: ServiceSettings;
  maxGuests: number;
  capacityEnabled: boolean;
};

const DAYS = [
  { dayOfWeek: 1, label: "Lunedì", shortLabel: "Lun" },
  { dayOfWeek: 2, label: "Martedì", shortLabel: "Mar" },
  { dayOfWeek: 3, label: "Mercoledì", shortLabel: "Mer" },
  { dayOfWeek: 4, label: "Giovedì", shortLabel: "Gio" },
  { dayOfWeek: 5, label: "Venerdì", shortLabel: "Ven" },
  { dayOfWeek: 6, label: "Sabato", shortLabel: "Sab" },
  { dayOfWeek: 0, label: "Domenica", shortLabel: "Dom" },
];

const TIME_OPTIONS = createTimeOptions();

function createTimeOptions() {
  const values: string[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const h = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");
      values.push(`${h}:${m}`);
    }
  }

  return values;
}

function createDefaultSettings(): DaySettings[] {
  return DAYS.map((day) => ({
    ...day,

    lunch: {
      enabled: true,
      startTime: "12:00",
      endTime: "15:00",
      slotMinutes: 30,
    },

    dinner: {
      enabled: true,
      startTime: "19:30",
      endTime: "23:00",
      slotMinutes: 30,
    },

    maxGuests: 40,
    capacityEnabled: true,
  }));
}

function cleanTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

export default function SettingsPanel() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [settings, setSettings] =
    useState<DaySettings[]>(
      createDefaultSettings()
    );

  const [restaurantInfo, setRestaurantInfo] =
    useState<RestaurantInfo>({
      restaurantName: "",
      phone: "",
      email: "",
      address: "",
      tableDurationMinutes: 120,
      maxGuestsPerReservation: 10,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [showSavedBanner, setShowSavedBanner] =
    useState(false);

  const loadSettings = useCallback(
    async (clearMessages = true) => {
      setLoading(true);

      if (clearMessages) {
        setErrorMessage("");
      }

      const companyId =
        process.env.NEXT_PUBLIC_PILOT_COMPANY_ID;

      if (!companyId) {
        setErrorMessage(
          "Company ID non configurato."
        );

        setLoading(false);
        return;
      }

      const [
        availabilityResult,
        capacityResult,
        restaurantResult,
      ] = await Promise.all([
        supabase
          .from("reservation_availability")
          .select(`
            id,
            company_id,
            day_of_week,
            service,
            start_time,
            end_time,
            slot_minutes,
            is_active
          `)
          .eq("company_id", companyId),

        supabase
          .from("reservation_capacity")
          .select(`
            id,
            company_id,
            day_of_week,
            max_guests,
            is_active
          `)
          .eq("company_id", companyId),

        supabase
          .from("restaurant_settings")
          .select(`
            id,
            company_id,
            restaurant_name,
            phone,
            email,
            address,
            table_duration_minutes,
            max_guests_per_reservation
          `)
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

      if (availabilityResult.error) {
        console.log(
          "Errore disponibilità:",
          availabilityResult.error
        );

        setErrorMessage(
          "Errore durante il caricamento degli orari."
        );

        setLoading(false);
        return;
      }

      if (capacityResult.error) {
        console.log(
          "Errore capienza:",
          capacityResult.error
        );

        setErrorMessage(
          "Errore durante il caricamento della capienza."
        );

        setLoading(false);
        return;
      }

      if (restaurantResult.error) {
        console.log(
          "Errore dati ristorante:",
          restaurantResult.error
        );

        setErrorMessage(
          "Errore durante il caricamento dei dati del ristorante."
        );

        setLoading(false);
        return;
      }

      const availability =
        (availabilityResult.data ?? []) as AvailabilityRow[];

      const capacities =
        (capacityResult.data ?? []) as CapacityRow[];

      const restaurant =
        restaurantResult.data as
          | RestaurantSettingsRow
          | null;

      if (restaurant) {
        setRestaurantInfo({
          restaurantName:
            restaurant.restaurant_name ?? "",

          phone:
            restaurant.phone ?? "",

          email:
            restaurant.email ?? "",

          address:
            restaurant.address ?? "",

          tableDurationMinutes:
            restaurant.table_duration_minutes ?? 120,

          maxGuestsPerReservation:
            restaurant.max_guests_per_reservation ?? 10,
        });
      }

      const nextSettings =
        createDefaultSettings().map(
          (day) => {
            const lunch =
              availability.find(
                (row) =>
                  row.day_of_week === day.dayOfWeek &&
                  row.service?.toLowerCase() === "pranzo"
              );

            const dinner =
              availability.find(
                (row) =>
                  row.day_of_week === day.dayOfWeek &&
                  row.service?.toLowerCase() === "cena"
              );

            const capacity =
              capacities.find(
                (row) =>
                  row.day_of_week === day.dayOfWeek
              );

            return {
              ...day,

              lunch: lunch
                ? {
                    enabled: lunch.is_active,
                    startTime:
                      cleanTime(lunch.start_time) ||
                      "12:00",
                    endTime:
                      cleanTime(lunch.end_time) ||
                      "15:00",
                    slotMinutes:
                      lunch.slot_minutes ?? 30,
                  }
                : day.lunch,

              dinner: dinner
                ? {
                    enabled: dinner.is_active,
                    startTime:
                      cleanTime(dinner.start_time) ||
                      "19:30",
                    endTime:
                      cleanTime(dinner.end_time) ||
                      "23:00",
                    slotMinutes:
                      dinner.slot_minutes ?? 30,
                  }
                : day.dinner,

              maxGuests:
                capacity?.max_guests ??
                day.maxGuests,

              capacityEnabled:
                capacity?.is_active ??
                true,
            };
          }
        );

      setSettings(nextSettings);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function markChanged() {
    setSuccessMessage("");
    setShowSavedBanner(false);
  }

  function updateRestaurantInfo<
    K extends keyof RestaurantInfo
  >(
    field: K,
    value: RestaurantInfo[K]
  ) {
    markChanged();

    setRestaurantInfo((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateService(
    dayOfWeek: number,
    service: ServiceName,
    field: keyof ServiceSettings,
    value: string | number | boolean
  ) {
    markChanged();

    setSettings((current) =>
      current.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) {
          return day;
        }

        const key =
          service === "pranzo"
            ? "lunch"
            : "dinner";

        return {
          ...day,
          [key]: {
            ...day[key],
            [field]: value,
          },
        };
      })
    );
  }

  function updateCapacity(
    dayOfWeek: number,
    value: number
  ) {
    markChanged();

    setSettings((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              maxGuests: Math.max(1, value),
            }
          : day
      )
    );
  }

  function toggleCapacity(dayOfWeek: number) {
    markChanged();

    setSettings((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              capacityEnabled:
                !day.capacityEnabled,
            }
          : day
      )
    );
  }

  async function saveRestaurantInfo(
    companyId: string
  ) {
    const { error } = await supabase
      .from("restaurant_settings")
      .upsert(
        {
          company_id: companyId,

          restaurant_name:
            restaurantInfo.restaurantName.trim() ||
            null,

          phone:
            restaurantInfo.phone.trim() ||
            null,

          email:
            restaurantInfo.email.trim() ||
            null,

          address:
            restaurantInfo.address.trim() ||
            null,

          table_duration_minutes:
            restaurantInfo.tableDurationMinutes,

          max_guests_per_reservation:
            restaurantInfo.maxGuestsPerReservation,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "company_id",
        }
      );

    if (error) {
      throw error;
    }
  }

  async function saveAvailability(
    companyId: string,
    day: DaySettings,
    service: ServiceName,
    data: ServiceSettings
  ) {
    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("reservation_availability")
      .select("id")
      .eq("company_id", companyId)
      .eq("day_of_week", day.dayOfWeek)
      .eq("service", service);

    if (existingError) {
      throw existingError;
    }

    const payload = {
      start_time: data.startTime,
      end_time: data.endTime,
      slot_minutes: data.slotMinutes,
      is_active: data.enabled,
    };

    if (
      existingRows &&
      existingRows.length > 0
    ) {
      const { error } = await supabase
        .from("reservation_availability")
        .update(payload)
        .eq("company_id", companyId)
        .eq("day_of_week", day.dayOfWeek)
        .eq("service", service);

      if (error) {
        throw error;
      }

      return;
    }

    const { error } = await supabase
      .from("reservation_availability")
      .insert({
        company_id: companyId,
        day_of_week: day.dayOfWeek,
        service,
        ...payload,
      });

    if (error) {
      throw error;
    }
  }

  async function saveCapacity(
    companyId: string,
    day: DaySettings
  ) {
    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("reservation_capacity")
      .select("id")
      .eq("company_id", companyId)
      .eq("day_of_week", day.dayOfWeek);

    if (existingError) {
      throw existingError;
    }

    const payload = {
      max_guests: day.maxGuests,
      is_active: day.capacityEnabled,
    };

    if (
      existingRows &&
      existingRows.length > 0
    ) {
      const { error } = await supabase
        .from("reservation_capacity")
        .update(payload)
        .eq("company_id", companyId)
        .eq("day_of_week", day.dayOfWeek);

      if (error) {
        throw error;
      }

      return;
    }

    const { error } = await supabase
      .from("reservation_capacity")
      .insert({
        company_id: companyId,
        day_of_week: day.dayOfWeek,
        ...payload,
      });

    if (error) {
      throw error;
    }
  }

  async function saveSettings() {
    const companyId =
      process.env.NEXT_PUBLIC_PILOT_COMPANY_ID;

    if (!companyId) {
      setErrorMessage(
        "Company ID non configurato."
      );
      return;
    }

    if (
      restaurantInfo.tableDurationMinutes < 30
    ) {
      setErrorMessage(
        "La durata del tavolo deve essere di almeno 30 minuti."
      );
      return;
    }

    if (
      restaurantInfo.maxGuestsPerReservation < 1
    ) {
      setErrorMessage(
        "Inserisci un numero massimo di persone valido."
      );
      return;
    }

    for (const day of settings) {
      if (
        day.lunch.enabled &&
        day.lunch.startTime >=
          day.lunch.endTime
      ) {
        setErrorMessage(
          `${day.label}: l'orario di fine pranzo deve essere successivo all'orario di apertura.`
        );
        return;
      }

      if (
        day.dinner.enabled &&
        day.dinner.startTime >=
          day.dinner.endTime
      ) {
        setErrorMessage(
          `${day.label}: l'orario di fine cena deve essere successivo all'orario di apertura.`
        );
        return;
      }

      if (day.maxGuests < 1) {
        setErrorMessage(
          `${day.label}: inserisci una capienza valida.`
        );
        return;
      }
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    setShowSavedBanner(false);

    try {
      await saveRestaurantInfo(companyId);

      for (const day of settings) {
        await saveAvailability(
          companyId,
          day,
          "pranzo",
          day.lunch
        );

        await saveAvailability(
          companyId,
          day,
          "cena",
          day.dinner
        );

        await saveCapacity(
          companyId,
          day
        );
      }

      await loadSettings(false);

      setSuccessMessage(
        "Dati ristorante, orari e capienza sono stati salvati correttamente."
      );

      setShowSavedBanner(true);

      window.setTimeout(() => {
        setSuccessMessage("");
        setShowSavedBanner(false);
      }, 5000);
    } catch (error) {
      console.log(
        "Errore salvataggio impostazioni:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      );
    } finally {
      setSaving(false);
    }
  }

  function copyMondayToAll() {
    const monday =
      settings.find(
        (day) => day.dayOfWeek === 1
      );

    if (!monday) return;

    setSettings((current) =>
      current.map((day) => {
        if (day.dayOfWeek === 1) {
          return day;
        }

        return {
          ...day,

          lunch: {
            ...monday.lunch,
          },

          dinner: {
            ...monday.dinner,
          },

          maxGuests:
            monday.maxGuests,

          capacityEnabled:
            monday.capacityEnabled,
        };
      })
    );

    setSuccessMessage(
      "Configurazione del lunedì copiata su tutta la settimana. Premi Salva modifiche per confermare."
    );

    setShowSavedBanner(false);
  }

  const activeLunchDays =
    settings.filter(
      (day) => day.lunch.enabled
    ).length;

  const activeDinnerDays =
    settings.filter(
      (day) => day.dinner.enabled
    ).length;

  const averageCapacity =
    settings.length > 0
      ? Math.round(
          settings.reduce(
            (sum, day) =>
              sum + day.maxGuests,
            0
          ) / settings.length
        )
      : 0;

  if (loading) {
    return (
      <section className="settings-panel">
        <div className="settings-loading">
          <div className="settings-spinner" />

          <span>
            Caricamento impostazioni...
          </span>
        </div>

        <style>{styles}</style>
      </section>
    );
  }

  return (
    <section className="settings-panel">
      <div className="settings-hero">
        <div>
          <span className="settings-eyebrow">
            CONFIGURAZIONE
          </span>

          <h2>
            Impostazioni ristorante
          </h2>

          <p>
            Gestisci dati del locale,
            prenotazioni, orari e capienza.
          </p>
        </div>

        <div className="settings-summary">
          <div>
            <strong>
              {activeLunchDays}
            </strong>
            <span>Pranzi attivi</span>
          </div>

          <div>
            <strong>
              {activeDinnerDays}
            </strong>
            <span>Cene attive</span>
          </div>

          <div>
            <strong>
              {averageCapacity}
            </strong>
            <span>Capienza media</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="settings-message error">
          ⚠ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          className={[
            "settings-message",
            "success",
            showSavedBanner
              ? "saved"
              : "",
          ].join(" ")}
        >
          <div className="success-icon">
            ✓
          </div>

          <div>
            <strong>
              {showSavedBanner
                ? "Modifiche salvate"
                : "Operazione completata"}
            </strong>

            <span>
              {successMessage}
            </span>
          </div>
        </div>
      )}

      <section className="restaurant-card">
        <div className="restaurant-card-header">
          <div className="restaurant-icon">
            🏪
          </div>

          <div>
            <span>
              DATI RISTORANTE
            </span>

            <h3>
              Informazioni del locale
            </h3>

            <p>
              Questi dati verranno utilizzati
              da Assistly per prenotazioni e
              assistenza clienti.
            </p>
          </div>
        </div>

        <div className="restaurant-form">
          <div className="restaurant-field">
            <label>
              Nome ristorante
            </label>

            <input
              type="text"
              placeholder="Es. Ristorante Bella Napoli"
              value={
                restaurantInfo.restaurantName
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "restaurantName",
                  e.target.value
                )
              }
            />
          </div>

          <div className="restaurant-field">
            <label>
              Telefono
            </label>

            <input
              type="tel"
              placeholder="+39 ..."
              value={
                restaurantInfo.phone
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "phone",
                  e.target.value
                )
              }
            />
          </div>

          <div className="restaurant-field">
            <label>
              Email
            </label>

            <input
              type="email"
              placeholder="info@ristorante.it"
              value={
                restaurantInfo.email
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "email",
                  e.target.value
                )
              }
            />
          </div>

          <div className="restaurant-field restaurant-address">
            <label>
              Indirizzo
            </label>

            <input
              type="text"
              placeholder="Via, numero civico, città"
              value={
                restaurantInfo.address
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "address",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <div className="booking-rules">
          <div className="booking-rule">
            <div className="rule-icon">
              ⏱
            </div>

            <div className="rule-content">
              <strong>
                Durata media tavolo
              </strong>

              <span>
                Tempo previsto di occupazione
                per una prenotazione.
              </span>
            </div>

            <select
              value={
                restaurantInfo.tableDurationMinutes
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "tableDurationMinutes",
                  Number(e.target.value)
                )
              }
            >
              <option value={60}>
                60 minuti
              </option>

              <option value={90}>
                90 minuti
              </option>

              <option value={120}>
                120 minuti
              </option>

              <option value={150}>
                150 minuti
              </option>

              <option value={180}>
                180 minuti
              </option>
            </select>
          </div>

          <div className="booking-rule">
            <div className="rule-icon">
              👥
            </div>

            <div className="rule-content">
              <strong>
                Massimo persone per prenotazione
              </strong>

              <span>
                Oltre questo numero potremo
                gestire la richiesta manualmente.
              </span>
            </div>

            <select
              value={
                restaurantInfo.maxGuestsPerReservation
              }
              onChange={(e) =>
                updateRestaurantInfo(
                  "maxGuestsPerReservation",
                  Number(e.target.value)
                )
              }
            >
              {[2, 4, 6, 8, 10, 12, 15, 20, 25, 30].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value} persone
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      <div className="settings-toolbar">
        <div>
          <strong>
            Settimana prenotazioni
          </strong>

          <p>
            Modifica ogni giorno oppure
            configura il lunedì e copialo
            sugli altri giorni.
          </p>
        </div>

        <button
          type="button"
          className="copy-button"
          onClick={copyMondayToAll}
        >
          ⧉ Copia lunedì su tutti
        </button>
      </div>

      <div className="settings-days">
        {settings.map((day) => (
          <article
            className="day-card"
            key={day.dayOfWeek}
          >
            <div className="day-header">
              <div className="day-name">
                <span>
                  {day.shortLabel}
                </span>

                <div>
                  <h3>
                    {day.label}
                  </h3>

                  <p>
                    Configurazione giornaliera
                  </p>
                </div>
              </div>

              <div className="capacity-control">
                <label>
                  Capienza massima
                </label>

                <div className="capacity-row">
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={
                      day.maxGuests
                    }
                    disabled={
                      !day.capacityEnabled
                    }
                    onChange={(e) =>
                      updateCapacity(
                        day.dayOfWeek,
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                  <span>
                    persone
                  </span>

                  <button
                    type="button"
                    className={[
                      "mini-toggle",
                      day.capacityEnabled
                        ? "enabled"
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      toggleCapacity(
                        day.dayOfWeek
                      )
                    }
                  >
                    <i />
                  </button>
                </div>
              </div>
            </div>

            <div className="services-grid">
              <ServiceCard
                title="Pranzo"
                icon="☀"
                service={day.lunch}
                dayOfWeek={day.dayOfWeek}
                serviceName="pranzo"
                onUpdate={updateService}
              />

              <ServiceCard
                title="Cena"
                icon="☾"
                service={day.dinner}
                dayOfWeek={day.dayOfWeek}
                serviceName="cena"
                onUpdate={updateService}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="settings-save-bar">
        <div>
          <strong>
            Salva configurazione
          </strong>

          <span>
            Salva dati ristorante, orari,
            slot e capienza.
          </span>
        </div>

        <button
          type="button"
          className="save-settings-button"
          disabled={saving}
          onClick={saveSettings}
        >
          {saving
            ? "Salvataggio..."
            : "✓ Salva modifiche"}
        </button>
      </div>

      <style>{styles}</style>
    </section>
  );
}

function ServiceCard({
  title,
  icon,
  service,
  dayOfWeek,
  serviceName,
  onUpdate,
}: {
  title: string;
  icon: string;
  service: ServiceSettings;
  dayOfWeek: number;
  serviceName: ServiceName;

  onUpdate: (
    dayOfWeek: number,
    service: ServiceName,
    field: keyof ServiceSettings,
    value: string | number | boolean
  ) => void;
}) {
  return (
    <div
      className={[
        "service-card",
        service.enabled
          ? ""
          : "disabled",
      ].join(" ")}
    >
      <div className="service-header">
        <div>
          <span className="service-icon">
            {icon}
          </span>

          <strong>
            {title}
          </strong>
        </div>

        <button
          type="button"
          className={[
            "service-toggle",
            service.enabled
              ? "enabled"
              : "",
          ].join(" ")}
          onClick={() =>
            onUpdate(
              dayOfWeek,
              serviceName,
              "enabled",
              !service.enabled
            )
          }
        >
          <i />
        </button>
      </div>

      <div className="service-fields">
        <div className="settings-field">
          <label>Apertura</label>

          <select
            value={service.startTime}
            disabled={!service.enabled}
            onChange={(e) =>
              onUpdate(
                dayOfWeek,
                serviceName,
                "startTime",
                e.target.value
              )
            }
          >
            {TIME_OPTIONS.map(
              (time) => (
                <option
                  key={time}
                  value={time}
                >
                  {time}
                </option>
              )
            )}
          </select>
        </div>

        <div className="time-arrow">
          →
        </div>

        <div className="settings-field">
          <label>Chiusura</label>

          <select
            value={service.endTime}
            disabled={!service.enabled}
            onChange={(e) =>
              onUpdate(
                dayOfWeek,
                serviceName,
                "endTime",
                e.target.value
              )
            }
          >
            {TIME_OPTIONS.map(
              (time) => (
                <option
                  key={time}
                  value={time}
                >
                  {time}
                </option>
              )
            )}
          </select>
        </div>

        <div className="settings-field slot-field">
          <label>
            Slot prenotazioni
          </label>

          <select
            value={service.slotMinutes}
            disabled={!service.enabled}
            onChange={(e) =>
              onUpdate(
                dayOfWeek,
                serviceName,
                "slotMinutes",
                Number(e.target.value)
              )
            }
          >
            <option value={15}>
              Ogni 15 minuti
            </option>

            <option value={30}>
              Ogni 30 minuti
            </option>

            <option value={45}>
              Ogni 45 minuti
            </option>

            <option value={60}>
              Ogni 60 minuti
            </option>
          </select>
        </div>
      </div>

      {service.enabled ? (
        <div className="slot-preview">
          <span>
            Slot disponibili:
          </span>

          <strong>
            {buildSlotPreview(
              service.startTime,
              service.endTime,
              service.slotMinutes
            )}
          </strong>
        </div>
      ) : (
        <div className="service-closed">
          Servizio non disponibile
        </div>
      )}
    </div>
  );
}

function buildSlotPreview(
  start: string,
  end: string,
  interval: number
) {
  const startMinutes =
    timeToMinutes(start);

  const endMinutes =
    timeToMinutes(end);

  if (
    startMinutes >= endMinutes ||
    interval <= 0
  ) {
    return "—";
  }

  const slots: string[] = [];

  for (
    let current = startMinutes;
    current <= endMinutes;
    current += interval
  ) {
    slots.push(
      minutesToTime(current)
    );

    if (slots.length >= 8) {
      break;
    }
  }

  const totalSlots =
    Math.floor(
      (endMinutes - startMinutes) /
        interval
    ) + 1;

  if (totalSlots > slots.length) {
    return `${slots.join(" · ")} · ...`;
  }

  return slots.join(" · ");
}

function timeToMinutes(value: string) {
  const [hours, minutes] =
    value.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(mins).padStart(
    2,
    "0"
  )}`;
}

const styles = `
  .settings-panel {
    width: 100%;
    display: grid;
    gap: 22px;
  }

  .settings-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    padding: 28px 30px;
    border: 1px solid #e6eaf0;
    border-radius: 22px;
    background: #ffffff;
    box-shadow:
      0 10px 35px
      rgba(15, 23, 42, 0.045);
  }

  .settings-eyebrow {
    display: block;
    margin-bottom: 7px;
    color: #7c3aed;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.5px;
  }

  .settings-hero h2 {
    margin: 0;
    color: #111827;
    font-size: 30px;
  }

  .settings-hero p {
    margin: 9px 0 0;
    color: #64748b;
    font-size: 14px;
  }

  .settings-summary {
    display: grid;
    grid-template-columns:
      repeat(3, minmax(100px, 1fr));
    gap: 9px;
  }

  .settings-summary > div {
    min-width: 100px;
    padding: 13px 16px;
    text-align: center;
    border-radius: 14px;
    background: #f7f8fb;
    border: 1px solid #edf0f4;
  }

  .settings-summary strong,
  .settings-summary span {
    display: block;
  }

  .settings-summary strong {
    color: #111827;
    font-size: 21px;
  }

  .settings-summary span {
    margin-top: 3px;
    color: #7b8aa0;
    font-size: 10px;
    font-weight: 700;
  }

  .settings-message {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 17px;
    border-radius: 13px;
  }

  .settings-message.error {
    color: #b91c1c;
    border: 1px solid #fecaca;
    background: #fef2f2;
    font-size: 12px;
    font-weight: 700;
  }

  .settings-message.success {
    color: #15803d;
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
  }

  .settings-message.success.saved {
    border-color: #86efac;
    box-shadow:
      0 8px 24px
      rgba(34, 197, 94, 0.08);
  }

  .success-icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    color: #ffffff;
    background: #22c55e;
    font-size: 18px;
    font-weight: 900;
  }

  .settings-message.success strong,
  .settings-message.success span {
    display: block;
  }

  .settings-message.success strong {
    font-size: 13px;
  }

  .settings-message.success span {
    margin-top: 2px;
    font-size: 11px;
  }

  .restaurant-card {
    padding: 24px;
    border: 1px solid #e6eaf0;
    border-radius: 20px;
    background: #ffffff;
    box-shadow:
      0 8px 30px
      rgba(15, 23, 42, 0.035);
  }

  .restaurant-card-header {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-bottom: 22px;
  }

  .restaurant-icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 13px;
    background:
      linear-gradient(
        135deg,
        #ede9fe,
        #fae8ff
      );
    font-size: 20px;
  }

  .restaurant-card-header span {
    display: block;
    margin-bottom: 3px;
    color: #7c3aed;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1.4px;
  }

  .restaurant-card-header h3 {
    margin: 0;
    color: #111827;
    font-size: 18px;
  }

  .restaurant-card-header p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 11px;
  }

  .restaurant-form {
    display: grid;
    grid-template-columns:
      repeat(3, 1fr);
    gap: 14px;
  }

  .restaurant-field {
    display: grid;
    gap: 7px;
  }

  .restaurant-address {
    grid-column: 1 / -1;
  }

  .restaurant-field label {
    color: #475569;
    font-size: 10px;
    font-weight: 800;
  }

  .restaurant-field input {
    width: 100%;
    height: 44px;
    padding: 0 13px;
    box-sizing: border-box;
    outline: none;
    border: 1px solid #dce2ea;
    border-radius: 10px;
    background: #ffffff;
    color: #172033;
    font-size: 12px;
  }

  .restaurant-field input:focus {
    border-color: #9f67f6;
    box-shadow:
      0 0 0 3px
      rgba(124, 58, 237, 0.08);
  }

  .booking-rules {
    display: grid;
    grid-template-columns:
      1fr 1fr;
    gap: 12px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid #edf0f4;
  }

  .booking-rule {
    display: grid;
    grid-template-columns:
      auto 1fr auto;
    align-items: center;
    gap: 11px;
    padding: 14px;
    border: 1px solid #e7ebf1;
    border-radius: 13px;
    background: #fafbfc;
  }

  .rule-icon {
    width: 35px;
    height: 35px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #f0ebff;
    font-size: 15px;
  }

  .rule-content strong,
  .rule-content span {
    display: block;
  }

  .rule-content strong {
    color: #172033;
    font-size: 11px;
  }

  .rule-content span {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 9px;
    line-height: 1.4;
  }

  .booking-rule select {
    height: 38px;
    min-width: 125px;
    padding: 0 10px;
    outline: none;
    border: 1px solid #dce2ea;
    border-radius: 9px;
    background: #ffffff;
    color: #172033;
    font-size: 10px;
    font-weight: 700;
  }

  .settings-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 24px;
    border: 1px solid #e6eaf0;
    border-radius: 18px;
    background: #ffffff;
  }

  .settings-toolbar strong {
    color: #172033;
    font-size: 15px;
  }

  .settings-toolbar p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 11px;
  }

  .copy-button {
    height: 40px;
    padding: 0 16px;
    border: 1px solid #ddd6fe;
    border-radius: 10px;
    color: #6d28d9;
    background: #f5f3ff;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .settings-days {
    display: grid;
    gap: 15px;
  }

  .day-card {
    padding: 22px;
    border: 1px solid #e6eaf0;
    border-radius: 18px;
    background: #ffffff;
  }

  .day-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 18px;
  }

  .day-name {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .day-name > span {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: #7c3aed;
    background: #f2edff;
    font-size: 11px;
    font-weight: 900;
  }

  .day-name h3 {
    margin: 0;
    color: #172033;
    font-size: 17px;
  }

  .day-name p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 10px;
  }

  .capacity-control label {
    display: block;
    margin-bottom: 6px;
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .capacity-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .capacity-row input {
    width: 76px;
    height: 36px;
    padding: 0 10px;
    box-sizing: border-box;
    outline: none;
    border: 1px solid #dce2ea;
    border-radius: 9px;
    background: #ffffff;
    color: #172033;
  }

  .capacity-row span {
    color: #94a3b8;
    font-size: 10px;
  }

  .services-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .service-card {
    padding: 16px;
    border: 1px solid #e7ebf1;
    border-radius: 14px;
    background: #fafbfc;
  }

  .service-card.disabled {
    opacity: 0.65;
    background: #f6f7f9;
  }

  .service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
  }

  .service-header > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .service-header strong {
    color: #172033;
    font-size: 13px;
  }

  .service-icon {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: #7c3aed;
    background: #f0ebff;
  }

  .service-toggle,
  .mini-toggle {
    position: relative;
    width: 38px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: #dce1e8;
    cursor: pointer;
  }

  .service-toggle i,
  .mini-toggle i {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    transition:
      transform 0.15s ease;
  }

  .service-toggle.enabled,
  .mini-toggle.enabled {
    background: #7c3aed;
  }

  .service-toggle.enabled i,
  .mini-toggle.enabled i {
    transform: translateX(16px);
  }

  .mini-toggle {
    width: 34px;
    height: 20px;
  }

  .mini-toggle i {
    width: 14px;
    height: 14px;
  }

  .mini-toggle.enabled i {
    transform: translateX(14px);
  }

  .service-fields {
    display: grid;
    grid-template-columns:
      minmax(105px, 1fr)
      auto
      minmax(105px, 1fr)
      minmax(140px, 1fr);
    align-items: end;
    gap: 9px;
  }

  .settings-field {
    display: grid;
    gap: 6px;
  }

  .settings-field label {
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .settings-field select {
    width: 100%;
    height: 39px;
    padding: 0 10px;
    border: 1px solid #dce2ea;
    border-radius: 9px;
    background: #ffffff;
    color: #172033;
    font-size: 11px;
  }

  .time-arrow {
    padding-bottom: 11px;
    color: #a8b1bf;
  }

  .slot-preview {
    margin-top: 12px;
    padding: 9px 11px;
    border: 1px solid #e8e4ff;
    border-radius: 9px;
    background: #f8f6ff;
    color: #6d28d9;
    line-height: 1.5;
  }

  .slot-preview span,
  .slot-preview strong {
    display: block;
  }

  .slot-preview span {
    margin-bottom: 3px;
    color: #8b7aa8;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .slot-preview strong {
    font-size: 10px;
  }

  .service-closed {
    margin-top: 10px;
    padding: 7px 10px;
    border-radius: 8px;
    color: #64748b;
    background: #e9edf2;
    text-align: center;
    font-size: 9px;
    font-weight: 800;
  }

  .settings-save-bar {
    position: sticky;
    bottom: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 16px 20px;
    border: 1px solid #ddd6fe;
    border-radius: 16px;
    background:
      rgba(255, 255, 255, 0.96);
    box-shadow:
      0 12px 35px
      rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(10px);
  }

  .settings-save-bar strong,
  .settings-save-bar span {
    display: block;
  }

  .settings-save-bar strong {
    color: #172033;
    font-size: 13px;
  }

  .settings-save-bar span {
    margin-top: 3px;
    color: #94a3b8;
    font-size: 10px;
  }

  .save-settings-button {
    min-width: 170px;
    height: 43px;
    padding: 0 19px;
    border: 0;
    border-radius: 11px;
    color: #ffffff;
    background:
      linear-gradient(
        135deg,
        #7c3aed,
        #d946ef
      );
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
  }

  .save-settings-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .settings-loading {
    min-height: 350px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 1px solid #e6eaf0;
    border-radius: 20px;
    background: #ffffff;
    color: #64748b;
  }

  .settings-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #eee9ff;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation:
      settingsSpin 0.8s linear infinite;
  }

  @keyframes settingsSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1180px) {
    .settings-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .settings-summary {
      width: 100%;
    }

    .restaurant-form {
      grid-template-columns: 1fr 1fr;
    }

    .booking-rules {
      grid-template-columns: 1fr;
    }

    .services-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .settings-hero,
    .restaurant-card,
    .day-card {
      padding: 18px;
      border-radius: 16px;
    }

    .settings-hero h2 {
      font-size: 25px;
    }

    .settings-summary {
      grid-template-columns: 1fr;
    }

    .restaurant-form {
      grid-template-columns: 1fr;
    }

    .restaurant-address {
      grid-column: auto;
    }

    .booking-rule {
      grid-template-columns:
        auto 1fr;
    }

    .booking-rule select {
      grid-column: 1 / -1;
      width: 100%;
    }

    .settings-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .day-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .service-fields {
      grid-template-columns:
        1fr 1fr;
    }

    .time-arrow {
      display: none;
    }

    .slot-field {
      grid-column: 1 / -1;
    }

    .settings-save-bar {
      align-items: stretch;
      flex-direction: column;
    }

    .save-settings-button {
      width: 100%;
    }
  }
`;