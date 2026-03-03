"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";

interface PartyMember {
  name: string;
  label: string;
  needs_highchair?: boolean;
}

interface CsvRow {
  name: string;
  email: string;
  rsvp_status: string;
  meal_preference: string;
  party_of: string;
  party_label: string;
  needs_highchair: string;
  dietary_notes: string;
}

interface CsvError {
  row: number;
  message: string;
}

export default function GuestList({ userId }: { userId: string }) {
  const [guests, setGuests] = useState<any[]>([]);
  const [rsvpTokens, setRsvpTokens] = useState<Record<string, any>>({});
  const [rsvpResponses, setRsvpResponses] = useState<Record<string, any>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyGuests, setBusyGuests] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPartyMembers, setEditPartyMembers] = useState<PartyMember[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [mealOptions, setMealOptions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportExport, setShowImportExport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvRow[]; errors: CsvError[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);
    fetchGuests(eid);
  }, []);

  // Clear selection and reset page on filter or search change
  useEffect(() => {
    setSelectedGuests(new Set());
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  const fetchGuests = async (eid: string) => {
    const [guestsRes, tokensRes, responsesRes, rsvpPageRes] = await Promise.all([
      supabase
        .from("guests")
        .select("*")
        .eq("event_id", eid)
        .order("created_at", { ascending: false }),
      supabase
        .from("rsvp_tokens")
        .select("*")
        .eq("event_id", eid),
      supabase
        .from("rsvp_responses")
        .select("*")
        .eq("event_id", eid),
      supabase
        .from("rsvp_pages")
        .select("form_config")
        .eq("event_id", eid)
        .maybeSingle(),
    ]);

    setGuests(guestsRes.data || []);
    const opts = rsvpPageRes.data?.form_config?.mealOptions;
    if (Array.isArray(opts) && opts.length > 0) setMealOptions(opts);

    const tokensByGuest: Record<string, any> = {};
    for (const t of tokensRes.data || []) {
      tokensByGuest[t.guest_id] = t;
    }
    setRsvpTokens(tokensByGuest);

    const responsesByGuest: Record<string, any> = {};
    for (const r of responsesRes.data || []) {
      responsesByGuest[r.guest_id] = r;
    }
    setRsvpResponses(responsesByGuest);

    setLoading(false);
  };

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !eventId) return;

    const { error } = await supabase
      .from("guests")
      .insert({
        name: name.trim(),
        email: email.trim(),
        event_id: eventId,
        party_members: partyMembers.length > 0 ? partyMembers : [],
      });

    if (!error) {
      setName("");
      setEmail("");
      setPartyMembers([]);
      fetchGuests(eventId);
    }
  };

  const addPartyMember = () => {
    setPartyMembers((prev) => [...prev, { name: "", label: "Guest" }]);
  };

  const updatePartyMember = (index: number, updates: Partial<PartyMember>) => {
    setPartyMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m)),
    );
  };

  const removePartyMember = (index: number) => {
    setPartyMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRsvp = async (id: string, status: string) => {
    if (!eventId) return;
    await supabase.from("guests").update({ rsvp_status: status }).eq("id", id);
    fetchGuests(eventId);
  };

  const updateMeal = async (id: string, meal: string) => {
    if (!eventId) return;
    await supabase.from("guests").update({ meal_preference: meal }).eq("id", id);
    fetchGuests(eventId);
  };

  const updatePartyResponse = async (
    guestId: string,
    index: number,
    updates: { attending?: string; meal_preference?: string; dietary_notes?: string; name?: string; needs_highchair?: boolean },
  ) => {
    if (!eventId) return;
    const existing = rsvpResponses[guestId];
    const guest = guests.find((g) => g.id === guestId);
    const members = guest?.party_members || [];

    // Build current party_responses array (from existing response or defaults)
    const current = existing?.party_responses?.length
      ? [...existing.party_responses]
      : members.map((m: PartyMember) => ({ name: m.name, attending: "coming", meal_preference: null }));

    current[index] = { ...current[index], ...updates };

    if (existing) {
      await supabase
        .from("rsvp_responses")
        .update({ party_responses: current, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      // Create a response row so admin edits are persisted
      await supabase.from("rsvp_responses").insert({
        guest_id: guestId,
        event_id: eventId,
        attending: guest?.rsvp_status === "declined" ? "no" : "yes",
        party_responses: current,
      });
    }
    fetchGuests(eventId);
  };

  const deleteGuest = async (id: string) => {
    if (!eventId) return;
    const guest = guests.find((g) => g.id === id);
    if (!confirm(`Delete ${guest?.name || "this guest"}? This cannot be undone.`)) return;
    await supabase.from("guests").delete().eq("id", id);
    fetchGuests(eventId);
  };

  const startEditing = (guest: any) => {
    setEditingId(guest.id);
    setEditName(guest.name);
    setEditEmail(guest.email || "");
    setEditPartyMembers(guest.party_members || []);
  };

  const saveEdit = async () => {
    if (!editingId || !eventId || !editName.trim()) return;
    await supabase
      .from("guests")
      .update({
        name: editName.trim(),
        email: editEmail.trim(),
        party_members: editPartyMembers.length > 0 ? editPartyMembers : [],
      })
      .eq("id", editingId);
    setEditingId(null);
    fetchGuests(eventId);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // --- Invite actions ---

  const getInviteStatus = (guestId: string) => {
    const token = rsvpTokens[guestId];
    if (!token) return "Not Sent";
    if (token.responded_at) return "Responded";
    if (token.viewed_at) return "Viewed";
    if (token.invite_sent_at) return "Invited";
    return "Not Sent";
  };

  const ensureToken = async (guestId: string): Promise<string | null> => {
    // If token exists, return its URL
    const existing = rsvpTokens[guestId];
    if (existing) {
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      return `${base}/rsvp/${existing.token}`;
    }
    // Auto-generate via API
    if (!eventId) return null;
    const res = await fetch("/api/rsvp/generate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_ids: [guestId], event_id: eventId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tokenResult = data.tokens?.[0];
    if (!tokenResult) return null;
    // Update local state
    await fetchGuests(eventId);
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${base}/rsvp/${tokenResult.token}`;
  };

  const copyLink = async (guestId: string) => {
    setBusyGuests((prev) => new Set([...prev, guestId]));
    try {
      const url = await ensureToken(guestId);
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopiedId(guestId);
      setTimeout(() => setCopiedId(null), 2000);
    } finally {
      setBusyGuests((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  };

  const sendInvite = async (guestIds: string[]) => {
    if (!eventId) return;
    const ids = new Set(guestIds);
    setBusyGuests((prev) => new Set([...prev, ...ids]));
    try {
      const res = await fetch("/api/rsvp/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_ids: guestIds, event_id: eventId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.failed?.length) {
          alert(
            `Sent ${data.sent.length} email(s). ${data.failed.length} failed:\n` +
              data.failed.map((f: any) => `${f.guest_id}: ${f.error}`).join("\n"),
          );
        }
        await fetchGuests(eventId);
      }
    } finally {
      setBusyGuests((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleSendAll = async () => {
    const unsent = guests
      .filter((g) => !rsvpTokens[g.id]?.invite_sent_at && g.email)
      .map((g) => g.id);
    if (!unsent.length) return;
    setBulkAction("send");
    await sendInvite(unsent);
    setBulkAction(null);
  };

  const handleResendSelected = async () => {
    const ids = Array.from(selectedGuests).filter((id) => {
      const guest = guests.find((g) => g.id === id);
      return guest?.email;
    });
    if (!ids.length) return;
    setBulkAction("resend");
    await sendInvite(ids);
    setSelectedGuests(new Set());
    setBulkAction(null);
  };

  const toggleSelectGuest = (guestId: string) => {
    setSelectedGuests((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) {
        next.delete(guestId);
      } else {
        next.add(guestId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGuests.size === filteredGuests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filteredGuests.map((g) => g.id)));
    }
  };

  // --- Party helpers ---

  const getPartySize = (guest: any): number => {
    const members = guest.party_members || [];
    return 1 + members.length;
  };

  const getEstAttending = (): number => {
    let count = 0;
    for (const g of guests) {
      if (g.rsvp_status !== "confirmed") continue;
      count++; // primary guest
      const response = rsvpResponses[g.id];
      if (response?.party_responses?.length) {
        count += response.party_responses.filter((pr: any) => pr.attending === "coming").length;
      } else if (g.plus_one) {
        count++;
      }
    }
    return count;
  };

  // --- CSV helpers ---

  const CSV_HEADERS = ["name", "email", "rsvp_status", "meal_preference", "party_of", "party_label", "needs_highchair", "dietary_notes"];
  const VALID_STATUSES = ["pending", "confirmed", "declined"];

  const escapeCsvField = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return `"${value}"`;
  };

  const downloadTemplate = () => {
    const rows = [
      CSV_HEADERS.join(","),
      '"James Thompson","james@email.com","pending","","","","",""',
      '"Linda Thompson","","pending","","James Thompson","Spouse","",""',
    ];
    triggerCsvDownload(rows.join("\n"), "guest-list-template.csv");
  };

  const exportGuestList = () => {
    const rows: string[] = [CSV_HEADERS.join(",")];
    for (const guest of guests) {
      const response = rsvpResponses[guest.id];
      rows.push([
        escapeCsvField(guest.name || ""),
        escapeCsvField(guest.email || ""),
        escapeCsvField(guest.rsvp_status || "pending"),
        escapeCsvField(guest.meal_preference || ""),
        escapeCsvField(""),
        escapeCsvField(""),
        escapeCsvField(""),
        escapeCsvField(response?.dietary_notes || ""),
      ].join(","));

      const members: PartyMember[] = guest.party_members || [];
      members.forEach((member, i) => {
        const partyResponse = response?.party_responses?.[i];
        rows.push([
          escapeCsvField(member.name || ""),
          escapeCsvField(""),
          escapeCsvField(guest.rsvp_status || "pending"),
          escapeCsvField(partyResponse?.meal_preference || ""),
          escapeCsvField(guest.name || ""),
          escapeCsvField(member.label || "Guest"),
          escapeCsvField(member.needs_highchair ? "yes" : ""),
          escapeCsvField(partyResponse?.dietary_notes || ""),
        ].join(","));
      });
    }
    triggerCsvDownload(rows.join("\n"), "guest-list.csv");
  };

  const triggerCsvDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvContent = (text: string): { rows: CsvRow[]; errors: CsvError[] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { rows: [], errors: [{ row: 0, message: "CSV file is empty or has no data rows" }] };

    // Parse header
    const headerLine = parseCsvLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headerLine.forEach((h, i) => { headerMap[h.trim().toLowerCase()] = i; });

    // Validate required headers
    if (headerMap["name"] === undefined) {
      return { rows: [], errors: [{ row: 0, message: 'Missing required "name" column header' }] };
    }

    const rows: CsvRow[] = [];
    const errors: CsvError[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const get = (col: string) => (headerMap[col] !== undefined ? (fields[headerMap[col]] || "").trim() : "");

      const row: CsvRow = {
        name: get("name"),
        email: get("email"),
        rsvp_status: get("rsvp_status") || "pending",
        meal_preference: get("meal_preference"),
        party_of: get("party_of"),
        party_label: get("party_label"),
        needs_highchair: get("needs_highchair"),
        dietary_notes: get("dietary_notes"),
      };

      if (!row.name) {
        errors.push({ row: i + 1, message: "Missing name" });
      }
      if (row.rsvp_status && !VALID_STATUSES.includes(row.rsvp_status)) {
        errors.push({ row: i + 1, message: `Invalid rsvp_status "${row.rsvp_status}"` });
      }

      rows.push(row);
    }

    return { rows, errors };
  };

  const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  };

  const handleFileSelect = async (file: File) => {
    setCsvFile(file);
    const text = await file.text();
    const result = parseCsvContent(text);
    setCsvPreview(result);
  };

  const handleImport = async () => {
    if (!csvPreview || !eventId) return;
    const { rows, errors } = csvPreview;
    const blockingErrors = errors.filter((e) => e.message === "Missing name" || e.message.startsWith("Invalid rsvp_status"));
    if (blockingErrors.length > 0) return;

    setImporting(true);
    try {
      // Separate primary guests from party members
      const primaryRows = rows.filter((r) => !r.party_of);
      const memberRows = rows.filter((r) => r.party_of);

      // Build a set of existing guest names for dedup
      const existingNames = new Set(guests.map((g) => g.name.toLowerCase()));

      // Group party members by their primary guest name
      const membersByPrimary: Record<string, CsvRow[]> = {};
      for (const m of memberRows) {
        const key = m.party_of.toLowerCase();
        if (!membersByPrimary[key]) membersByPrimary[key] = [];
        membersByPrimary[key].push(m);
      }

      let importedCount = 0;
      for (const primary of primaryRows) {
        if (existingNames.has(primary.name.toLowerCase())) continue;

        const partyKey = primary.name.toLowerCase();
        const members = (membersByPrimary[partyKey] || []).map((m) => ({
          name: m.name,
          label: m.party_label || "Guest",
          needs_highchair: m.needs_highchair?.toLowerCase() === "yes",
        }));

        const { error } = await supabase.from("guests").insert({
          name: primary.name,
          email: primary.email || null,
          rsvp_status: primary.rsvp_status || "pending",
          meal_preference: primary.meal_preference || null,
          event_id: eventId,
          party_members: members.length > 0 ? members : [],
        });

        if (!error) importedCount++;
      }

      // Reset import state
      setCsvFile(null);
      setCsvPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowImportExport(false);
      fetchGuests(eventId);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  const confirmed = guests.filter((g) => g.rsvp_status === "confirmed").length;
  const pending = guests.filter((g) => g.rsvp_status === "pending").length;
  const declined = guests.filter((g) => g.rsvp_status === "declined").length;
  const invited = guests.filter((g) => rsvpTokens[g.id]?.invite_sent_at).length;
  const responded = guests.filter((g) => rsvpTokens[g.id]?.responded_at).length;
  const estimatedTotal = getEstAttending();

  const unsentCount = guests.filter((g) => !rsvpTokens[g.id]?.invite_sent_at && g.email).length;

  const filteredGuests = (() => {
    let result = guests;
    if (filterStatus === "Invited") result = result.filter((g) => rsvpTokens[g.id]?.invite_sent_at);
    else if (filterStatus === "Not Invited") result = result.filter((g) => !rsvpTokens[g.id]?.invite_sent_at);
    else if (filterStatus !== "All") result = result.filter((g) => g.rsvp_status === filterStatus.toLowerCase());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) =>
        g.name?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.party_members?.some((m: PartyMember) => m.name?.toLowerCase().includes(q))
      );
    }
    return result;
  })();

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedGuests = filteredGuests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const inviteStatusStyles: Record<string, string> = {
    "Not Sent": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "Invited": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "Viewed": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    "Responded": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</a>
            <h1 className="text-2xl font-bold text-heading truncate">Guest List</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowImportExport(true)}
              className="px-3 py-1 rounded-full text-sm bg-surface text-rose-app border border-rose-app hover:bg-rose-light-bg"
            >
              Import / Export
            </button>
            <ThemeSwitcher />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-heading">{guests.length}</p>
            <p className="text-xs text-subtle">Total</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{invited}</p>
            <p className="text-xs text-subtle">Invited</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{confirmed}</p>
            <p className="text-xs text-subtle">Confirmed</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</p>
            <p className="text-xs text-subtle">Pending</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{declined}</p>
            <p className="text-xs text-subtle">Declined</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{responded}</p>
            <p className="text-xs text-subtle">Responded</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-rose-app">{estimatedTotal}</p>
            <p className="text-xs text-subtle">Est. Attending</p>
          </div>
        </div>

        {/* Add Guest Form */}
        <form onSubmit={addGuest} className="bg-surface p-4 rounded-lg shadow border border-app-border mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest name"
              required
              className="flex-1 border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="flex-1 border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
            <button type="submit" className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover">
              Add
            </button>
          </div>

          {/* Party members builder */}
          {partyMembers.length > 0 && (
            <div className="mt-3 space-y-2">
              {partyMembers.map((member, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select
                    value={member.label}
                    onChange={(e) => updatePartyMember(index, { label: e.target.value })}
                    className="border border-app-border rounded px-2 py-1.5 text-sm bg-surface text-heading"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Guest">Guest</option>
                  </select>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updatePartyMember(index, { name: e.target.value })}
                    placeholder="Name (optional)"
                    className="flex-1 border border-app-border rounded px-2 py-1.5 text-sm bg-surface text-heading"
                  />
                  <label className="flex items-center gap-1 text-xs text-subtle whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={member.needs_highchair || false}
                      onChange={(e) => updatePartyMember(index, { needs_highchair: e.target.checked })}
                      className="w-3 h-3 rounded"
                    />
                    Highchair
                  </label>
                  <button
                    type="button"
                    onClick={() => removePartyMember(index)}
                    className="text-subtle hover:text-red-500 text-lg px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addPartyMember}
            className="mt-2 text-xs text-rose-app hover:text-rose-app-hover font-medium"
          >
            + Add party member
          </button>
        </form>

        {/* Bulk Invite Actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleSendAll}
            disabled={!unsentCount || bulkAction !== null}
            className="flex-1 bg-rose-app text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rose-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkAction === "send"
              ? "Sending..."
              : `Send All Invites${unsentCount ? ` (${unsentCount})` : ""}`}
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guests..."
          className="w-full border border-app-border rounded-lg px-3 py-2 mb-3 bg-surface text-heading text-sm placeholder:text-subtle"
        />

        {/* RSVP Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["All", "Pending", "Confirmed", "Declined", "Invited", "Not Invited"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-sm ${
                filterStatus === status
                  ? "bg-rose-app text-white"
                  : "bg-surface text-body border border-app-border hover:bg-page-bg"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Select All + Page Info */}
        {filteredGuests.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-subtle">
                <input
                  type="checkbox"
                  checked={selectedGuests.size === filteredGuests.length && filteredGuests.length > 0}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded"
                />
                Select all ({filteredGuests.length})
              </label>
              {selectedGuests.size > 0 && (
                <span className="text-xs text-subtle">· {selectedGuests.size} selected</span>
              )}
            </div>
            {totalPages > 1 && (
              <span className="text-xs text-subtle">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredGuests.length)} of {filteredGuests.length}
              </span>
            )}
          </div>
        )}

        {/* Guest List */}
        <div className="space-y-2">
          {paginatedGuests.map((guest) => {
            const inviteStatus = getInviteStatus(guest.id);
            const isBusy = busyGuests.has(guest.id);
            const isCopied = copiedId === guest.id;
            const partySize = getPartySize(guest);
            const isSelected = selectedGuests.has(guest.id);
            const response = rsvpResponses[guest.id];

            return (
              <div
                key={guest.id}
                className={`bg-surface p-3 rounded-lg shadow-sm border ${
                  isSelected ? "border-rose-400 dark:border-rose-600" : "border-app-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  {editingId === guest.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm border border-app-border rounded px-2 py-1 bg-surface text-heading flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          className="text-sm border border-app-border rounded px-2 py-1 bg-surface text-heading flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <button onClick={saveEdit} className="text-xs px-2 py-1 rounded bg-rose-app text-white hover:bg-rose-app-hover">Save</button>
                        <button onClick={cancelEdit} className="text-xs px-2 py-1 rounded border border-app-border text-subtle hover:bg-page-bg">Cancel</button>
                      </div>
                      {/* Edit party members */}
                      {editPartyMembers.length > 0 && (
                        <div className="space-y-1.5 pl-1">
                          {editPartyMembers.map((member, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select
                                value={member.label}
                                onChange={(e) => {
                                  setEditPartyMembers((prev) =>
                                    prev.map((m, i) => (i === index ? { ...m, label: e.target.value } : m)),
                                  );
                                }}
                                className="border border-app-border rounded px-1.5 py-1 text-xs bg-surface text-heading"
                              >
                                <option value="Spouse">Spouse</option>
                                <option value="Child">Child</option>
                                <option value="Guest">Guest</option>
                              </select>
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => {
                                  setEditPartyMembers((prev) =>
                                    prev.map((m, i) => (i === index ? { ...m, name: e.target.value } : m)),
                                  );
                                }}
                                placeholder="Name"
                                className="flex-1 border border-app-border rounded px-1.5 py-1 text-xs bg-surface text-heading"
                              />
                              <label className="flex items-center gap-1 text-[11px] text-subtle whitespace-nowrap cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={member.needs_highchair || false}
                                  onChange={(e) => {
                                    setEditPartyMembers((prev) =>
                                      prev.map((m, i) => (i === index ? { ...m, needs_highchair: e.target.checked } : m)),
                                    );
                                  }}
                                  className="w-3 h-3 rounded"
                                />
                                Highchair
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditPartyMembers((prev) => prev.filter((_, i) => i !== index))
                                }
                                className="text-subtle hover:text-red-500 text-sm px-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditPartyMembers((prev) => [...prev, { name: "", label: "Guest" }])
                        }
                        className="text-xs text-rose-app hover:text-rose-app-hover font-medium"
                      >
                        + Add party member
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectGuest(guest.id)}
                          className="w-3.5 h-3.5 rounded flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => startEditing(guest)}>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-heading truncate">{guest.name}</p>
                            {partySize > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                Party of {partySize}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${inviteStatusStyles[inviteStatus]}`}>
                              {inviteStatus}
                            </span>
                          </div>
                          {guest.email && <p className="text-xs text-subtle truncate">{guest.email}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGuest(guest.id)}
                        className="text-subtle hover:text-red-500 text-lg ml-2"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>

                {editingId !== guest.id && (
                  <>
                    {/* Guest details row */}
                    <div className="flex gap-2 items-center flex-wrap mb-2">
                      <select
                        value={guest.rsvp_status}
                        onChange={(e) => updateRsvp(guest.id, e.target.value)}
                        className={`text-xs border rounded px-2 py-1 ${
                          guest.rsvp_status === "confirmed"
                            ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : guest.rsvp_status === "declined"
                            ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="declined">Declined</option>
                      </select>
                      {guest.rsvp_status !== "declined" && (
                        mealOptions.length > 0 ? (
                          <select
                            value={guest.meal_preference || ""}
                            onChange={(e) => updateMeal(guest.id, e.target.value)}
                            className="text-xs border border-app-border rounded px-2 py-1 flex-1 bg-surface text-heading"
                          >
                            <option value="">Meal preference</option>
                            {mealOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={guest.meal_preference || ""}
                            onChange={(e) => updateMeal(guest.id, e.target.value)}
                            placeholder="Meal preference"
                            className="text-xs border border-app-border rounded px-2 py-1 flex-1 bg-surface text-heading"
                          />
                        )
                      )}
                    </div>

                    {/* Invite actions row */}
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <button
                        onClick={() => copyLink(guest.id)}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded border border-app-border bg-surface text-heading hover:bg-page-bg disabled:opacity-50"
                      >
                        {isBusy ? "..." : isCopied ? "Copied!" : "Copy Link"}
                      </button>

                      {inviteStatus === "Not Sent" && guest.email && (
                        <button
                          onClick={() => sendInvite([guest.id])}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1 rounded bg-rose-app text-white hover:bg-rose-app-hover disabled:opacity-50"
                        >
                          {isBusy ? "Sending..." : "Send Email"}
                        </button>
                      )}

                      {(inviteStatus === "Invited" || inviteStatus === "Viewed") && guest.email && (
                        <button
                          onClick={() => sendInvite([guest.id])}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 disabled:opacity-50"
                        >
                          {isBusy ? "Sending..." : "Resend"}
                        </button>
                      )}

                      {inviteStatus === "Responded" && guest.email && (
                        <button
                          onClick={() => sendInvite([guest.id])}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 disabled:opacity-50"
                        >
                          {isBusy ? "Sending..." : "Resend"}
                        </button>
                      )}
                    </div>

                    {/* Party members — editable inline */}
                    {(guest.party_members?.length > 0 && guest.rsvp_status !== "declined") && (() => {
                      const partyData = response?.party_responses?.length
                        ? response.party_responses
                        : (guest.party_members || []).map((m: any) => ({ name: m.name, attending: "coming", meal_preference: null }));
                      return (
                        <div className="mt-2 text-xs text-subtle space-y-1">
                          <p className="font-medium text-body">Party</p>
                          {partyData.map((pr: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-body">{pr.name || guest.party_members[i]?.name || "Unnamed"}</span>
                              <select
                                value={pr.attending || "coming"}
                                onChange={(e) => updatePartyResponse(guest.id, i, { attending: e.target.value })}
                                className={`text-[11px] border rounded px-1.5 py-0.5 ${
                                  pr.attending === "coming"
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : pr.attending === "unsure"
                                      ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                <option value="coming">Coming</option>
                                <option value="not_coming">Not Coming</option>
                                <option value="unsure">Unsure</option>
                              </select>
                              {pr.attending === "coming" && (
                                mealOptions.length > 0 ? (
                                  <select
                                    value={pr.meal_preference || ""}
                                    onChange={(e) => updatePartyResponse(guest.id, i, { meal_preference: e.target.value || null })}
                                    className="text-[11px] border border-app-border rounded px-1.5 py-0.5 bg-surface text-heading"
                                  >
                                    <option value="">Meal</option>
                                    {mealOptions.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={pr.meal_preference || ""}
                                    onChange={(e) => updatePartyResponse(guest.id, i, { meal_preference: e.target.value })}
                                    placeholder="Meal"
                                    className="text-[11px] border border-app-border rounded px-1.5 py-0.5 bg-surface text-heading w-24"
                                  />
                                )
                              )}
                              <input
                                type="text"
                                value={pr.dietary_notes || ""}
                                onChange={(e) => updatePartyResponse(guest.id, i, { dietary_notes: e.target.value })}
                                placeholder="Dietary"
                                className="text-[11px] border border-app-border rounded px-1.5 py-0.5 bg-surface text-heading w-24"
                              />
                              <label className="flex items-center gap-1 text-[11px] text-subtle whitespace-nowrap cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={pr.needs_highchair || false}
                                  onChange={(e) => updatePartyResponse(guest.id, i, { needs_highchair: e.target.checked })}
                                  className="w-3 h-3 rounded"
                                />
                                Highchair
                              </label>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Response extras */}
                    {response && (
                      <div className="mt-1 text-xs text-subtle space-y-0.5">
                        {!response.party_responses?.length && response.plus_one_name && (
                          <p>
                            <span className="font-medium text-body">Plus one:</span> {response.plus_one_name}
                          </p>
                        )}
                        {response.dietary_notes && (
                          <p>
                            <span className="font-medium text-body">Dietary:</span> {response.dietary_notes}
                          </p>
                        )}
                        {response.comment && (
                          <p>
                            <span className="font-medium text-body">Comment:</span> {response.comment}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {paginatedGuests.length === 0 && (
            <p className="text-center text-subtle py-8">No guests yet. Add one above!</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-app-border text-body hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-sm rounded-lg font-medium ${
                  page === safePage
                    ? "bg-rose-app text-white"
                    : "border border-app-border text-body hover:bg-surface"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-app-border text-body hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Floating selection bar */}
        {selectedGuests.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-app-border rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 z-50">
            <span className="text-sm font-medium text-heading">{selectedGuests.size} selected</span>
            <button
              onClick={() => setSelectedGuests(new Set())}
              className="text-xs text-subtle hover:text-heading"
            >
              Clear
            </button>
            <button
              onClick={handleResendSelected}
              disabled={bulkAction === "resend"}
              className="text-xs px-3 py-1.5 rounded-lg bg-rose-app text-white hover:bg-rose-app-hover disabled:opacity-50"
            >
              {bulkAction === "resend"
                ? "Sending..."
                : `Resend to Selected (${selectedGuests.size})`}
            </button>
          </div>
        )}

        {/* Import / Export Modal */}
        {showImportExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
              className="w-full max-w-lg p-6 rounded-xl shadow-xl border border-app-border bg-surface max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-heading">Import / Export Guest List</h3>
                <button
                  onClick={() => {
                    setShowImportExport(false);
                    setCsvFile(null);
                    setCsvPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-subtle hover:text-heading text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Download Template */}
              <div className="mb-4">
                <button
                  onClick={downloadTemplate}
                  className="w-full text-left px-4 py-3 rounded-lg border border-app-border bg-page-bg hover:bg-surface transition-colors"
                >
                  <span className="font-medium text-heading text-sm">Download Template</span>
                  <p className="text-xs text-subtle mt-0.5">Get a blank CSV with headers and example rows to fill in.</p>
                </button>
              </div>

              {/* Export Guest List */}
              <div className="mb-5">
                <button
                  onClick={exportGuestList}
                  disabled={guests.length === 0}
                  className="w-full text-left px-4 py-3 rounded-lg border border-app-border bg-page-bg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-heading text-sm">Export Guest List</span>
                  <p className="text-xs text-subtle mt-0.5">
                    Download your current guest list as a CSV file{guests.length > 0 ? ` (${guests.length} guests)` : ""}.
                  </p>
                </button>
              </div>

              {/* Import from CSV */}
              <div className="border-t border-app-border pt-4">
                <p className="text-sm font-medium text-heading mb-3">Import from CSV</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="block w-full text-sm text-body file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-app-border file:text-sm file:font-medium file:bg-page-bg file:text-heading hover:file:bg-surface file:cursor-pointer"
                />

                {/* Preview table */}
                {csvPreview && (
                  <div className="mt-4">
                    {csvPreview.errors.length > 0 && (
                      <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                          {csvPreview.errors.length} issue{csvPreview.errors.length > 1 ? "s" : ""} found:
                        </p>
                        {csvPreview.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600 dark:text-red-400">
                            Row {err.row}: {err.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="overflow-x-auto border border-app-border rounded-lg">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-page-bg">
                            <th className="px-2 py-1.5 text-left font-medium text-subtle">#</th>
                            <th className="px-2 py-1.5 text-left font-medium text-subtle">Name</th>
                            <th className="px-2 py-1.5 text-left font-medium text-subtle">Email</th>
                            <th className="px-2 py-1.5 text-left font-medium text-subtle">Status</th>
                            <th className="px-2 py-1.5 text-left font-medium text-subtle">Party Of</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.map((row, i) => {
                            const rowErrors = csvPreview.errors.filter((e) => e.row === i + 2);
                            const hasError = rowErrors.length > 0;
                            const isDuplicate = !row.party_of && guests.some((g) => g.name.toLowerCase() === row.name.toLowerCase());
                            return (
                              <tr
                                key={i}
                                className={`border-t border-app-border ${
                                  hasError
                                    ? "bg-red-50 dark:bg-red-900/10"
                                    : isDuplicate
                                    ? "bg-yellow-50 dark:bg-yellow-900/10"
                                    : ""
                                }`}
                              >
                                <td className="px-2 py-1.5 text-subtle">{i + 1}</td>
                                <td className="px-2 py-1.5 text-heading">
                                  {row.name || <span className="text-red-500 italic">missing</span>}
                                  {row.party_of && (
                                    <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      {row.party_label || "Member"}
                                    </span>
                                  )}
                                  {isDuplicate && (
                                    <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                      exists
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-body">{row.email}</td>
                                <td className="px-2 py-1.5 text-body">{row.rsvp_status}</td>
                                <td className="px-2 py-1.5 text-body">{row.party_of}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-subtle">
                        {csvPreview.rows.filter((r) => !r.party_of).length} primary guest{csvPreview.rows.filter((r) => !r.party_of).length !== 1 ? "s" : ""},
                        {" "}{csvPreview.rows.filter((r) => r.party_of).length} party member{csvPreview.rows.filter((r) => r.party_of).length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCsvFile(null);
                            setCsvPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg border border-app-border text-body hover:bg-page-bg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleImport}
                          disabled={importing || csvPreview.errors.some((e) => e.message === "Missing name" || e.message.startsWith("Invalid rsvp_status"))}
                          className="px-3 py-1.5 text-sm rounded-lg bg-rose-app text-white hover:bg-rose-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importing
                            ? "Importing..."
                            : `Import ${csvPreview.rows.filter((r) => !r.party_of).length} Guests`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
