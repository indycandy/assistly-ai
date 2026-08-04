"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RestaurantTable = {
  id: string;
  company_id: string;
  table_name: string;
  seats: number;
  area: string;
  is_active: boolean;
};

export default function TablesPanel() {
  const supabase = createClient();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  const [tableName, setTableName] = useState("");
  const [seats, setSeats] = useState(2);
  const [area, setArea] = useState("sala");

  const loadTables = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("*")
      .order("area")
      .order("table_name");

    if (!error) {
      setTables((data ?? []) as RestaurantTable[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const groupedTables = useMemo(() => {
    return {
      sala: tables.filter((t) => t.area === "sala"),
      terrazza: tables.filter((t) => t.area === "terrazza"),
      altro: tables.filter(
        (t) => t.area !== "sala" && t.area !== "terrazza"
      ),
    };
  }, [tables]);

  async function addTable() {
    if (!tableName.trim()) {
      alert("Inserisci il nome del tavolo");
      return;
    }

    const companyId =
      process.env.NEXT_PUBLIC_PILOT_COMPANY_ID;

    const { error } = await supabase
      .from("restaurant_tables")
      .insert({
        company_id: companyId,
        table_name: tableName,
        seats,
        area,
        is_active: true,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setTableName("");
    setSeats(2);
    setArea("sala");

    loadTables();
  }

  async function toggleTable(id: string, active: boolean) {
    await supabase
      .from("restaurant_tables")
      .update({
        is_active: !active,
      })
      .eq("id", id);

    loadTables();
  }

  async function deleteTable(id: string) {
    if (!confirm("Eliminare questo tavolo?")) return;

    await supabase
      .from("restaurant_tables")
      .delete()
      .eq("id", id);

    loadTables();
  }

  function renderArea(title: string, data: RestaurantTable[]) {
    if (data.length === 0) return null;

    return (
      <>
        <h3 className="tables-area-title">{title}</h3>

        <div className="tables-grid">
          {data.map((table) => (
            <div
              key={table.id}
              className={
                table.is_active
                  ? "table-card"
                  : "table-card inactive"
              }
            >
              <div className="table-card-header">
                <strong>{table.table_name}</strong>

                <span>
                  {table.seats} posti
                </span>
              </div>

              <div className="table-actions">
                <button
                  onClick={() =>
                    toggleTable(
                      table.id,
                      table.is_active
                    )
                  }
                >
                  {table.is_active
                    ? "Disattiva"
                    : "Attiva"}
                </button>

                <button
                  className="delete"
                  onClick={() =>
                    deleteTable(table.id)
                  }
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <section className="tables-panel">

      <div className="panel-header">
        <div>
          <span>RISTORANTE</span>
          <h2>Tavoli</h2>
          <p>
            Gestisci tutti i tavoli del locale.
          </p>
        </div>
      </div>

      <div className="table-form">

        <input
          placeholder="Nome tavolo"
          value={tableName}
          onChange={(e) =>
            setTableName(e.target.value)
          }
        />

        <input
          type="number"
          value={seats}
          onChange={(e) =>
            setSeats(Number(e.target.value))
          }
        />

        <select
          value={area}
          onChange={(e) =>
            setArea(e.target.value)
          }
        >
          <option value="sala">Sala</option>
          <option value="terrazza">
            Terrazza
          </option>
        </select>

        <button onClick={addTable}>
          Aggiungi tavolo
        </button>

      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          {renderArea(
            "Sala",
            groupedTables.sala
          )}

          {renderArea(
            "Terrazza",
            groupedTables.terrazza
          )}

          {renderArea(
            "Altro",
            groupedTables.altro
          )}
        </>
      )}
    </section>
  );
}