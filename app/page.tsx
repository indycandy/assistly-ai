import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardV2 from "@/components/DashboardV2";

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  return <DashboardV2 />;
}