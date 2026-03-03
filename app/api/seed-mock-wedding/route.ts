import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Create the event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        name: "Sarah & Michael's Wedding",
        wedding_date: "2026-10-17",
        venue: "The Grand Estate at Riverside",
        created_by: user.id,
      })
      .select()
      .single();

    if (eventError) throw eventError;
    const eventId = event.id;

    // 2. Add creator as owner
    await supabase
      .from("event_members")
      .insert({ event_id: eventId, user_id: user.id, role: "owner" });

    // 3. Create vendors
    const vendorRows = [
      { name: "The Grand Estate at Riverside", category: "Venue", contact_name: "Amanda Collins", email: "events@grandestate.com", phone: "(555) 100-2000", notes: "Ceremony and reception. Includes outdoor garden for ceremony, ballroom for reception. Max capacity 200.", color: "#F43F5E" },
      { name: "Elena Vasquez Photography", category: "Photographer", contact_name: "Elena Vasquez", email: "elena@evphoto.com", phone: "(555) 201-3001", notes: "Engagement session included. Second shooter for wedding day. 8-hour coverage.", color: "#8B5CF6" },
      { name: "Golden Hour Films", category: "Videographer", contact_name: "Derek Kim", email: "derek@goldenhourfilms.com", phone: "(555) 302-4002", notes: "Highlight reel + full ceremony edit. Drone footage included.", color: "#3B82F6" },
      { name: "Bloom & Petal Florals", category: "Florist", contact_name: "Rosa Martinez", email: "rosa@bloomandpetal.com", phone: "(555) 403-5003", notes: "Bridal bouquet, 6 bridesmaid bouquets, 12 centerpieces, ceremony arch florals.", color: "#10B981" },
      { name: "Chef Laurent Catering", category: "Caterer", contact_name: "Laurent Dubois", email: "info@cheflaurent.com", phone: "(555) 504-6004", notes: "Plated dinner. Cocktail hour apps. Dietary accommodations available. Tasting scheduled for June.", color: "#F59E0B" },
      { name: "Sweet Layers Bakery", category: "Baker", contact_name: "Mia Chen", email: "mia@sweetlayers.com", phone: "(555) 605-7005", notes: "3-tier wedding cake: vanilla bean + raspberry, chocolate ganache, lemon elderflower. Plus dessert bar.", color: "#EC4899" },
      { name: "DJ Marcus Beat", category: "DJ / Band", contact_name: "Marcus Williams", email: "marcus@djmarcusbeat.com", phone: "(555) 706-8006", notes: "Ceremony music, cocktail hour, reception. Wireless mic for speeches. Uplighting included.", color: "#6366F1" },
      { name: "Rev. Patricia Hayes", category: "Officiant", contact_name: "Patricia Hayes", email: "rev.hayes@email.com", phone: "(555) 807-9007", notes: "Non-denominational ceremony. Includes rehearsal attendance and custom vows consultation.", color: "#14B8A6" },
      { name: "Luxe Beauty Team", category: "Hair & Makeup", contact_name: "Jasmine Okafor", email: "jasmine@luxebeauty.com", phone: "(555) 908-0008", notes: "Bride + 6 bridesmaids + 2 mothers. Trial session for bride included. On-site day-of.", color: "#D946EF" },
      { name: "Elegant Affairs Planning", category: "Planner / Coordinator", contact_name: "Nadia Petrova", email: "nadia@elegantaffairs.com", phone: "(555) 109-1009", notes: "Month-of coordination. Vendor management, timeline creation, day-of coordination with assistant.", color: "#0EA5E9" },
    ].map((v) => ({ ...v, event_id: eventId }));

    const { data: vendors } = await supabase
      .from("vendors")
      .insert(vendorRows)
      .select();

    const vendorMap: Record<string, string> = {};
    for (const v of vendors || []) {
      vendorMap[v.category] = v.id;
    }

    // 4. Create guests
    const guestRows = [
      { name: "James & Linda Thompson", email: "james.thompson@email.com", rsvp_status: "confirmed", meal_preference: "Beef", party_members: [{ name: "Linda Thompson", label: "Spouse" }] },
      { name: "Robert Chen", email: "rob.chen@email.com", rsvp_status: "confirmed", meal_preference: "Fish", party_members: [{ name: "Amy Chen", label: "Spouse" }, { name: "Lily Chen", label: "Child", needs_highchair: true }] },
      { name: "Maria Gonzalez", email: "maria.g@email.com", rsvp_status: "confirmed", meal_preference: "Vegetarian", party_members: [] },
      { name: "David & Emma Williams", email: "d.williams@email.com", rsvp_status: "confirmed", meal_preference: "Chicken", party_members: [{ name: "Emma Williams", label: "Spouse" }] },
      { name: "Aisha Patel", email: "aisha.p@email.com", rsvp_status: "confirmed", meal_preference: "Vegan", party_members: [{ name: "Raj Patel", label: "Spouse" }] },
      { name: "Kevin O'Brien", email: "kevin.ob@email.com", rsvp_status: "confirmed", meal_preference: "Beef", party_members: [{ name: "Sarah O'Brien", label: "Guest" }] },
      { name: "Tomoko Nakamura", email: "tomoko.n@email.com", rsvp_status: "confirmed", meal_preference: "Fish", party_members: [] },
      { name: "Carlos Rivera", email: "carlos.r@email.com", rsvp_status: "confirmed", meal_preference: "Chicken", party_members: [{ name: "Ana Rivera", label: "Spouse" }, { name: "Sofia Rivera", label: "Child" }] },
      { name: "Nicole Dubois", email: "nicole.d@email.com", rsvp_status: "confirmed", meal_preference: "Vegetarian", party_members: [] },
      { name: "Andrew & Jessica Park", email: "a.park@email.com", rsvp_status: "confirmed", meal_preference: "Beef", party_members: [{ name: "Jessica Park", label: "Spouse" }] },

      { name: "Olivia Foster", email: "olivia.f@email.com", rsvp_status: "pending", meal_preference: null, party_members: [{ name: "Mark Foster", label: "Spouse" }] },
      { name: "Samuel Jackson", email: "sam.j@email.com", rsvp_status: "pending", meal_preference: null, party_members: [] },
      { name: "Priya Sharma", email: "priya.s@email.com", rsvp_status: "pending", meal_preference: null, party_members: [{ name: "Vikram Sharma", label: "Spouse" }] },
      { name: "Tom & Rebecca Wright", email: "tom.wright@email.com", rsvp_status: "pending", meal_preference: null, party_members: [{ name: "Rebecca Wright", label: "Spouse" }, { name: "Ethan Wright", label: "Child" }] },
      { name: "Grace Kim", email: "grace.kim@email.com", rsvp_status: "pending", meal_preference: null, party_members: [] },
      { name: "Hassan Ali", email: "hassan.a@email.com", rsvp_status: "pending", meal_preference: null, party_members: [{ name: "Fatima Ali", label: "Spouse" }] },
      { name: "Emily Larson", email: "emily.l@email.com", rsvp_status: "pending", meal_preference: null, party_members: [] },

      { name: "Brian O'Connell", email: "brian.oc@email.com", rsvp_status: "declined", meal_preference: null, party_members: [] },
      { name: "Lisa Chang", email: "lisa.c@email.com", rsvp_status: "declined", meal_preference: null, party_members: [{ name: "Daniel Chang", label: "Spouse" }] },
      { name: "Derek Adams", email: "derek.a@email.com", rsvp_status: "declined", meal_preference: null, party_members: [] },
    ].map((g) => ({ ...g, event_id: eventId }));

    await supabase.from("guests").insert(guestRows);

    // 5. Create tasks
    const taskRows = [
      // Completed
      { title: "Book wedding venue", category: "Venue", priority: "High", owner: "Sarah", is_complete: true, due_date: "2026-01-15", notes: "The Grand Estate confirmed. Deposit paid.", sort_order: 1, subtasks: [{ title: "Get venue quote", is_complete: true }, { title: "Sign contract", is_complete: true }, { title: "Pay deposit", is_complete: true }], contributors: ["Sarah", "Michael"] },
      { title: "Hire photographer", category: "Photography", priority: "High", owner: "Michael", is_complete: true, due_date: "2026-02-01", notes: "Elena Vasquez Photography booked. Engagement session TBD.", sort_order: 2, subtasks: [{ title: "Review portfolios", is_complete: true }, { title: "Schedule consultation", is_complete: true }, { title: "Sign contract", is_complete: true }], contributors: ["Michael"] },
      { title: "Book caterer", category: "Catering", priority: "High", owner: "Sarah", is_complete: true, due_date: "2026-02-15", notes: "Chef Laurent Catering confirmed.", sort_order: 3 },
      { title: "Hire DJ", category: "Music & Entertainment", priority: "Medium", owner: "Michael", is_complete: true, due_date: "2026-03-01", notes: "DJ Marcus Beat confirmed with uplighting.", sort_order: 4 },
      { title: "Order wedding cake", category: "Catering", priority: "Medium", owner: "Sarah", is_complete: true, due_date: "2026-03-15", notes: "Sweet Layers Bakery — 3 tier + dessert bar.", sort_order: 5 },
      { title: "Book officiant", category: "Legal", priority: "High", owner: "Sarah", is_complete: true, due_date: "2026-02-01", notes: "Rev. Patricia Hayes confirmed.", sort_order: 6 },
      { title: "Hire florist", category: "Flowers & Decor", priority: "Medium", owner: "Sarah", is_complete: true, due_date: "2026-03-01", notes: "Bloom & Petal Florals — full package.", sort_order: 7 },
      { title: "Book hair & makeup team", category: "Attire", priority: "Medium", owner: "Sarah", is_complete: true, due_date: "2026-04-01", notes: "Luxe Beauty Team — bride + party + mothers.", sort_order: 8 },

      // Incomplete
      { title: "Send save-the-dates", category: "Stationery", priority: "High", owner: "Sarah", is_complete: false, due_date: "2026-04-01", notes: "Digital save-the-dates via email.", sort_order: 9, subtasks: [{ title: "Finalize design", is_complete: true }, { title: "Collect email addresses", is_complete: true }, { title: "Send batch emails", is_complete: false }], contributors: ["Sarah", "Emily"] },
      { title: "Schedule catering tasting", category: "Catering", priority: "Medium", owner: "Sarah", is_complete: false, due_date: "2026-06-15", notes: "Chef Laurent — need to confirm date for tasting.", sort_order: 10 },
      { title: "Order wedding invitations", category: "Stationery", priority: "High", owner: "Michael", is_complete: false, due_date: "2026-06-01", notes: "Design approved. Need to finalize guest count before ordering.", sort_order: 11, subtasks: [{ title: "Choose design template", is_complete: true }, { title: "Finalize guest count", is_complete: false }, { title: "Place print order", is_complete: false }, { title: "Address envelopes", is_complete: false }], contributors: ["Michael", "Sarah"] },
      { title: "Book rehearsal dinner venue", category: "Venue", priority: "Medium", owner: "Michael", is_complete: false, due_date: "2026-07-01", notes: "Considering Bella Vita Italian or The Garden Room.", sort_order: 12, subtasks: [{ title: "Visit Bella Vita Italian", is_complete: false }, { title: "Visit The Garden Room", is_complete: false }, { title: "Compare pricing", is_complete: false }], contributors: ["Michael", "Sarah", "Mom"] },
      { title: "Finalize seating chart", category: "General", priority: "Medium", owner: "Sarah", is_complete: false, due_date: "2026-09-15", notes: "Wait for all RSVPs before finalizing.", sort_order: 13 },
      { title: "Purchase wedding rings", category: "Attire", priority: "High", owner: "Michael", is_complete: false, due_date: "2026-08-01", notes: "Custom bands from local jeweler — 6 week lead time.", sort_order: 14 },
      { title: "Arrange transportation", category: "Transportation", priority: "Low", owner: "Michael", is_complete: false, due_date: "2026-09-01", notes: "Limo for bridal party. Shuttle for guests from hotel.", sort_order: 15 },
      { title: "Plan honeymoon", category: "General", priority: "Medium", owner: "Sarah", is_complete: false, due_date: "2026-08-15", notes: "Shortlist: Santorini, Bali, Amalfi Coast.", sort_order: 16, subtasks: [{ title: "Research destinations", is_complete: true }, { title: "Book flights", is_complete: false }, { title: "Book hotel", is_complete: false }], contributors: ["Sarah", "Michael"] },
      { title: "Get marriage license", category: "Legal", priority: "High", owner: "Sarah", is_complete: false, due_date: "2026-10-01", notes: "Apply at county clerk — valid for 60 days.", sort_order: 17 },
      { title: "Choose favors for guests", category: "Gifts & Favors", priority: "Low", owner: "Michael", is_complete: false, due_date: "2026-09-01", notes: "Considering custom candles or local honey jars.", sort_order: 18 },
      { title: "Confirm final vendor details", category: "General", priority: "High", owner: "Sarah", is_complete: false, due_date: "2026-10-10", notes: "Final walkthrough with planner and all vendors the week before.", sort_order: 19, contributors: ["Sarah", "Nadia"] },
      { title: "Write personal vows", category: "General", priority: "Medium", owner: "Both", is_complete: false, due_date: "2026-10-01", notes: null, sort_order: 20 },
    ].map((t) => ({ ...t, event_id: eventId }));

    await supabase.from("tasks").insert(taskRows);

    // 6. Create budget items
    const budgetRows = [
      { description: "Venue rental & reception", category: "Venue", vendor_id: vendorMap["Venue"] || null, estimated_cost: 15000, actual_cost: 14500, deposit_amount: 5000, deposit_date: "2026-01-20", amount_paid: 7250, payment_due_date: "2026-09-17", contract_date: "2026-01-15", notes: "50% due 30 days before. Includes tables, chairs, linens." },
      { description: "Photography package", category: "Photographer", vendor_id: vendorMap["Photographer"] || null, estimated_cost: 4500, actual_cost: 4800, deposit_amount: 1500, deposit_date: "2026-02-05", amount_paid: 1500, payment_due_date: "2026-10-17", contract_date: "2026-02-01", notes: "8-hour coverage + engagement session + album." },
      { description: "Videography package", category: "Videographer", vendor_id: vendorMap["Videographer"] || null, estimated_cost: 3000, actual_cost: 3200, deposit_amount: 1000, deposit_date: "2026-02-10", amount_paid: 1000, payment_due_date: "2026-10-17", contract_date: "2026-02-08", notes: "Highlight reel + full ceremony + drone." },
      { description: "Floral arrangements", category: "Florist", vendor_id: vendorMap["Florist"] || null, estimated_cost: 3500, actual_cost: 3800, deposit_amount: 1000, deposit_date: "2026-03-05", amount_paid: 1000, payment_due_date: "2026-10-01", contract_date: "2026-03-01", notes: "Bridal bouquet, bridesmaid bouquets, centerpieces, arch." },
      { description: "Catering — dinner & cocktail hour", category: "Caterer", vendor_id: vendorMap["Caterer"] || null, estimated_cost: 12000, actual_cost: 0, deposit_amount: 3000, deposit_date: "2026-02-20", amount_paid: 3000, payment_due_date: "2026-10-03", contract_date: "2026-02-15", notes: "Per-head pricing. Final count due 2 weeks before." },
      { description: "Wedding cake & dessert bar", category: "Baker", vendor_id: vendorMap["Baker"] || null, estimated_cost: 1200, actual_cost: 1350, deposit_amount: 400, deposit_date: "2026-03-20", amount_paid: 400, payment_due_date: "2026-10-10", contract_date: "2026-03-15", notes: "3-tier cake + assorted mini desserts for 120 guests." },
      { description: "DJ & entertainment", category: "DJ / Band", vendor_id: vendorMap["DJ / Band"] || null, estimated_cost: 2000, actual_cost: 2200, deposit_amount: 500, deposit_date: "2026-03-05", amount_paid: 500, payment_due_date: "2026-10-17", contract_date: "2026-03-01", notes: "6 hours. Ceremony + cocktail + reception. Uplighting add-on." },
      { description: "Officiant services", category: "Officiant", vendor_id: vendorMap["Officiant"] || null, estimated_cost: 500, actual_cost: 500, deposit_amount: 0, deposit_date: null, amount_paid: 500, payment_due_date: null, contract_date: "2026-02-01", notes: "Paid in full. Includes rehearsal." },
      { description: "Hair & makeup", category: "Hair & Makeup", vendor_id: vendorMap["Hair & Makeup"] || null, estimated_cost: 2500, actual_cost: 2800, deposit_amount: 700, deposit_date: "2026-04-05", amount_paid: 700, payment_due_date: "2026-10-17", contract_date: "2026-04-01", notes: "Bride + 6 bridesmaids + 2 mothers. Trial included." },
      { description: "Wedding planner / coordinator", category: "Planner / Coordinator", vendor_id: vendorMap["Planner / Coordinator"] || null, estimated_cost: 3500, actual_cost: 3500, deposit_amount: 1000, deposit_date: "2026-01-25", amount_paid: 1750, payment_due_date: "2026-10-17", contract_date: "2026-01-20", notes: "Month-of coordination. Day-of lead + assistant." },
      { description: "Wedding attire — bride", category: "Attire", vendor_id: null, estimated_cost: 3000, actual_cost: 3200, deposit_amount: 1500, deposit_date: "2026-01-10", amount_paid: 3200, payment_due_date: null, contract_date: null, notes: "Dress + alterations + veil + accessories." },
      { description: "Wedding attire — groom", category: "Attire", vendor_id: null, estimated_cost: 800, actual_cost: 750, deposit_amount: 0, deposit_date: null, amount_paid: 750, payment_due_date: null, contract_date: null, notes: "Custom suit + shoes + accessories." },
      { description: "Invitations & stationery", category: "Stationery", vendor_id: null, estimated_cost: 600, actual_cost: 0, deposit_amount: 0, deposit_date: null, amount_paid: 0, payment_due_date: "2026-06-01", contract_date: null, notes: "Save-the-dates, invitations, programs, place cards." },
      { description: "Guest transportation", category: "Transportation", vendor_id: null, estimated_cost: 1500, actual_cost: 0, deposit_amount: 0, deposit_date: null, amount_paid: 0, payment_due_date: "2026-09-15", contract_date: null, notes: "Shuttle from hotel to venue. Limo for bridal party." },
      { description: "Guest favors", category: "Other", vendor_id: null, estimated_cost: 400, actual_cost: 0, deposit_amount: 0, deposit_date: null, amount_paid: 0, payment_due_date: "2026-09-01", contract_date: null, notes: "Custom candles or local honey jars — TBD." },
    ].map((b) => ({ ...b, event_id: eventId }));

    await supabase.from("budget_items").insert(budgetRows);

    // 7. Create RSVP page so guest links work
    await supabase.from("rsvp_pages").insert({
      event_id: eventId,
      page_type: "blocks",
      theme: "romantic",
      blocks: [
        { id: "b1", type: "hero", data: { overlayText: "Sarah & Michael", subtitle: "October 17, 2026 — The Grand Estate at Riverside", overlayOpacity: 40 } },
        { id: "b2", type: "divider", data: { style: "flourish" } },
        { id: "b3", type: "text", data: { content: "We joyfully invite you to celebrate our wedding day with us. Your presence would mean the world.", alignment: "center", size: "md" } },
        { id: "b4", type: "event_details", data: { showDate: true, showVenue: true, showTime: true } },
        { id: "b5", type: "divider", data: { style: "flourish" } },
        { id: "b6", type: "rsvp_form", data: { heading: "Will you be joining us?", description: "Please let us know by filling out the form below." } },
      ],
      couple_names: "Sarah & Michael",
      is_published: true,
      slug: eventId,
      form_config: {
        showMealPreference: true,
        mealOptions: ["Chicken", "Fish", "Vegetarian", "Vegan"],
        showPlusOne: true,
        showDietaryNotes: true,
        customQuestions: [],
      },
    });

    return NextResponse.json({ eventId, message: "Mock wedding created successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create mock wedding" }, { status: 500 });
  }
}
