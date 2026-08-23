"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type TableStatus = "free" | "reserved" | "occupied" | "inactive";
type TableShape = "round" | "square" | "rectangular";

type RestaurantTable = {
  id: string;
  table_name: string;
  seats: number;
  area: string;
  is_active: boolean;
  position_x: number | null;
  position_y: number | null;
  table_shape: TableShape | null;
  table_rotation: number | null;
};

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  table_id: string | null;
  seated_at: string | null;
  completed_at: string | null;
};
type TableView = RestaurantTable & {
  tableStatus: TableStatus;
  reservation: Reservation | null;
};

type Position = {
  x: number;
  y: number;
};

type DragState = {
  tableId: string;
  area: string;
  pointerStartX: number;
  pointerStartY: number;
  tableStartX: number;
  tableStartY: number;
};

const TABLE_WIDTH = 164;
const TABLE_HEIGHT = 170;
const CANVAS_PADDING = 20;

export default function TableMapPanel() {
  const [selectedDate, setSelectedDate] = useState(
    getLocalDateValue(new Date())
  );

  const [selectedTime, setSelectedTime] = useState("20:30");

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [positions, setPositions] = useState<Record<string, Position>>(
    {}
  );

  const [selectedTableId, setSelectedTableId] = useState<
    string | null
  >(null);

  const [draggingTableId, setDraggingTableId] = useState<
    string | null
  >(null);

  const [savingTableId, setSavingTableId] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const dragStateRef = useRef<DragState | null>(null);

  const areaRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadMapData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const [tablesResult, reservationsResult] =
  await Promise.all([
        supabase
          .from("restaurant_tables")
          .select(
            `
              id,
              table_name,
              seats,
              area,
              is_active,
              position_x,
              position_y,
              table_shape,
              table_rotation
            `
          )
          .order("area", { ascending: true })
          .order("table_name", { ascending: true }),

        supabase
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
table_id,
 seated_at,
    completed_at
            `
          )
          .eq("reservation_date", selectedDate)
          .neq("status", "cancelled")
          .order("reservation_time", { ascending: true }),

      ]);

    if (
      tablesResult.error ||
      reservationsResult.error
    ) {
      console.error({
        tablesError: tablesResult.error,
        reservationsError: reservationsResult.error,
      });

      setErrorMessage(
        "Non è stato possibile caricare completamente la mappa."
      );
    }

    const loadedTables =
      (tablesResult.data ?? []) as RestaurantTable[];

    setTables(loadedTables);

    setReservations(
      (reservationsResult.data ?? []) as Reservation[]
    );

    setPositions(createInitialPositions(loadedTables));

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;

      if (!dragState) return;

      const areaElement = areaRefs.current[dragState.area];

      if (!areaElement) return;

      const bounds = areaElement.getBoundingClientRect();

      const deltaX = event.clientX - dragState.pointerStartX;
      const deltaY = event.clientY - dragState.pointerStartY;

      const maximumX = Math.max(
        CANVAS_PADDING,
        bounds.width - TABLE_WIDTH - CANVAS_PADDING
      );

      const maximumY = Math.max(
        CANVAS_PADDING,
        bounds.height - TABLE_HEIGHT - CANVAS_PADDING
      );

      const nextX = clamp(
        dragState.tableStartX + deltaX,
        CANVAS_PADDING,
        maximumX
      );

      const nextY = clamp(
        dragState.tableStartY + deltaY,
        CANVAS_PADDING,
        maximumY
      );

      setPositions((current) => ({
        ...current,
        [dragState.tableId]: {
          x: Math.round(nextX),
          y: Math.round(nextY),
        },
      }));
    }

    async function handlePointerUp() {
      const dragState = dragStateRef.current;

      if (!dragState) return;

      dragStateRef.current = null;
      setDraggingTableId(null);

      const position = positions[dragState.tableId];

      if (!position) return;

      await saveTablePosition(dragState.tableId, position);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [positions]);

  async function saveTablePosition(
    tableId: string,
    position: Position
  ) {
    setSavingTableId(tableId);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("restaurant_tables")
      .update({
        position_x: position.x,
        position_y: position.y,
      })
      .eq("id", tableId);

    if (error) {
      console.error("Errore salvataggio posizione:", error);

      setErrorMessage(
        "Non è stato possibile salvare la posizione del tavolo."
      );
    } else {
      setTables((current) =>
        current.map((table) =>
          table.id === tableId
            ? {
                ...table,
                position_x: position.x,
                position_y: position.y,
              }
            : table
        )
      );

      setSuccessMessage("Posizione del tavolo salvata.");

      window.setTimeout(() => {
        setSuccessMessage("");
      }, 1800);
    }

    setSavingTableId(null);
  }

  function startDragging(
    event: ReactPointerEvent<HTMLButtonElement>,
    table: TableView
  ) {
    if (!editMode) {
      setSelectedTableId(table.id);
      return;
    }

    if (!table.is_active) return;

    event.preventDefault();

    const position = positions[table.id] ?? {
      x: CANVAS_PADDING,
      y: CANVAS_PADDING,
    };

    dragStateRef.current = {
      tableId: table.id,
      area: normalizeArea(table.area),
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      tableStartX: position.x,
      tableStartY: position.y,
    };

    setSelectedTableId(table.id);
    setDraggingTableId(table.id);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  async function changeTableShape(
    tableId: string,
    tableShape: TableShape
  ) {
    setSavingTableId(tableId);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("restaurant_tables")
      .update({ table_shape: tableShape })
      .eq("id", tableId);

    if (error) {
      console.error("Errore modifica forma:", error);

      setErrorMessage(
        "Non è stato possibile aggiornare la forma del tavolo."
      );

      setSavingTableId(null);
      return;
    }

    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? { ...table, table_shape: tableShape }
          : table
      )
    );

    setSavingTableId(null);
  }

  async function rotateTable(table: TableView) {
    const currentRotation = Number(table.table_rotation ?? 0);
    const nextRotation = (currentRotation + 90) % 360;

    setSavingTableId(table.id);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("restaurant_tables")
      .update({ table_rotation: nextRotation })
      .eq("id", table.id);

    if (error) {
      console.error("Errore rotazione tavolo:", error);

      setErrorMessage(
        "Non è stato possibile ruotare il tavolo."
      );

      setSavingTableId(null);
      return;
    }

    setTables((current) =>
      current.map((item) =>
        item.id === table.id
          ? { ...item, table_rotation: nextRotation }
          : item
      )
    );

    setSavingTableId(null);
  }
  async function updateTableServiceState(
  reservationId: string,
  action: "seat" | "complete"
) {
  setErrorMessage("");
  setSuccessMessage("");

  const supabase = createClient();
  const now = new Date().toISOString();

  const updatePayload =
    action === "seat"
      ? {
          seated_at: now,
          completed_at: null,
        }
      : {
          completed_at: now,
        };

  const { data, error } = await supabase
    .from("reservation")
    .update(updatePayload)
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
        table_id,
        seated_at,
        completed_at
      `
    )
    .single();

  if (error || !data) {
    console.error(
      "Errore aggiornamento stato tavolo:",
      error
    );

    setErrorMessage(
      action === "seat"
        ? "Non è stato possibile segnare il cliente come arrivato."
        : "Non è stato possibile liberare il tavolo."
    );

    return;
  }

  setReservations((current) =>
    current.map((reservation) =>
      reservation.id === reservationId
        ? (data as Reservation)
        : reservation
    )
  );

  setSuccessMessage(
    action === "seat"
      ? "Cliente arrivato. Tavolo occupato."
      : "Servizio completato. Tavolo liberato."
  );

  window.setTimeout(() => {
    setSuccessMessage("");
  }, 1800);
}

  const tableViews = useMemo<TableView[]>(() => {
  return tables.map((table) => {
    if (!table.is_active) {
      return {
        ...table,
        tableStatus: "inactive",
        reservation: null,
      };
    }

    const reservation =
      reservations.find(
        (item) =>
          item.table_id === table.id &&
          normalizeTime(item.reservation_time) ===
            selectedTime &&
          !item.completed_at
      ) ?? null;

    if (!reservation) {
      return {
        ...table,
        tableStatus: "free",
        reservation: null,
      };
    }

    return {
      ...table,
      tableStatus: reservation.seated_at
        ? "occupied"
        : "reserved",
      reservation,
    };
  });
}, [tables, reservations, selectedTime]);

  const groupedTables = useMemo(() => {
    const groups = new Map<string, TableView[]>();

    tableViews.forEach((table) => {
      const areaName = normalizeArea(table.area);
      const current = groups.get(areaName) ?? [];

      groups.set(areaName, [...current, table]);
    });

    return Array.from(groups.entries());
  }, [tableViews]);

  const selectedTable =
    tableViews.find((table) => table.id === selectedTableId) ??
    null;

  const metrics = useMemo(() => {
    return {
      total: tableViews.length,

      free: tableViews.filter(
        (table) => table.tableStatus === "free"
      ).length,

      reserved: tableViews.filter(
        (table) => table.tableStatus === "reserved"
      ).length,

      occupied: tableViews.filter(
        (table) => table.tableStatus === "occupied"
      ).length,

      inactive: tableViews.filter(
        (table) => table.tableStatus === "inactive"
      ).length,
    };
  }, [tableViews]);

  return (
    <section className="table-map-panel">
      <div className="table-map-header">
        <div>
          <span className="table-map-eyebrow">
            SALA IN TEMPO REALE
          </span>

          <h2>Mappa tavoli</h2>

          <p>
            Visualizza e organizza graficamente i tavoli del
            ristorante.
          </p>
        </div>

        <div className="table-map-header-actions">
          <button
            type="button"
            className={
              editMode
                ? "table-map-edit active"
                : "table-map-edit"
            }
            onClick={() => setEditMode((current) => !current)}
          >
            {editMode ? "Termina modifica" : "Modifica mappa"}
          </button>

          <button
            type="button"
            className="table-map-refresh"
            onClick={loadMapData}
            disabled={loading}
          >
            {loading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>
      </div>

      <div className="table-map-toolbar">
        <label>
          Data
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setSelectedTableId(null);
            }}
          />
        </label>

        <label>
          Orario
          <select
            value={selectedTime}
            onChange={(event) => {
              setSelectedTime(event.target.value);
              setSelectedTableId(null);
            }}
          >
            {[
              "19:00",
              "19:30",
              "20:00",
              "20:30",
              "21:00",
              "21:30",
              "22:00",
              "22:30",
              "23:00",
            ].map((time) => (
              <option value={time} key={time}>
                {time}
              </option>
            ))}
          </select>
        </label>

        <div className="table-map-legend">
          <LegendItem status="free" label="Libero" />
          <LegendItem status="reserved" label="Prenotato" />
          <LegendItem status="occupied" label="Occupato" />
          <LegendItem status="inactive" label="Fuori servizio" />
        </div>
      </div>

      {editMode && (
        <div className="table-map-edit-notice">
          Trascina i tavoli nella posizione desiderata. La posizione
          viene salvata automaticamente quando rilasci il mouse.
        </div>
      )}

      {errorMessage && (
        <div className="table-map-error">{errorMessage}</div>
      )}

      {successMessage && (
        <div className="table-map-success">
          {successMessage}
        </div>
      )}

      <div className="table-map-layout">
        <div className="table-map-floor">
          {loading && (
            <div className="table-map-loading">
              Caricamento della sala...
            </div>
          )}

          {!loading && groupedTables.length === 0 && (
            <div className="table-map-loading">
              Nessun tavolo configurato.
            </div>
          )}

          {!loading &&
            groupedTables.map(([area, areaTables]) => (
              <div
                className={[
                  "table-map-area",
                  editMode ? "editing" : "",
                ].join(" ")}
                key={area}
              >
                <div className="table-map-area-heading">
                  {formatAreaName(area)}
                </div>

                <div
                  className="table-map-area-canvas"
                  ref={(element) => {
                    areaRefs.current[area] = element;
                  }}
                >
                  {areaTables.map((table) => {
                    const position = positions[table.id] ?? {
                      x: CANVAS_PADDING,
                      y: CANVAS_PADDING,
                    };

                    return (
                      <RestaurantTableGraphic
                        key={table.id}
                        table={table}
                        position={position}
                        selected={selectedTableId === table.id}
                        dragging={draggingTableId === table.id}
                        saving={savingTableId === table.id}
                        editMode={editMode}
                        onPointerDown={(event) =>
                          startDragging(event, table)
                        }
                        onClick={() =>
                          !editMode &&
                          setSelectedTableId(table.id)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        <aside className="table-map-details">
          {!selectedTable && (
            <div className="table-map-details-empty">
              <span>🪑</span>
              <strong>Seleziona un tavolo</strong>
              <p>
                Clicca su un tavolo per visualizzare i dettagli.
              </p>
            </div>
          )}

          {selectedTable && (
            <>
              <div className="table-map-details-heading">
                <div>
                  <span>
                    {formatAreaName(selectedTable.area)}
                  </span>

                  <h3>{selectedTable.table_name}</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTableId(null)}
                >
                  ×
                </button>
              </div>

              <div
                className={`table-map-detail-status status-${selectedTable.tableStatus}`}
              >
                {getStatusLabel(selectedTable.tableStatus)}
              </div>

              <div className="table-map-detail-card">
                <span>Capienza</span>
                <strong>{selectedTable.seats} posti</strong>
              </div>

              <div className="table-map-detail-card">
                <span>Orario visualizzato</span>
                <strong>{selectedTime}</strong>
              </div>

              {editMode && (
                <div className="table-map-editor">
                  <h4>Personalizza tavolo</h4>

                  <label>
                    Forma
                    <select
                      value={
                        selectedTable.table_shape ??
                        getAutomaticShape(selectedTable.seats)
                      }
                      onChange={(event) =>
                        changeTableShape(
                          selectedTable.id,
                          event.target.value as TableShape
                        )
                      }
                      disabled={savingTableId === selectedTable.id}
                    >
                      <option value="round">Rotondo</option>
                      <option value="square">Quadrato</option>
                      <option value="rectangular">
                        Rettangolare
                      </option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => rotateTable(selectedTable)}
                    disabled={savingTableId === selectedTable.id}
                  >
                    Ruota di 90°
                  </button>
                </div>
              )}

              {selectedTable.reservation ? (
                <div className="table-map-reservation">
                  <h4>Prenotazione</h4>

                  <div>
                    <span>Cliente</span>
                    <strong>
                      {selectedTable.reservation.customer_name}
                    </strong>
                  </div>

                  <div>
                    <span>Persone</span>
                    <strong>
                      {selectedTable.reservation.guests}
                    </strong>
                  </div>

                  <div>
                    <span>Telefono</span>
                    <strong>
                      {selectedTable.reservation.customer_phone ??
                        "Non disponibile"}
                    </strong>
                  </div>

                  {selectedTable.reservation.notes && (
                    <div>
                      <span>Note</span>
                      <strong>
                        {selectedTable.reservation.notes}
                      </strong>
                    </div>
                  )}
                  <div className="table-map-reservation-actions">
  {!selectedTable.reservation.seated_at && (
    <button
      type="button"
      onClick={() =>
        updateTableServiceState(
          selectedTable.reservation!.id,
          "seat"
        )
      }
    >
      Cliente arrivato
    </button>
  )}

  {selectedTable.reservation.seated_at &&
    !selectedTable.reservation.completed_at && (
      <button
        type="button"
        className="complete"
        onClick={() =>
          updateTableServiceState(
            selectedTable.reservation!.id,
            "complete"
          )
        }
      >
        Libera tavolo
      </button>
    )}
</div>
<div className="table-map-timeline">
  <h4>Timeline servizio</h4>

  <div className="table-map-timeline-item">
    <span className="dot active" />

    <div>
      <small>Prenotazione</small>
      <strong>
        {normalizeTime(
          selectedTable.reservation.reservation_time
        )}
      </strong>
    </div>
  </div>

  <div className="table-map-timeline-item">
    <span
      className={[
        "dot",
        selectedTable.reservation.seated_at
          ? "active"
          : "",
      ].join(" ")}
    />

    <div>
      <small>Cliente arrivato</small>
      <strong>
        {selectedTable.reservation.seated_at
          ? formatDateTime(
              selectedTable.reservation.seated_at
            )
          : "In attesa"}
      </strong>
    </div>
  </div>

  <div className="table-map-timeline-item">
    <span
      className={[
        "dot",
        selectedTable.reservation.completed_at
          ? "active"
          : "",
      ].join(" ")}
    />

    <div>
      <small>Tavolo liberato</small>
      <strong>
        {selectedTable.reservation.completed_at
          ? formatDateTime(
              selectedTable.reservation.completed_at
            )
          : "Non ancora"}
      </strong>
    </div>
  </div>
</div>
                </div>
                
              ) : (
                
                <div className="table-map-free-message">
                  Il tavolo è disponibile nell’orario selezionato.
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <div className="table-map-metrics">
        <Metric label="Tavoli totali" value={metrics.total} />

        <Metric
          label="Liberi"
          value={metrics.free}
          status="free"
        />

        <Metric
          label="Prenotati"
          value={metrics.reserved}
          status="reserved"
        />

        <Metric
          label="Occupati"
          value={metrics.occupied}
          status="occupied"
        />

        <Metric
          label="Fuori servizio"
          value={metrics.inactive}
          status="inactive"
        />
      </div>
    </section>
  );
}

function RestaurantTableGraphic({
  table,
  position,
  selected,
  dragging,
  saving,
  editMode,
  onPointerDown,
  onClick,
}: {
  table: TableView;
  position: Position;
  selected: boolean;
  dragging: boolean;
  saving: boolean;
  editMode: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onClick: () => void;
}) {
  const visibleSeats = Math.min(Math.max(table.seats, 2), 8);

  const shape =
    table.table_shape ?? getAutomaticShape(table.seats);

  return (
    <button
      type="button"
      className={[
        "restaurant-table-graphic",
        "draggable-table",
        `table-${table.tableStatus}`,
        selected ? "selected" : "",
        dragging ? "dragging" : "",
        editMode ? "edit-mode" : "",
      ].join(" ")}
      style={{
        left: position.x,
        top: position.y,
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div
        className="restaurant-table-stage"
        style={{
          transform: `rotate(${Number(
            table.table_rotation ?? 0
          )}deg)`,
        }}
      >
        {Array.from({ length: visibleSeats }).map((_, index) => (
          <span
            className={`restaurant-chair chair-${index + 1}`}
            key={index}
          />
        ))}

        <div
          className={[
            "restaurant-table-shape",
            shape,
          ].join(" ")}
        >
          <strong>{getShortTableName(table.table_name)}</strong>
          <small>{table.seats} posti</small>
        </div>
      </div>

      <span className="restaurant-table-status-label">
        {saving
          ? "Salvataggio..."
          : getStatusLabel(table.tableStatus)}
      </span>
    </button>
  );
}

function LegendItem({
  status,
  label,
}: {
  status: TableStatus;
  label: string;
}) {
  return (
    <span>
      <i className={`legend-dot ${status}`} />
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status?: TableStatus;
}) {
  return (
    <div className={status ? `metric-${status}` : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function createInitialPositions(
  tables: RestaurantTable[]
): Record<string, Position> {
  const result: Record<string, Position> = {};

  const areaCounters = new Map<string, number>();
  const usedCoordinates = new Set<string>();

  tables.forEach((table) => {
    const area = normalizeArea(table.area);
    const areaIndex = areaCounters.get(area) ?? 0;

    const storedX = Number(table.position_x ?? 40);
    const storedY = Number(table.position_y ?? 40);
    const coordinateKey = `${area}-${storedX}-${storedY}`;

    const hasUniqueSavedPosition =
      storedX !== 40 ||
      storedY !== 40 ||
      !usedCoordinates.has(coordinateKey);

    if (hasUniqueSavedPosition) {
      result[table.id] = {
        x: storedX,
        y: storedY,
      };
    } else {
      const column = areaIndex % 4;
      const row = Math.floor(areaIndex / 4);

      result[table.id] = {
        x: CANVAS_PADDING + column * 190,
        y: CANVAS_PADDING + row * 190,
      };
    }

    usedCoordinates.add(
      `${area}-${result[table.id].x}-${result[table.id].y}`
    );

    areaCounters.set(area, areaIndex + 1);
  });

  return result;
}

function getAutomaticShape(seats: number): TableShape {
  if (seats <= 2) return "round";
  if (seats <= 4) return "square";

  return "rectangular";
}

function normalizeArea(area: string) {
  return area?.trim().toLowerCase() || "altro";
}

function normalizeTime(value: string) {
  return value?.slice(0, 5) || "";
}

function getLocalDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusLabel(status: TableStatus) {
  const labels: Record<TableStatus, string> = {
    free: "Libero",
    reserved: "Prenotato",
    occupied: "Occupato",
    inactive: "Fuori servizio",
  };

  return labels[status];
}

function formatAreaName(area: string) {
  const normalized = normalizeArea(area);

  return (
    normalized.charAt(0).toUpperCase() + normalized.slice(1)
  );
}

function getShortTableName(name: string) {
  const number = name.match(/\d+/)?.[0];

  return number ?? name.slice(0, 3).toUpperCase();
}
function formatDateTime(value: string) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}