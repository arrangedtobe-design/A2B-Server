import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VendorList from "./vendor-list";

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <VendorList userId={user.id} />;
}