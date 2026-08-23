"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import SidebarV3 from "./dashboard/SidebarV3";
import ReservationsPanel from "./booking/ReservationsPanel";
import CalendarPanel from "./booking/CalendarPanel";
import TableMapPanel from "./booking/TableMapPanel";
import TablesPanel from "./booking/TablesPanel";

type DashboardPage =
  | "dashboard"
  | "prenotazioni"
  | "calendario"
  | "mappa-tavoli"
  | "tavoli"
  | "prodotti"
  | "faq"
  | "assistente"
  | "impostazioni";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled";

type Reservation = {
  id: string;
  customer_name: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  status: ReservationStatus;
  table_id: string | null;
};

type RestaurantTable = {
  id: string;
  table_name: string;
  seats: number;
  area: string;
  is_active: boolean;
};

type DashboardMetrics = {
  todayReservations: number;
  todayGuests: number;
  pendingReservations: number;
  activeTables: number;
  inactiveTables: number;
  totalTables: number;
};

const pageLabels: Record<DashboardPage, string> = {
  dashboard: "Dashboard",
  prenotazioni: "Prenotazioni",
  calendario: "Calendario",
  "mappa-tavoli": "Mappa tavoli",
  tavoli: "Tavoli",
  prodotti: "Prodotti",
  faq: "FAQ",
  assistente: "Assistente AI",
  impostazioni: "Impostazioni",
};

export default function DashboardV2() {
  const [page, setPage] =
    useState<DashboardPage>("dashboard");

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  function navigateTo(selectedPage: DashboardPage) {
    setPage(selectedPage);
    setMobileMenuOpen(false);
  }

  return (
    <div
      className={[
        "dashboard-v3",
        sidebarCollapsed
          ? "dashboard-v3-sidebar-collapsed"
          : "",
      ].join(" ")}
    >
      <SidebarV3
        page={page}
        onNavigate={navigateTo}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() =>
          setSidebarCollapsed((current) => !current)
        }
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="dashboard-v3-main">
        <DashboardHeader
          page={page}
          onOpenMobileMenu={() =>
            setMobileMenuOpen(true)
          }
        />

        <div className="dashboard-v3-content">
          {page === "dashboard" && (
            <DashboardHome onNavigate={navigateTo} />
          )}

          {page === "prenotazioni" && (
            <ReservationsPanel />
          )}

          {page === "calendario" && <CalendarPanel />}

          {page === "mappa-tavoli" && <TableMapPanel />}

          {page === "tavoli" && <TablesPanel />}

          {page === "prodotti" && (
            <PlaceholderPanel
              eyebrow="CATALOGO"
              title="Prodotti"
              description="Il pannello prodotti verrà integrato nella nuova Dashboard."
            />
          )}

          {page === "faq" && (
            <PlaceholderPanel
              eyebrow="ASSISTENZA CLIENTI"
              title="FAQ"
              description="Qui gestiremo le risposte automatiche dell’assistente."
            />
          )}

          {page === "assistente" && (
            <PlaceholderPanel
              eyebrow="INTELLIGENZA ARTIFICIALE"
              title="Assistente AI"
              description="Configurazione, test e istruzioni dell’assistente aziendale."
            />
          )}

          {page === "impostazioni" && (
            <PlaceholderPanel
              eyebrow="CONFIGURAZIONE"
              title="Impostazioni"
              description="Orari, capacità, dati aziendali e preferenze del ristorante."
            />
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardHeader({
  page,
  onOpenMobileMenu,
}: {
  page: DashboardPage;
  onOpenMobileMenu: () => void;
}) {
  const todayLabel = new Date().toLocaleDateString(
    "it-IT",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }
  );

  return (
    <header className="dashboard-v3-header">
      <div className="dashboard-v3-header-left">
        <button
          type="button"
          className="dashboard-v3-mobile-menu"
          onClick={onOpenMobileMenu}
          aria-label="Apri menu"
        >
          ☰
        </button>

        <div>
          <span className="dashboard-v3-header-eyebrow">
            CLIENTE PILOTA
          </span>

          <h1>{pageLabels[page]}</h1>
        </div>
      </div>

      <div className="dashboard-v3-header-right">
        <div className="dashboard-v3-date">
          <span>Oggi</span>
          <strong>{todayLabel}</strong>
        </div>

        <button
          type="button"
          className="dashboard-v3-notification"
          aria-label="Notifiche"
        >
          <span>3</span>
          ♢
        </button>

        <div className="dashboard-v3-profile">
          <div className="dashboard-v3-avatar">GM</div>

          <div>
            <strong>Gennaro</strong>
            <small>Amministratore</small>
          </div>
        </div>
      </div>
    </header>
  );
}

function DashboardHome({
  onNavigate,
}: {
  onNavigate: (page: DashboardPage) => void;
}) {
  const [reservations, setReservations] = useState<
    Reservation[]
  >([]);

  const [tables, setTables] = useState<
    RestaurantTable[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const loadDashboardData =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage("");

      const supabase = createClient();
      const today = getLocalDateValue(new Date());

      const [reservationsResult, tablesResult] =
        await Promise.all([
          supabase
            .from("reservation")
            .select(
  `
    id,
    customer_name,
    reservation_date,
    reservation_time,
    guests,
    status,
    table_id
  `
)
            .gte("reservation_date", today)
            .order("reservation_date", {
              ascending: true,
            })
            .order("reservation_time", {
              ascending: true,
            }),

          supabase
            .from("restaurant_tables")
            .select(
              `
                id,
                table_name,
                seats,
                area,
                is_active
              `
            )
            .order("area", { ascending: true })
            .order("table_name", {
              ascending: true,
            }),
        ]);

      if (reservationsResult.error) {
        console.error(
          "Errore caricamento prenotazioni:",
          reservationsResult.error
        );
      }

      if (tablesResult.error) {
        console.error(
          "Errore caricamento tavoli:",
          tablesResult.error
        );
      }

      if (
        reservationsResult.error ||
        tablesResult.error
      ) {
        setErrorMessage(
          "Alcuni dati non sono stati caricati correttamente."
        );
      }

      setReservations(
        (reservationsResult.data ??
          []) as Reservation[]
      );

      setTables(
        (tablesResult.data ??
          []) as RestaurantTable[]
      );

      setLoading(false);
    }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const today = getLocalDateValue(new Date());

  const metrics = useMemo<DashboardMetrics>(() => {
    const todayReservations =
      reservations.filter(
        (reservation) =>
          reservation.reservation_date === today &&
          reservation.status !== "cancelled"
      );

    return {
      todayReservations: todayReservations.length,

      todayGuests: todayReservations.reduce(
        (total, reservation) =>
          total +
          Number(reservation.guests ?? 0),
        0
      ),

      pendingReservations: reservations.filter(
        (reservation) =>
          reservation.status === "pending"
      ).length,

      activeTables: tables.filter(
        (table) => table.is_active
      ).length,

      inactiveTables: tables.filter(
        (table) => !table.is_active
      ).length,

      totalTables: tables.length,
    };
  }, [reservations, tables, today]);

  const upcomingReservations = useMemo(() => {
  const now = new Date();

  return reservations
    .filter((reservation) => {
      if (reservation.status === "cancelled") return false;

      const reservationDateTime = new Date(
        `${reservation.reservation_date}T${reservation.reservation_time}`
      );

      return reservationDateTime >= now;
    })
    .sort((a, b) => {
      const dateA = new Date(
        `${a.reservation_date}T${a.reservation_time}`
      ).getTime();

      const dateB = new Date(
        `${b.reservation_date}T${b.reservation_time}`
      ).getTime();

      return dateA - dateB;
    })
    .slice(0, 4);
}, [reservations]);

  const totalSeats = tables
  .filter((table) => table.is_active)
  .reduce(
    (total, table) => total + Number(table.seats ?? 0),
    0
  );

const occupationPercentage =

  totalSeats > 0
    ? Math.min(
        100,
        Math.round(
          (metrics.todayGuests / totalSeats) * 100
        )
      )
    : 0;
    const remainingSeats = Math.max(
  0,
  totalSeats - metrics.todayGuests
);

const overCapacity = Math.max(
  0,
  metrics.todayGuests - totalSeats
);

  return (
    
    <div className="dashboard-v3-home">
      <section className="dashboard-v3-welcome">
        <div>
          <span>BUONGIORNO GENNARO</span>

          <h2>
            Ecco cosa sta succedendo oggi nel tuo
            ristorante.
          </h2>

          <p>
            Prenotazioni, tavoli e attività aggiornate
            in tempo reale.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboardData}
          disabled={loading}
        >
          {loading
            ? "Aggiornamento..."
            : "Aggiorna dati"}
        </button>
      </section>

      {errorMessage && (
        <div className="dashboard-v3-error">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-v3-kpis">
        <KpiCard
          icon="◇"
          label="Prenotazioni oggi"
          value={
            loading
              ? "—"
              : String(metrics.todayReservations)
          }
          hint="Escluse le annullate"
          trend="+12%"
        />

        <KpiCard
          icon="◉"
          label="Coperti oggi"
          value={
            loading
              ? "—"
              : String(metrics.todayGuests)
          }
          hint="Persone previste"
          trend="+8%"
        />

        <KpiCard
          icon="⌑"
          label="Tavoli attivi"
          value={
            loading
              ? "—"
              : String(metrics.activeTables)
          }
          hint={`${metrics.totalTables} configurati`}
        />

        <KpiCard
          icon="◌"
          label="Occupazione"
          value={
            loading
              ? "—"
              : `${occupationPercentage}%`
          }
          hint={`${metrics.todayGuests} coperti su ${totalSeats} posti`}
        />
      </section>

      <div className="dashboard-v3-main-grid">
        <section className="dashboard-v3-card dashboard-v3-arrivals">
          <div className="dashboard-v3-card-header">
            <div>
              <span>PROSSIMI ARRIVI</span>
              <h3>Prenotazioni</h3>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate("prenotazioni")
              }
            >
              Vedi tutte
            </button>
          </div>

          {loading && (
            <EmptyState text="Caricamento prenotazioni..." />
          )}

          {!loading &&
            upcomingReservations.length === 0 && (
              <EmptyState text="Nessuna prenotazione futura." />
            )}

          {!loading &&
            upcomingReservations.length > 0 && (
              <div className="dashboard-v3-arrival-list">
                {upcomingReservations.map(
                  (reservation) => (
                    <article
                      key={reservation.id}
                      className="dashboard-v3-arrival"
                    >
                      <div className="dashboard-v3-arrival-time">
                        <strong>
                          {reservation.reservation_time.slice(
                            0,
                            5
                          )}
                        </strong>

                        <span>
                          {formatEuropeanDate(
                            reservation.reservation_date
                          )}
                        </span>
                      </div>

                      <div className="dashboard-v3-arrival-person">
                        <strong>
                          {reservation.customer_name}
                        </strong>

                        <span>
                          {reservation.guests}{" "}
                          {reservation.guests === 1
                            ? "persona"
                            : "persone"}
                        </span>
                      </div>

                      <span
                        className={[
                          "dashboard-v3-status",
                          `dashboard-v3-status-${reservation.status}`,
                        ].join(" ")}
                      >
                        {getStatusLabel(
                          reservation.status
                        )}
                      </span>
                    </article>
                  )
                )}
              </div>
            )}
        </section>

        <section className="dashboard-v3-card dashboard-v3-ai-card">
          <div className="dashboard-v3-ai-icon">✦</div>

          <span>ASSISTLY AI</span>

          <h3>Suggerimento operativo</h3>

          <p>
            Hai{" "}
            <strong>
              {metrics.pendingReservations}
            </strong>{" "}
            prenotazioni ancora da confermare.
          </p>

          <button
            type="button"
            onClick={() =>
              onNavigate("prenotazioni")
            }
          >
            Gestisci adesso
          </button>
        </section>
      </div>

      <div className="dashboard-v3-secondary-grid">
        <section className="dashboard-v3-card">
          <div className="dashboard-v3-card-header">
            <div>
              <span>SALA LIVE</span>
              <h3>Stato tavoli</h3>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate("mappa-tavoli")
              }
            >
              Apri mappa
            </button>
          </div>

          <div className="dashboard-v3-table-stats">
  <TableStat
    label="Tavoli attivi"
    value={metrics.activeTables}
    status="active"
  />

  <TableStat
    label="Posti sala"
    value={totalSeats}
    status="total"
  />

  <TableStat
    label="Posti residui"
    value={remainingSeats}
    status={
      remainingSeats > 0 ? "active" : "inactive"
    }
  />
</div>

{overCapacity > 0 && (
  <div className="dashboard-v3-capacity-warning">
    <strong>⚠ Capacità superata</strong>
    <span>
      Oggi risultano {metrics.todayGuests} coperti previsti
      su {totalSeats} posti configurati. Mancano{" "}
      {overCapacity} posti.
    </span>
  </div>
)}

          <div className="dashboard-v3-table-preview">
            {tables.slice(0, 6).map((table) => (
              <div key={table.id}>
                <span
                  className={
                    table.is_active
                      ? "active"
                      : "inactive"
                  }
                />

                <div>
                  <strong>
                    {table.table_name}
                  </strong>

                  <small>
                    {table.seats} posti · {table.area}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-v3-card">
          <div className="dashboard-v3-card-header">
            <div>
              <span>AZIONI RAPIDE</span>
              <h3>Cosa vuoi fare?</h3>
            </div>
          </div>

          <div className="dashboard-v3-actions">
            <QuickAction
              icon="≡"
              label="Prenotazioni"
              onClick={() =>
                onNavigate("prenotazioni")
              }
            />

            <QuickAction
              icon="□"
              label="Calendario"
              onClick={() =>
                onNavigate("calendario")
              }
            />

            <QuickAction
              icon="⌖"
              label="Mappa tavoli"
              onClick={() =>
                onNavigate("mappa-tavoli")
              }
            />

            <QuickAction
              icon="✦"
              label="Assistente AI"
              onClick={() =>
                onNavigate("assistente")
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  trend,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  trend?: string;
}) {
  return (
    <article className="dashboard-v3-kpi">
      <div className="dashboard-v3-kpi-top">
        <span className="dashboard-v3-kpi-icon">
          {icon}
        </span>

        {trend && (
          <span className="dashboard-v3-trend">
            {trend}
          </span>
        )}
      </div>

      <span className="dashboard-v3-kpi-label">
        {label}
      </span>

      <strong>{value}</strong>

      <small>{hint}</small>
    </article>
  );
}

function TableStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "active" | "inactive" | "total";
}) {
  return (
    <div className={`dashboard-v3-table-stat ${status}`}>
      <span />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="dashboard-v3-action"
      onClick={onClick}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="dashboard-v3-empty">
      {text}
    </div>
  );
}

function PlaceholderPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="dashboard-v3-placeholder">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

function getLocalDateValue(value: Date) {
  const year = value.getFullYear();

  const month = String(
    value.getMonth() + 1
  ).padStart(2, "0");

  const day = String(value.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function formatEuropeanDate(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

function getStatusLabel(
  status: ReservationStatus
) {
  const labels: Record<
    ReservationStatus,
    string
  > = {
    pending: "In attesa",
    confirmed: "Confermata",
    cancelled: "Annullata",
  };

  return labels[status];
}