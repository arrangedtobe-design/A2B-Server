import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SeatingChart from "./seating-chart";

export default async function SeatingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <SeatingChart userId={user.id} />;
}
