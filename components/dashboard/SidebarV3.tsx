"use client";

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

type SidebarItem = {
  id: DashboardPage;
  label: string;
  icon: string;
  badge?: number;
};

const mainItems: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "prenotazioni", label: "Prenotazioni", icon: "≡", badge: 2 },
  { id: "calendario", label: "Calendario", icon: "□" },
  { id: "mappa-tavoli", label: "Mappa tavoli", icon: "⌖" },
  { id: "tavoli", label: "Tavoli", icon: "⌑" },
];

const businessItems: SidebarItem[] = [
  { id: "prodotti", label: "Prodotti", icon: "◇" },
  { id: "faq", label: "FAQ", icon: "?" },
  { id: "assistente", label: "Assistente AI", icon: "✦" },
];

const settingsItems: SidebarItem[] = [
  { id: "impostazioni", label: "Impostazioni", icon: "⚙" },
];

export default function SidebarV3({
  page,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  page: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  function selectPage(selectedPage: DashboardPage) {
    onNavigate(selectedPage);
    onCloseMobile();
  }

  return (
    <>
      <aside
        className={[
          "sidebar-v3",
          collapsed ? "collapsed" : "",
          mobileOpen ? "mobile-open" : "",
        ].join(" ")}
      >
        <div className="sidebar-v3-top">
          <div className="sidebar-v3-brand">
            <div className="sidebar-v3-logo">A</div>

            {!collapsed && (
              <div>
                <strong>
                  Assistly <span>AI</span>
                </strong>
                <small>Indy Candy Shop</small>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-v3-collapse"
            onClick={onToggleCollapsed}
            aria-label={
              collapsed ? "Espandi menu" : "Comprimi menu"
            }
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="sidebar-v3-nav">
          <SidebarSection
            title="Principale"
            items={mainItems}
            page={page}
            collapsed={collapsed}
            onSelect={selectPage}
          />

          <SidebarSection
            title="Business"
            items={businessItems}
            page={page}
            collapsed={collapsed}
            onSelect={selectPage}
          />

          <SidebarSection
            title="Sistema"
            items={settingsItems}
            page={page}
            collapsed={collapsed}
            onSelect={selectPage}
          />
        </nav>

        <div className="sidebar-v3-footer">
          <div className="sidebar-v3-status">
            <span className="sidebar-v3-status-dot" />

            {!collapsed && (
              <div>
                <strong>Assistente operativo</strong>
                <small>Online</small>
              </div>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-v3-overlay"
          aria-label="Chiudi menu"
          onClick={onCloseMobile}
        />
      )}
    </>
  );
}

function SidebarSection({
  title,
  items,
  page,
  collapsed,
  onSelect,
}: {
  title: string;
  items: SidebarItem[];
  page: DashboardPage;
  collapsed: boolean;
  onSelect: (page: DashboardPage) => void;
}) {
  return (
    <div className="sidebar-v3-section">
      {!collapsed && (
        <span className="sidebar-v3-section-title">{title}</span>
      )}

      <div className="sidebar-v3-items">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={[
              "sidebar-v3-item",
              page === item.id ? "active" : "",
            ].join(" ")}
            onClick={() => onSelect(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-v3-icon">{item.icon}</span>

            {!collapsed && (
              <>
                <span className="sidebar-v3-label">
                  {item.label}
                </span>

                {item.badge ? (
                  <span className="sidebar-v3-badge">
                    {item.badge}
                  </span>
                ) : null}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}