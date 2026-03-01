import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BudgetTracker from "./budget-tracker";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <BudgetTracker userId={user.id} />;
}
