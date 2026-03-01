"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ThemeSwitcher } from "@/components/theme-switcher";

const BUDGET_CATEGORIES = [
  "General", "Venue", "Photographer", "Videographer", "Florist", "Caterer",
  "Baker", "DJ / Band", "Officiant", "Hair & Makeup", "Planner / Coordinator",
  "Rentals", "Stationery", "Transportation", "Lighting", "Photo Booth", "Attire", "Other"
];

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function BudgetTracker({ userId }: { userId: string }) {
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [vendorId, setVendorId] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [filterStatus, setFilterStatus] = useState("All");

  const themeColors = useThemeColors();
  const VENDOR_COLORS = themeColors.vendorPalette;
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) { router.push("/"); return; }
    setEventId(eid);
    fetchData(eid);
  }, []);

  const fetchData = async (eid: string) => {
    const [{ data: items }, { data: vends }] = await Promise.all([
      supabase
        .from("budget_items")
        .select("*")
        .eq("event_id", eid)
        .order("created_at", { ascending: true }),
      supabase
        .from("vendors")
        .select("*")
        .eq("event_id", eid)
        .order("name", { ascending: true }),
    ]);
    setBudgetItems(items || []);
    setVendors(vends || []);
    setLoading(false);
  };

  const resetForm = () => {
    setDescription(""); setCategory("General"); setVendorId(""); setContractDate("");
    setEstimatedCost(""); setActualCost(""); setDepositAmount(""); setDepositDate("");
    setAmountPaid(""); setPaymentDueDate(""); setNotes("");
    setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !eventId) return;

    const payload = {
      description: description.trim(),
      category,
      vendor_id: vendorId || null,
      contract_date: contractDate || null,
      estimated_cost: parseFloat(estimatedCost) || 0,
      actual_cost: parseFloat(actualCost) || 0,
      deposit_amount: parseFloat(depositAmount) || 0,
      deposit_date: depositDate || null,
      amount_paid: parseFloat(amountPaid) || 0,
      payment_due_date: paymentDueDate || null,
      notes: notes.trim() || null,
    };

    if (editingId) {
      await supabase.from("budget_items").update(payload).eq("id", editingId);
    } else {
      await supabase.from("budget_items").insert({ ...payload, event_id: eventId });
    }

    resetForm();
    fetchData(eventId);
  };

  const startEdit = (item: any) => {
    setDescription(item.description);
    setCategory(item.category || "General");
    setVendorId(item.vendor_id || "");
    setContractDate(item.contract_date || "");
    setEstimatedCost(item.estimated_cost?.toString() || "");
    setActualCost(item.actual_cost?.toString() || "");
    setDepositAmount(item.deposit_amount?.toString() || "");
    setDepositDate(item.deposit_date || "");
    setAmountPaid(item.amount_paid?.toString() || "");
    setPaymentDueDate(item.payment_due_date || "");
    setNotes(item.notes || "");
    setEditingId(item.id);
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!eventId || !confirm("Delete this budget item?")) return;
    await supabase.from("budget_items").delete().eq("id", id);
    fetchData(eventId);
  };

  const handleVendorChange = (vid: string) => {
    setVendorId(vid);
    if (vid) {
      const vendor = vendors.find((v) => v.id === vid);
      if (vendor?.category) setCategory(vendor.category);
    }
  };

  // Computed values
  const getItemStatus = (item: any) => {
    const actual = parseFloat(item.actual_cost) || 0;
    const paid = parseFloat(item.amount_paid) || 0;
    if (actual <= 0) return "Unpaid";
    if (paid >= actual) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  };

  const totalEstimated = budgetItems.reduce((s, i) => s + (parseFloat(i.estimated_cost) || 0), 0);
  const totalActual = budgetItems.reduce((s, i) => s + (parseFloat(i.actual_cost) || 0), 0);
  const totalPaid = budgetItems.reduce((s, i) => s + (parseFloat(i.amount_paid) || 0), 0);
  const totalOutstanding = totalActual - totalPaid;
  const percentPaid = totalActual > 0 ? Math.min(100, Math.round((totalPaid / totalActual) * 100)) : 0;
  const isOverBudget = totalActual > totalEstimated && totalEstimated > 0;

  const filteredItems = filterStatus === "All"
    ? budgetItems
    : budgetItems.filter((item) => getItemStatus(item) === filterStatus);

  const getVendor = (vid: string | null) => vendors.find((v) => v.id === vid);

  // Chart data: group by category
  const categoryTotals: Record<string, number> = {};
  budgetItems.forEach((item) => {
    const cat = item.category || "General";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(item.actual_cost) || 0);
  });
  const chartCategories = Object.entries(categoryTotals).filter(([, v]) => v > 0);
  const chartTotal = chartCategories.reduce((s, [, v]) => s + v, 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  // SVG Pie Chart
  const renderPieChart = () => {
    if (chartCategories.length === 0) {
      return <p className="text-center text-subtle py-8">No spending data yet.</p>;
    }

    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const r = 80;
    let cumAngle = -Math.PI / 2;

    const slices = chartCategories.map(([cat, val], i) => {
      const fraction = val / chartTotal;
      const startAngle = cumAngle;
      const sweepAngle = fraction * 2 * Math.PI;
      cumAngle += sweepAngle;
      const endAngle = cumAngle;

      const largeArc = sweepAngle > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const color = VENDOR_COLORS[i % VENDOR_COLORS.length];

      // If only one category, draw a full circle
      if (chartCategories.length === 1) {
        return (
          <circle key={cat} cx={cx} cy={cy} r={r} fill={color} />
        );
      }

      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return <path key={cat} d={d} fill={color} />;
    });

    return (
      <div className="flex flex-col items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-48 h-48">
          {slices}
        </svg>
        <div className="flex flex-wrap gap-3 justify-center">
          {chartCategories.map(([cat, val], i) => (
            <div key={cat} className="flex items-center gap-1.5 text-sm">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: VENDOR_COLORS[i % VENDOR_COLORS.length] }} />
              <span className="text-body">{cat}</span>
              <span className="text-subtle">{formatCurrency(val)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // SVG Bar Chart
  const renderBarChart = () => {
    if (budgetItems.length === 0) {
      return <p className="text-center text-subtle py-8">No budget items yet.</p>;
    }

    const items = budgetItems;
    const maxVal = Math.max(...items.map((i) => Math.max(parseFloat(i.estimated_cost) || 0, parseFloat(i.actual_cost) || 0)), 1);

    const barWidth = 24;
    const gap = 12;
    const groupWidth = barWidth * 2 + gap;
    const chartWidth = Math.max(items.length * groupWidth + 60, 300);
    const chartHeight = 180;
    const topPad = 10;
    const bottomPad = 50;
    const leftPad = 50;
    const drawHeight = chartHeight - topPad - bottomPad;

    // Y-axis scale
    const yTicks = 4;
    const yLines = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = (maxVal / yTicks) * i;
      const y = topPad + drawHeight - (drawHeight * (val / maxVal));
      return { val, y };
    });

    return (
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48" style={{ minWidth: `${chartWidth}px` }} preserveAspectRatio="xMinYMid meet">
          {/* Y-axis lines and labels */}
          {yLines.map(({ val, y }) => (
            <g key={val}>
              <line x1={leftPad} y1={y} x2={chartWidth - 10} y2={y} stroke="currentColor" strokeOpacity={0.1} />
              <text x={leftPad - 5} y={y + 4} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity={0.5}>
                {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {items.map((item, idx) => {
            const est = parseFloat(item.estimated_cost) || 0;
            const act = parseFloat(item.actual_cost) || 0;
            const x = leftPad + idx * groupWidth + gap / 2;
            const estH = (est / maxVal) * drawHeight;
            const actH = (act / maxVal) * drawHeight;

            return (
              <g key={item.id}>
                {/* Estimated bar */}
                <rect
                  x={x}
                  y={topPad + drawHeight - estH}
                  width={barWidth}
                  height={estH}
                  fill="currentColor"
                  fillOpacity={0.15}
                  rx={2}
                />
                {/* Actual bar */}
                <rect
                  x={x + barWidth}
                  y={topPad + drawHeight - actH}
                  width={barWidth}
                  height={actH}
                  fill={act > est && est > 0 ? "#EF4444" : "#F43F5E"}
                  fillOpacity={0.7}
                  rx={2}
                />
                {/* Label */}
                <text
                  x={x + barWidth}
                  y={topPad + drawHeight + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                  fillOpacity={0.6}
                  transform={`rotate(25, ${x + barWidth}, ${topPad + drawHeight + 14})`}
                >
                  {item.description.length > 10 ? item.description.slice(0, 10) + "…" : item.description}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 justify-center mt-2 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-current opacity-15" /> Estimated
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#F43F5E", opacity: 0.7 }} /> Actual
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl lg:max-w-4xl mx-auto p-6">

        {/* A. Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-heading">Budget</h1>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Link href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</Link>
          </div>
        </div>

        {/* B. Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-heading">{formatCurrency(totalEstimated)}</p>
            <p className="text-xs text-subtle">Total Budget</p>
          </div>
          <div className={`bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center ${isOverBudget ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800" : ""}`}>
            <p className={`text-2xl font-bold ${isOverBudget ? "text-red-600 dark:text-red-400" : "text-heading"}`}>
              {formatCurrency(totalActual)}
            </p>
            <p className="text-xs text-subtle">Total Spent</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-subtle">Total Paid</p>
          </div>
          <div className="bg-surface p-3 rounded-lg shadow-sm border border-app-border text-center">
            <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-amber-600 dark:text-amber-400" : "text-heading"}`}>
              {formatCurrency(Math.max(0, totalOutstanding))}
            </p>
            <p className="text-xs text-subtle">Outstanding</p>
          </div>
        </div>

        {/* Progress bar */}
        {totalActual > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-subtle mb-1">
              <span>{percentPaid}% of actual costs paid</span>
              <span>{formatCurrency(totalPaid)} / {formatCurrency(totalActual)}</span>
            </div>
            <div className="w-full bg-page-bg rounded-full h-2 border border-app-border">
              <div
                className="h-full rounded-full bg-rose-app transition-all"
                style={{ width: `${percentPaid}%` }}
              />
            </div>
          </div>
        )}

        {/* C. Chart Area */}
        <div className="bg-surface p-5 rounded-lg shadow-sm border border-app-border mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-heading">Spending Breakdown</h2>
            <div className="flex rounded-lg border border-app-border overflow-hidden">
              <button
                onClick={() => setChartType("pie")}
                className={`px-3 py-1 text-sm ${chartType === "pie" ? "bg-rose-app text-white" : "text-body hover:bg-page-bg"}`}
              >
                Pie
              </button>
              <button
                onClick={() => setChartType("bar")}
                className={`px-3 py-1 text-sm ${chartType === "bar" ? "bg-rose-app text-white" : "text-body hover:bg-page-bg"}`}
              >
                Bar
              </button>
            </div>
          </div>
          {chartType === "pie" ? renderPieChart() : renderBarChart()}
        </div>

        {/* D. Toolbar */}
        <div className="flex justify-between items-center mb-4">
          {!showForm ? (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover font-medium"
            >
              + Add Budget Item
            </button>
          ) : (
            <div />
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-app-border rounded-lg px-3 py-2 bg-surface text-body text-sm"
          >
            <option value="All">All ({budgetItems.length})</option>
            <option value="Paid">Paid ({budgetItems.filter((i) => getItemStatus(i) === "Paid").length})</option>
            <option value="Partial">Partial ({budgetItems.filter((i) => getItemStatus(i) === "Partial").length})</option>
            <option value="Unpaid">Unpaid ({budgetItems.filter((i) => getItemStatus(i) === "Unpaid").length})</option>
          </select>
        </div>

        {/* E. Form */}
        {showForm && (
          <div className="bg-surface p-5 rounded-lg shadow border border-app-border mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-heading">{editingId ? "Edit Budget Item" : "Add Budget Item"}</h2>
              <button onClick={resetForm} className="text-subtle hover:text-body text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Row 1: Description + Category */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-[2]">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder='e.g., "Wedding venue deposit"' required
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">
                    {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Vendor + Contract Date */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Vendor</label>
                  <select value={vendorId} onChange={(e) => handleVendorChange(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">
                    <option value="">— None —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Contract Date</label>
                  <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
              </div>

              {/* Row 3: Estimated + Actual */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Estimated Cost</label>
                  <input type="number" step="0.01" min="0" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="0.00" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Actual Cost</label>
                  <input type="number" step="0.01" min="0" value={actualCost} onChange={(e) => setActualCost(e.target.value)}
                    placeholder="0.00" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
              </div>

              {/* Row 4: Deposit + Deposit Date */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Deposit Amount</label>
                  <input type="number" step="0.01" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Deposit Date</label>
                  <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
              </div>

              {/* Row 5: Amount Paid + Payment Due Date */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Amount Paid</label>
                  <input type="number" step="0.01" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-subtle uppercase mb-1">Payment Due Date</label>
                  <input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)}
                    className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
                </div>
              </div>

              {/* Row 6: Notes */}
              <div>
                <label className="block text-xs font-semibold text-subtle uppercase mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment schedule, contract terms..." rows={2}
                  className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" />
              </div>

              {/* Row 7: Submit + Cancel */}
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover font-medium">
                  {editingId ? "Save Changes" : "+ Add Item"}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 border border-app-border rounded-lg text-body hover:bg-page-bg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* F. Budget Items List */}
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const vendor = getVendor(item.vendor_id);
            const estimated = parseFloat(item.estimated_cost) || 0;
            const actual = parseFloat(item.actual_cost) || 0;
            const paid = parseFloat(item.amount_paid) || 0;
            const deposit = parseFloat(item.deposit_amount) || 0;
            const outstanding = Math.max(0, actual - paid);
            const itemOverBudget = actual > estimated && estimated > 0;
            const status = getItemStatus(item);

            const borderColor = vendor?.color || VENDOR_COLORS[0];

            return (
              <div key={item.id}
                className="bg-surface p-4 rounded-lg shadow-sm border-l-4 border border-app-border hover:shadow-md transition-shadow"
                style={{ borderLeftColor: borderColor }}
              >
                {/* Row 1: Description + pills + actions */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-heading">{item.description}</p>
                      {vendor && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-page-bg text-body">{vendor.name}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-page-bg text-subtle">{item.category}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button onClick={() => startEdit(item)} className="text-subtle hover:text-blue-500 text-sm px-1" title="Edit">✎</button>
                    <button onClick={() => deleteItem(item.id)} className="text-subtle hover:text-red-500 text-lg px-1" title="Delete">×</button>
                  </div>
                </div>

                {/* Row 2: Costs */}
                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                  <span className="text-body">Estimated: <span className="font-medium">{formatCurrency(estimated)}</span></span>
                  <span className="text-body">Actual: <span className={`font-medium ${itemOverBudget ? "text-red-600 dark:text-red-400" : ""}`}>{formatCurrency(actual)}</span></span>
                  {itemOverBudget && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      (+{formatCurrency(actual - estimated)} over budget)
                    </span>
                  )}
                </div>

                {/* Row 3: Deposit + Due Date */}
                {(deposit > 0 || item.payment_due_date) && (
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-subtle">
                    {deposit > 0 && (
                      <span>Deposit: {formatCurrency(deposit)}{item.deposit_date ? ` on ${item.deposit_date}` : ""}</span>
                    )}
                    {item.payment_due_date && (
                      <span>Due: {item.payment_due_date}</span>
                    )}
                  </div>
                )}

                {/* Row 4: Payment status */}
                <div className="flex items-center gap-3 mt-2">
                  {status === "Paid" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-medium">
                      Paid in Full
                    </span>
                  )}
                  {status === "Partial" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-medium">
                      Partially Paid
                    </span>
                  )}
                  {status === "Unpaid" && actual > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-medium">
                      Unpaid
                    </span>
                  )}
                  {outstanding > 0 && (
                    <span className="text-sm text-subtle">Outstanding: <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(outstanding)}</span></span>
                  )}
                </div>

                {/* Row 5: Notes */}
                {item.notes && (
                  <p className="text-sm text-subtle mt-1 italic">{item.notes}</p>
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <p className="text-center text-subtle py-8">
              {budgetItems.length === 0 ? "No budget items yet. Add your first one!" : "No items match this filter."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
