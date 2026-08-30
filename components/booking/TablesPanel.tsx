"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type RestaurantTable = {
  id: string;
  company_id: string;
  table_name: string;
  seats: number;
  area: string;
  is_active: boolean;
};

type AreaKey =
  | "sala"
  | "terrazza"
  | "esterno"
  | "altro";

export default function TablesPanel() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [tables, setTables] = useState<
    RestaurantTable[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [tableName, setTableName] =
    useState("");

  const [seats, setSeats] =
    useState(2);

  const [area, setArea] =
    useState<AreaKey>("sala");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  // MODIFICA TAVOLO
  const [editingTableId, setEditingTableId] =
    useState<string | null>(null);

  const [editTableName, setEditTableName] =
    useState("");

  const [editSeats, setEditSeats] =
    useState(2);

  const [editArea, setEditArea] =
    useState<AreaKey>("sala");

  const [updatingTableId, setUpdatingTableId] =
    useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("restaurant_tables")
      .select(
        `
          id,
          company_id,
          table_name,
          seats,
          area,
          is_active
        `
      )
      .order("area", {
        ascending: true,
      })
      .order("table_name", {
        ascending: true,
      });

    if (error) {
      console.log(
        "Errore caricamento tavoli:",
        error
      );

      setErrorMessage(
        "Non è stato possibile caricare i tavoli."
      );

      setLoading(false);
      return;
    }

    setTables(
      (data ?? []) as RestaurantTable[]
    );

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const groupedTables = useMemo(() => {
    return {
      sala: tables.filter(
        (table) =>
          table.area?.toLowerCase() === "sala"
      ),

      terrazza: tables.filter(
        (table) =>
          table.area?.toLowerCase() ===
          "terrazza"
      ),

      esterno: tables.filter(
        (table) =>
          table.area?.toLowerCase() ===
          "esterno"
      ),

      altro: tables.filter((table) => {
        const tableArea =
          table.area?.toLowerCase();

        return ![
          "sala",
          "terrazza",
          "esterno",
        ].includes(tableArea);
      }),
    };
  }, [tables]);

  const activeTables = tables.filter(
    (table) => table.is_active
  ).length;

  const inactiveTables =
    tables.length - activeTables;

  const totalSeats = tables
    .filter((table) => table.is_active)
    .reduce(
      (total, table) =>
        total +
        Number(table.seats ?? 0),
      0
    );

  async function addTable() {
    const cleanName =
      tableName.trim();

    if (!cleanName) {
      setErrorMessage(
        "Inserisci il nome del tavolo."
      );
      return;
    }

    if (
      !Number.isInteger(seats) ||
      seats < 1
    ) {
      setErrorMessage(
        "Inserisci un numero di posti valido."
      );
      return;
    }

    const companyId =
      process.env
        .NEXT_PUBLIC_PILOT_COMPANY_ID;

    if (!companyId) {
      setErrorMessage(
        "Company ID non configurato."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("restaurant_tables")
      .insert({
        company_id: companyId,
        table_name: cleanName,
        seats,
        area,
        is_active: true,
      });

    if (error) {
      console.log(
        "Errore creazione tavolo:",
        error
      );

      setErrorMessage(
        "Non è stato possibile aggiungere il tavolo."
      );

      setSaving(false);
      return;
    }

    setTableName("");
    setSeats(2);
    setArea("sala");

    setSuccessMessage(
      "Tavolo aggiunto correttamente."
    );

    await loadTables();

    setSaving(false);

    window.setTimeout(
      () => setSuccessMessage(""),
      2500
    );
  }

  async function toggleTable(
    id: string,
    active: boolean
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("restaurant_tables")
      .update({
        is_active: !active,
      })
      .eq("id", id);

    if (error) {
      console.log(
        "Errore aggiornamento tavolo:",
        error
      );

      setErrorMessage(
        "Non è stato possibile aggiornare il tavolo."
      );

      return;
    }

    setSuccessMessage(
      active
        ? "Tavolo disattivato."
        : "Tavolo riattivato."
    );

    await loadTables();

    window.setTimeout(
      () => setSuccessMessage(""),
      2000
    );
  }

  function normalizeArea(
    tableArea: string
  ): AreaKey {
    const normalized =
      tableArea?.toLowerCase();

    if (normalized === "sala") {
      return "sala";
    }

    if (normalized === "terrazza") {
      return "terrazza";
    }

    if (normalized === "esterno") {
      return "esterno";
    }

    return "altro";
  }

  function startEditing(
    table: RestaurantTable
  ) {
    setEditingTableId(table.id);
    setEditTableName(table.table_name);
    setEditSeats(table.seats);
    setEditArea(
      normalizeArea(table.area)
    );

    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEditing() {
    setEditingTableId(null);
    setEditTableName("");
    setEditSeats(2);
    setEditArea("sala");
  }

  async function saveTableEdit(
    id: string
  ) {
    const cleanName =
      editTableName.trim();

    if (!cleanName) {
      setErrorMessage(
        "Inserisci il nome del tavolo."
      );
      return;
    }

    if (
      !Number.isInteger(editSeats) ||
      editSeats < 1
    ) {
      setErrorMessage(
        "Inserisci un numero di posti valido."
      );
      return;
    }

    setUpdatingTableId(id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("restaurant_tables")
      .update({
        table_name: cleanName,
        seats: editSeats,
        area: editArea,
      })
      .eq("id", id);

    if (error) {
      console.log(
        "Errore modifica tavolo:",
        error
      );

      setErrorMessage(
        "Non è stato possibile salvare le modifiche."
      );

      setUpdatingTableId(null);
      return;
    }

    setSuccessMessage(
      "Modifiche salvate correttamente."
    );

    setEditingTableId(null);
    setUpdatingTableId(null);

    await loadTables();

    window.setTimeout(
      () => setSuccessMessage(""),
      2500
    );
  }

  async function deleteTable(
    id: string,
    tableNameToDelete: string
  ) {
    const confirmed = window.confirm(
      `Eliminare "${tableNameToDelete}"?`
    );

    if (!confirmed) return;

    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("restaurant_tables")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(
        "Errore eliminazione tavolo:",
        error
      );

      setErrorMessage(
        "Non è stato possibile eliminare il tavolo."
      );

      return;
    }

    if (editingTableId === id) {
      cancelEditing();
    }

    setSuccessMessage(
      "Tavolo eliminato."
    );

    await loadTables();

    window.setTimeout(
      () => setSuccessMessage(""),
      2000
    );
  }

  function getAreaLabel(
    tableArea: string
  ) {
    const normalized =
      tableArea?.toLowerCase();

    if (normalized === "sala") {
      return "Sala";
    }

    if (normalized === "terrazza") {
      return "Terrazza";
    }

    if (normalized === "esterno") {
      return "Esterno";
    }

    if (normalized === "altro") {
      return "Altro";
    }

    return tableArea || "Altro";
  }

  function renderArea(
    title: string,
    icon: string,
    data: RestaurantTable[]
  ) {
    if (data.length === 0) {
      return null;
    }

    const areaSeats = data
      .filter(
        (table) => table.is_active
      )
      .reduce(
        (total, table) =>
          total +
          Number(table.seats ?? 0),
        0
      );

    return (
      <section className="tables-area">
        <div className="tables-area-header">
          <div>
            <div className="tables-area-title-row">
              <span className="tables-area-icon">
                {icon}
              </span>

              <h3>{title}</h3>
            </div>

            <p>
              {data.length}{" "}
              {data.length === 1
                ? "tavolo"
                : "tavoli"}{" "}
              · {areaSeats} posti attivi
            </p>
          </div>
        </div>

        <div className="tables-grid">
          {data.map((table) => {
            const isEditing =
              editingTableId === table.id;

            return (
              <article
                key={table.id}
                className={[
                  "table-card",
                  table.is_active
                    ? ""
                    : "inactive",
                  isEditing
                    ? "editing"
                    : "",
                ].join(" ")}
              >
                <div className="table-card-top">
                  <div className="table-icon">
                    ◇
                  </div>

                  <span
                    className={[
                      "table-status",
                      table.is_active
                        ? "active"
                        : "disabled",
                    ].join(" ")}
                  >
                    <i />

                    {table.is_active
                      ? "Attivo"
                      : "Disattivato"}
                  </span>
                </div>

                {isEditing ? (
                  <div className="table-edit-form">
                    <div className="edit-title">
                      <span>✏️</span>

                      <strong>
                        Modifica tavolo
                      </strong>
                    </div>

                    <div className="edit-field">
                      <label>
                        Nome tavolo
                      </label>

                      <input
                        type="text"
                        value={editTableName}
                        onChange={(e) =>
                          setEditTableName(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="edit-row">
                      <div className="edit-field">
                        <label>
                          Posti
                        </label>

                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={editSeats}
                          onChange={(e) =>
                            setEditSeats(
                              Math.max(
                                1,
                                Number(
                                  e.target
                                    .value
                                )
                              )
                            )
                          }
                        />
                      </div>

                      <div className="edit-field">
                        <label>
                          Zona
                        </label>

                        <select
                          value={editArea}
                          onChange={(e) =>
                            setEditArea(
                              e.target
                                .value as AreaKey
                            )
                          }
                        >
                          <option value="sala">
                            Sala
                          </option>

                          <option value="terrazza">
                            Terrazza
                          </option>

                          <option value="esterno">
                            Esterno
                          </option>

                          <option value="altro">
                            Altro
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="edit-actions">
                      <button
                        type="button"
                        className="cancel-edit"
                        onClick={
                          cancelEditing
                        }
                        disabled={
                          updatingTableId ===
                          table.id
                        }
                      >
                        Annulla
                      </button>

                      <button
                        type="button"
                        className="save-edit"
                        onClick={() =>
                          saveTableEdit(
                            table.id
                          )
                        }
                        disabled={
                          updatingTableId ===
                          table.id
                        }
                      >
                        {updatingTableId ===
                        table.id
                          ? "Salvataggio..."
                          : "✓ Salva modifiche"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="table-card-content">
                      <h4>
                        {table.table_name}
                      </h4>

                      <div className="table-meta">
                        <span>
                          👥 {table.seats}{" "}
                          {table.seats === 1
                            ? "posto"
                            : "posti"}
                        </span>

                        <span>
                          📍{" "}
                          {getAreaLabel(
                            table.area
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="table-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() =>
                          startEditing(
                            table
                          )
                        }
                      >
                        ✏️ Modifica
                      </button>

                      <button
                        type="button"
                        className={
                          table.is_active
                            ? "secondary"
                            : "activate"
                        }
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
                        type="button"
                        className="delete"
                        onClick={() =>
                          deleteTable(
                            table.id,
                            table.table_name
                          )
                        }
                      >
                        Elimina
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="tables-panel">
      <div className="tables-hero">
        <div>
          <span className="tables-eyebrow">
            RISTORANTE
          </span>

          <h2>Gestione tavoli</h2>

          <p>
            Organizza i tavoli del locale,
            le zone e la capienza della sala.
          </p>
        </div>

        <div className="tables-summary">
          <div>
            <strong>
              {tables.length}
            </strong>
            <span>Totali</span>
          </div>

          <div>
            <strong>
              {activeTables}
            </strong>
            <span>Attivi</span>
          </div>

          <div>
            <strong>
              {totalSeats}
            </strong>
            <span>Posti</span>
          </div>

          <div>
            <strong>
              {inactiveTables}
            </strong>
            <span>Disattivati</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="tables-message error">
          ⚠ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="tables-message success">
          ✓ {successMessage}
        </div>
      )}

      <section className="table-create-card">
        <div className="table-create-header">
          <div className="table-create-icon">
            +
          </div>

          <div>
            <span>
              NUOVO TAVOLO
            </span>

            <h3>
              Aggiungi un tavolo
            </h3>

            <p>
              Inserisci nome, numero di posti
              e zona del ristorante.
            </p>
          </div>
        </div>

        <div className="table-form">
          <div className="table-field table-field-name">
            <label>
              Nome tavolo
            </label>

            <input
              type="text"
              placeholder="Es. Tavolo 4"
              value={tableName}
              onChange={(e) =>
                setTableName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  addTable();
                }
              }}
            />
          </div>

          <div className="table-field">
            <label>
              Posti
            </label>

            <input
              type="number"
              min={1}
              max={30}
              value={seats}
              onChange={(e) =>
                setSeats(
                  Math.max(
                    1,
                    Number(
                      e.target.value
                    )
                  )
                )
              }
            />
          </div>

          <div className="table-field">
            <label>
              Zona
            </label>

            <select
              value={area}
              onChange={(e) =>
                setArea(
                  e.target
                    .value as AreaKey
                )
              }
            >
              <option value="sala">
                Sala
              </option>

              <option value="terrazza">
                Terrazza
              </option>

              <option value="esterno">
                Esterno
              </option>

              <option value="altro">
                Altro
              </option>
            </select>
          </div>

          <button
            type="button"
            className="add-table-button"
            onClick={addTable}
            disabled={saving}
          >
            <span>＋</span>

            {saving
              ? "Aggiunta..."
              : "Aggiungi tavolo"}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="tables-loading">
          <div className="tables-spinner" />

          <span>
            Caricamento tavoli...
          </span>
        </div>
      ) : tables.length === 0 ? (
        <div className="tables-empty">
          <div>◇</div>

          <h3>
            Nessun tavolo configurato
          </h3>

          <p>
            Aggiungi il primo tavolo
            utilizzando il modulo qui sopra.
          </p>
        </div>
      ) : (
        <div className="tables-areas">
          {renderArea(
            "Sala",
            "▦",
            groupedTables.sala
          )}

          {renderArea(
            "Terrazza",
            "☀",
            groupedTables.terrazza
          )}

          {renderArea(
            "Esterno",
            "◎",
            groupedTables.esterno
          )}

          {renderArea(
            "Altro",
            "◇",
            groupedTables.altro
          )}
        </div>
      )}

      <style>{`
        .tables-panel {
          width: 100%;
          display: grid;
          gap: 22px;
        }

        .tables-hero {
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

        .tables-eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #7c3aed;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .tables-hero h2 {
          margin: 0;
          color: #111827;
          font-size: 30px;
          line-height: 1.1;
        }

        .tables-hero p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .tables-summary {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(80px, 1fr));
          gap: 9px;
        }

        .tables-summary > div {
          min-width: 90px;
          padding: 13px 16px;
          text-align: center;
          border-radius: 14px;
          background: #f7f8fb;
          border: 1px solid #edf0f4;
        }

        .tables-summary strong,
        .tables-summary span {
          display: block;
        }

        .tables-summary strong {
          color: #111827;
          font-size: 21px;
        }

        .tables-summary span {
          margin-top: 3px;
          color: #7b8aa0;
          font-size: 10px;
          font-weight: 700;
        }

        .tables-message {
          padding: 13px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .tables-message.error {
          color: #b91c1c;
          border: 1px solid #fecaca;
          background: #fef2f2;
        }

        .tables-message.success {
          color: #15803d;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
        }

        .table-create-card {
          padding: 24px;
          border: 1px solid #e6eaf0;
          border-radius: 20px;
          background: #ffffff;
          box-shadow:
            0 8px 30px
            rgba(15, 23, 42, 0.035);
        }

        .table-create-header {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 22px;
        }

        .table-create-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 12px;
          color: #ffffff;
          font-size: 24px;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #d946ef
            );
        }

        .table-create-header span {
          display: block;
          margin-bottom: 3px;
          color: #7c3aed;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.4px;
        }

        .table-create-header h3 {
          margin: 0;
          color: #111827;
          font-size: 18px;
        }

        .table-create-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .table-form {
          display: grid;
          grid-template-columns:
            minmax(240px, 2fr)
            minmax(110px, 0.6fr)
            minmax(150px, 0.8fr)
            auto;
          gap: 14px;
          align-items: end;
        }

        .table-field {
          display: grid;
          gap: 7px;
        }

        .table-field label,
        .edit-field label {
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .table-field input,
        .table-field select,
        .edit-field input,
        .edit-field select {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          box-sizing: border-box;
          outline: none;
          border: 1px solid #dce2ea;
          border-radius: 11px;
          background: #ffffff;
          color: #111827;
          font-size: 14px;
          transition:
            border 0.18s ease,
            box-shadow 0.18s ease;
        }

        .table-field input:focus,
        .table-field select:focus,
        .edit-field input:focus,
        .edit-field select:focus {
          border-color: #9f67f6;
          box-shadow:
            0 0 0 3px
            rgba(124, 58, 237, 0.09);
        }

        .table-field input::placeholder {
          color: #b1bac7;
        }

        .add-table-button {
          height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 20px;
          white-space: nowrap;
          border: 0;
          border-radius: 11px;
          color: #ffffff;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #d946ef
            );
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow:
            0 8px 20px
            rgba(124, 58, 237, 0.18);
        }

        .add-table-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .add-table-button span {
          font-size: 17px;
        }

        .tables-areas {
          display: grid;
          gap: 24px;
        }

        .tables-area {
          padding: 24px;
          border: 1px solid #e6eaf0;
          border-radius: 20px;
          background: #ffffff;
          box-shadow:
            0 8px 30px
            rgba(15, 23, 42, 0.03);
        }

        .tables-area-header {
          margin-bottom: 17px;
        }

        .tables-area-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .tables-area-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #7c3aed;
          background: #f2edff;
          font-size: 15px;
          font-weight: 800;
        }

        .tables-area h3 {
          margin: 0;
          color: #172033;
          font-size: 18px;
        }

        .tables-area-header p {
          margin: 5px 0 0 39px;
          color: #94a3b8;
          font-size: 11px;
        }

        .tables-grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(220px, 1fr)
            );
          gap: 13px;
        }

        .table-card {
          display: flex;
          flex-direction: column;
          min-height: 165px;
          padding: 17px;
          box-sizing: border-box;
          border: 1px solid #e7ebf1;
          border-radius: 15px;
          background: #f9fafc;
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            border 0.16s ease;
        }

        .table-card:hover {
          transform: translateY(-2px);
          border-color: #ddd4fc;
          box-shadow:
            0 9px 22px
            rgba(15, 23, 42, 0.07);
        }

        .table-card.inactive {
          opacity: 0.66;
          background: #f5f6f8;
        }

        .table-card.editing {
          opacity: 1;
          border-color: #c4b5fd;
          background: #fbfaff;
          box-shadow:
            0 0 0 3px
            rgba(124, 58, 237, 0.06);
        }

        .table-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .table-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #7c3aed;
          background: #eee8ff;
          font-size: 19px;
        }

        .table-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .table-status i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .table-status.active {
          color: #15803d;
          background: #ecfdf3;
        }

        .table-status.active i {
          background: #22c55e;
        }

        .table-status.disabled {
          color: #64748b;
          background: #eef1f5;
        }

        .table-status.disabled i {
          background: #94a3b8;
        }

        .table-card-content {
          flex: 1;
          padding: 14px 0;
        }

        .table-card-content h4 {
          margin: 0 0 9px;
          color: #111827;
          font-size: 17px;
        }

        .table-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .table-meta span {
          padding: 5px 8px;
          border: 1px solid #e8ebf0;
          border-radius: 8px;
          background: #ffffff;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
        }

        .table-actions {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 7px;
          padding-top: 12px;
          border-top: 1px solid #e8ebf0;
        }

        .table-actions button {
          height: 34px;
          padding: 0 8px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .table-actions .edit {
          color: #6d28d9;
          border: 1px solid #ddd6fe;
          background: #f5f3ff;
        }

        .table-actions .edit:hover {
          background: #ede9fe;
        }

        .table-actions .secondary {
          color: #475569;
          border: 1px solid #dce2e9;
          background: #ffffff;
        }

        .table-actions .activate {
          color: #15803d;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
        }

        .table-actions .delete {
          color: #dc2626;
          border: 1px solid #fecaca;
          background: #fff7f7;
        }

        .table-edit-form {
          display: grid;
          gap: 12px;
          padding-top: 15px;
        }

        .edit-title {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #4c1d95;
          font-size: 13px;
        }

        .edit-field {
          display: grid;
          gap: 6px;
        }

        .edit-row {
          display: grid;
          grid-template-columns:
            0.65fr 1fr;
          gap: 10px;
        }

        .edit-field input,
        .edit-field select {
          height: 40px;
          font-size: 12px;
        }

        .edit-actions {
          display: grid;
          grid-template-columns:
            1fr 1.4fr;
          gap: 8px;
          padding-top: 4px;
        }

        .edit-actions button {
          height: 38px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .cancel-edit {
          color: #475569;
          border: 1px solid #dce2e9;
          background: #ffffff;
        }

        .save-edit {
          color: #ffffff;
          border: 0;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #a855f7
            );
        }

        .edit-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tables-loading,
        .tables-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-height: 220px;
          padding: 30px;
          box-sizing: border-box;
          border: 1px solid #e6eaf0;
          border-radius: 20px;
          background: #ffffff;
          color: #64748b;
        }

        .tables-loading {
          gap: 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .tables-spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #eee9ff;
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation:
            tablesSpin 0.8s linear infinite;
        }

        @keyframes tablesSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .tables-empty > div {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          border-radius: 14px;
          color: #7c3aed;
          background: #f2edff;
          font-size: 24px;
        }

        .tables-empty h3 {
          margin: 0;
          color: #172033;
          font-size: 17px;
        }

        .tables-empty p {
          margin: 7px 0 0;
          max-width: 320px;
          text-align: center;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 1150px) {
          .tables-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .tables-summary {
            width: 100%;
          }

          .table-form {
            grid-template-columns:
              1fr 1fr;
          }

          .table-field-name {
            grid-column:
              1 / -1;
          }

          .add-table-button {
            width: 100%;
          }

          .tables-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(220px, 1fr)
              );
          }
        }

        @media (max-width: 700px) {
          .tables-hero,
          .table-create-card,
          .tables-area {
            padding: 18px;
            border-radius: 16px;
          }

          .tables-hero h2 {
            font-size: 25px;
          }

          .tables-summary {
            grid-template-columns:
              1fr 1fr;
          }

          .table-form {
            grid-template-columns:
              1fr;
          }

          .table-field-name {
            grid-column: auto;
          }

          .tables-grid {
            grid-template-columns:
              1fr;
          }

          .table-actions {
            grid-template-columns: 1fr;
          }

          .edit-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}