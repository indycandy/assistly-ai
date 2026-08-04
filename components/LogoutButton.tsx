"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        width: "100%",
        marginTop: "20px",
        padding: "11px 14px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: "transparent",
        color: "white",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      Esci
    </button>
  );
}