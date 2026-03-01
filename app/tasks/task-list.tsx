"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ThemeSwitcher } from "@/components/theme-switcher";

const CATEGORIES = [
  "General", "Venue", "Catering", "Attire", "Flowers & Decor",
  "Photography", "Music & Entertainment", "Stationery", "Legal",
  "Transportation", "Gifts & Favors"
];

const PRIORITIES = ["Low", "Medium", "High"];

export default function TaskList({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterOwner, setFilterOwner] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const dragStartYRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const dragOffsetYRef = useRef(0);
  const rowPitchRef = useRef(60); // measured on drag start: card height + gap
  const dragMovedRef = useRef(false);
  const pendingDropRef = useRef(false);

  const router = useRouter();
  const supabase = createClient();
  const themeColors = useThemeColors();
  const CATEGORY_COLORS = themeColors.taskCategories;
  const PRIORITY_COLORS = themeColors.priorityColors;

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);
    fetchTasks(eid);
  }, []);

  // Click-outside-to-deselect
  useEffect(() => {
    if (!selectedTaskId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-detail-panel]") && !t.closest("[data-task-row]")) {
        setSelectedTaskId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedTaskId]);

  const fetchTasks = async (eid: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("event_id", eid)
      .order("sort_order", { ascending: true });
    setTasks(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setCategory("General");
    setDueDate("");
    setOwner("");
    setNotes("");
    setPriority("");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (task: any) => {
    setTitle(task.title);
    setCategory(task.category || "General");
    setDueDate(task.due_date || "");
    setOwner(task.owner || "");
    setNotes(task.notes || "");
    setPriority(task.priority || "");
    setEditingId(task.id);
    setShowForm(true);
    setSelectedTaskId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventId) return;

    const payload = {
      title: title.trim(),
      category,
      due_date: dueDate || null,
      owner: owner.trim() || null,
      notes: notes.trim() || null,
      priority: priority || null,
    };

    if (editingId) {
      await supabase
        .from("tasks")
        .update(payload)
        .eq("id", editingId);
    } else {
      const maxOrder = tasks.length > 0
        ? Math.max(...tasks.map(t => t.sort_order ?? 0))
        : -1;
      await supabase
        .from("tasks")
        .insert({
          ...payload,
          event_id: eventId,
          sort_order: maxOrder + 1,
        });
    }

    resetForm();
    fetchTasks(eventId);
  };

  const toggleComplete = async (id: string, current: boolean) => {
    if (!eventId) return;
    await supabase.from("tasks").update({ is_complete: !current }).eq("id", id);
    fetchTasks(eventId);
  };

  const deleteTask = async (id: string) => {
    if (!eventId) return;
    await supabase.from("tasks").delete().eq("id", id);
    if (selectedTaskId === id) setSelectedTaskId(null);
    fetchTasks(eventId);
  };

  // Drag-to-reorder (transform-based: card follows mouse, others slide)
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, task: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingDropRef.current) return;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    dragStartIndexRef.current = tasks.findIndex(t => t.id === task.id);
    dragOffsetYRef.current = 0;
    dragMovedRef.current = false;
    setDragOffsetY(0);

    // Measure actual row pitch (card height + gap) from the DOM
    const handle = e.currentTarget as HTMLElement;
    const taskRow = handle.closest("[data-task-row]");
    if (taskRow && taskRow.parentElement) {
      rowPitchRef.current = taskRow.parentElement.getBoundingClientRect().height + 8; // 8px = space-y-2 gap
    }

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const y = "touches" in ev ? ev.touches[0].clientY : ev.clientY;

      if (!dragMovedRef.current) {
        if (Math.abs(y - dragStartYRef.current) < 5) return;
        dragMovedRef.current = true;
        setDragId(task.id);
      }

      const delta = y - dragStartYRef.current;
      dragOffsetYRef.current = delta;
      setDragOffsetY(delta);
    };

    const onEnd = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);

      if (!dragMovedRef.current) {
        setDragId(null);
        setDragOffsetY(0);
        return;
      }

      // Compute final position
      const fromIndex = dragStartIndexRef.current;
      const deltaRows = Math.round(dragOffsetYRef.current / rowPitchRef.current);
      const toIndex = Math.max(0, Math.min(tasks.length - 1, fromIndex + deltaRows));

      if (fromIndex !== toIndex) {
        // Immediately reorder local state so the DOM updates in-place
        const reordered = [...tasks];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        setTasks(reordered.map((t, i) => ({ ...t, sort_order: i })));

        // Clear drag state — card is now in its correct DOM position
        setDragId(null);
        setDragOffsetY(0);

        // Persist to DB in background
        const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
        Promise.all(
          updates.map(u =>
            supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)
          )
        ).then(() => {
          if (eventId) fetchTasks(eventId);
        });
      } else {
        setDragId(null);
        setDragOffsetY(0);
      }

      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }, [tasks, eventId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  // Filters — triple AND
  const filtersActive = filterCategory !== "All" || filterOwner !== "All" || filterPriority !== "All" || filterStatus !== "All";
  const filteredTasks = tasks.filter(t => {
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterOwner !== "All" && (t.owner || "") !== filterOwner) return false;
    if (filterPriority !== "All" && (t.priority || "") !== filterPriority) return false;
    if (filterStatus === "Complete" && !t.is_complete) return false;
    if (filterStatus === "Incomplete" && t.is_complete) return false;
    return true;
  });

  // Drag: compute which index the dragged card would land at
  const dragFromIndex = dragStartIndexRef.current;
  const dragTargetIndex = dragId
    ? Math.max(0, Math.min(filteredTasks.length - 1, dragFromIndex + Math.round(dragOffsetY / rowPitchRef.current)))
    : dragFromIndex;

  const completedCount = tasks.filter(t => t.is_complete).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Category counts
  const categoryCounts: Record<string, number> = { All: tasks.length };
  tasks.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  // Owner list for datalist and filter
  const ownerList = [...new Set(tasks.map(t => t.owner).filter(Boolean))] as string[];

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  const renderDetailPanel = () => {
    if (!selectedTask) return null;
    return (
      <div className="bg-surface rounded-lg shadow-lg border border-app-border overflow-hidden" data-detail-panel>
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-heading">{selectedTask.title}</h3>
            <button onClick={() => setSelectedTaskId(null)} className="text-subtle hover:text-body text-xl">×</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-subtle w-20">Status</span>
              <span className={`font-medium ${selectedTask.is_complete ? "text-green-600 dark:text-green-400" : "text-heading"}`}>
                {selectedTask.is_complete ? "Complete" : "Incomplete"}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-subtle w-20">Category</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[selectedTask.category] || CATEGORY_COLORS.General}`}>
                {selectedTask.category}
              </span>
            </div>
            {selectedTask.priority && (
              <div className="flex gap-2">
                <span className="text-subtle w-20">Priority</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[selectedTask.priority.toLowerCase()] || ""}`}>
                  {selectedTask.priority}
                </span>
              </div>
            )}
            {selectedTask.owner && (
              <div className="flex gap-2">
                <span className="text-subtle w-20">Owner</span>
                <span className="text-body">@ {selectedTask.owner}</span>
              </div>
            )}
            {selectedTask.due_date && (
              <div className="flex gap-2">
                <span className="text-subtle w-20">Due</span>
                <span className="text-body">{selectedTask.due_date}</span>
              </div>
            )}
            {selectedTask.notes && (
              <div>
                <span className="text-subtle">Notes</span>
                <p className="mt-1 bg-page-bg p-2 rounded text-body whitespace-pre-wrap">{selectedTask.notes}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-app-border">
            <button onClick={() => startEdit(selectedTask)} className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover text-sm font-medium">Edit</button>
            <button onClick={() => deleteTask(selectedTask.id)} className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm">Delete</button>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div className="bg-surface p-5 rounded-lg shadow border border-app-border mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-heading">{editingId ? "Edit Task" : "Add Task"}</h2>
        <button onClick={resetForm} className="text-subtle hover:text-body text-xl">×</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Mobile: stacked | Desktop: Title + Category row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="lg:flex-[2]">
            <label className="block text-xs font-semibold text-subtle uppercase mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
          </div>
          <div className="lg:flex-1">
            <label className="block text-xs font-semibold text-subtle uppercase mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {/* Mobile: pairs | Desktop: Date + Owner + Priority row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex gap-3 lg:contents">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-subtle uppercase mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-subtle uppercase mb-1">Owner</label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="Who's responsible?"
                list="owner-suggestions"
                className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
              />
              <datalist id="owner-suggestions">
                {ownerList.map(o => <option key={o} value={o} />)}
              </datalist>
            </div>
          </div>
          <div className="lg:flex-1">
            <label className="block text-xs font-semibold text-subtle uppercase mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            >
              <option value="">None</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {/* Mobile: stacked | Desktop: Notes + buttons row */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="lg:flex-1">
            <label className="block text-xs font-semibold text-subtle uppercase mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
          </div>
          <div className="flex gap-2 shrink-0 lg:pb-0.5">
            <button type="submit" className="flex-1 lg:flex-none bg-rose-app text-white px-5 py-2 rounded-lg hover:bg-rose-app-hover font-medium">
              {editingId ? "Save Changes" : "Add Task"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-app-border rounded-lg text-body hover:bg-page-bg">
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-heading">Checklist</h1>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <a href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</a>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-body mb-1">
            <span>{completedCount} of {tasks.length} tasks complete</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-app-border rounded-full h-3">
            <div
              className="bg-rose-app h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Toolbar: Add + Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <button
            onClick={() => {
              if (showForm && !editingId) { resetForm(); } else { resetForm(); setShowForm(true); setSelectedTaskId(null); }
            }}
            className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover font-medium text-sm"
          >
            + Add Task
          </button>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="border border-app-border rounded-lg px-3 py-1.5 text-sm bg-surface text-heading"
          >
            <option value="All">Category: All ({tasks.length})</option>
            {CATEGORIES.map(c => {
              const count = categoryCounts[c] || 0;
              if (count === 0) return null;
              return <option key={c} value={c}>{c} ({count})</option>;
            })}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-app-border rounded-lg px-3 py-1.5 text-sm bg-surface text-heading"
          >
            <option value="All">Status: All</option>
            <option value="Incomplete">Incomplete ({tasks.length - completedCount})</option>
            <option value="Complete">Complete ({completedCount})</option>
          </select>

          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="border border-app-border rounded-lg px-3 py-1.5 text-sm bg-surface text-heading"
          >
            <option value="All">Owner: All</option>
            {ownerList.map(o => <option key={o} value={o}>@ {o}</option>)}
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="border border-app-border rounded-lg px-3 py-1.5 text-sm bg-surface text-heading"
          >
            <option value="All">Priority: All</option>
            {PRIORITIES.map(p => {
              const count = tasks.filter(t => t.priority === p).length;
              if (count === 0) return null;
              return <option key={p} value={p}>{p} ({count})</option>;
            })}
          </select>

          {filtersActive && (
            <button
              onClick={() => { setFilterCategory("All"); setFilterStatus("All"); setFilterOwner("All"); setFilterPriority("All"); }}
              className="text-xs text-rose-app hover:text-rose-app-hover font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Mobile form overlay */}
        {showForm && (
          <div className="lg:hidden fixed inset-0 bg-page-bg z-50 overflow-y-auto p-4">
            {renderForm()}
          </div>
        )}

        <div className="flex gap-6">
          {/* Task List */}
          <div className="flex-1 min-w-0">
            <div className="space-y-2">
              {filteredTasks.map((task, idx) => {
                const isSelected = selectedTaskId === task.id;
                const isDragging = dragId === task.id;

                // Compute transform for smooth drag
                let transformY = 0;
                if (isDragging) {
                  transformY = dragOffsetY;
                } else if (dragId) {
                  const from = dragFromIndex;
                  const to = dragTargetIndex;
                  if (from < to && idx > from && idx <= to) {
                    transformY = -rowPitchRef.current;
                  } else if (from > to && idx >= to && idx < from) {
                    transformY = rowPitchRef.current;
                  }
                }

                return (
                  <div key={task.id} style={{
                    transform: transformY ? `translateY(${transformY}px)` : undefined,
                    transition: dragId
                      ? (isDragging ? 'none' : 'transform 0.2s ease')
                      : undefined,
                    zIndex: isDragging ? 50 : undefined,
                    position: 'relative',
                  }}>
                    <div
                      className={
                        "bg-surface p-3 shadow-sm border border-app-border flex items-center gap-3 cursor-pointer " +
                        (isSelected ? "rounded-t-lg lg:rounded-lg border-b-0 lg:border-b ring-2 ring-rose-400 " : "rounded-lg ") +
                        (isDragging ? "shadow-lg ring-2 ring-amber-400 scale-[1.02] " : "")
                      }
                      style={isDragging ? { backgroundColor: themeColors.surfaces.dragHighlight } : undefined}
                      onClick={() => {
                        if (!dragId && !dragMovedRef.current) {
                          setSelectedTaskId(isSelected ? null : task.id);
                          setShowForm(false);
                        }
                      }}
                      data-task-row
                    >
                      {/* Drag handle — hidden when filters active */}
                      {!filtersActive && (
                        <div
                          className="w-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none text-subtle hover:text-body rounded hover:bg-page-bg py-2"
                          onMouseDown={e => handleDragStart(e, task)}
                          onTouchStart={e => handleDragStart(e, task)}
                        >
                          <span className="text-sm">⠿</span>
                        </div>
                      )}

                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.is_complete}
                        onChange={(e) => { e.stopPropagation(); toggleComplete(task.id, task.is_complete); }}
                        onClick={e => e.stopPropagation()}
                        className="h-5 w-5 rounded accent-rose-600 shrink-0"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${task.is_complete ? "line-through text-subtle" : "text-heading"}`}>
                          {task.title}
                        </p>
                        <div className="flex gap-1.5 items-center mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General}`}>
                            {task.category}
                          </span>
                          {task.priority && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: task.priority === "High" ? '#fee2e2' : task.priority === "Medium" ? '#fef3c7' : '#dbeafe',
                                color: task.priority === "High" ? '#b91c1c' : task.priority === "Medium" ? '#92400e' : '#1d4ed8',
                              }}
                            >
                              {task.priority}
                            </span>
                          )}
                          {task.owner && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                              @ {task.owner}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {task.due_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile inline detail panel — connected to card above */}
                    {isSelected && selectedTask && (
                      <div className="lg:hidden bg-surface border border-app-border border-t-0 rounded-b-lg ring-2 ring-rose-400 ring-t-0 p-4" data-detail-panel>
                        <div className="border-t border-app-border pt-3 space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-subtle w-20">Status</span>
                            <span className={`font-medium ${selectedTask.is_complete ? "text-green-600 dark:text-green-400" : "text-heading"}`}>
                              {selectedTask.is_complete ? "Complete" : "Incomplete"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-subtle w-20">Category</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[selectedTask.category] || CATEGORY_COLORS.General}`}>
                              {selectedTask.category}
                            </span>
                          </div>
                          {selectedTask.priority && (
                            <div className="flex gap-2">
                              <span className="text-subtle w-20">Priority</span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: selectedTask.priority === "High" ? '#fee2e2' : selectedTask.priority === "Medium" ? '#fef3c7' : '#dbeafe',
                                  color: selectedTask.priority === "High" ? '#b91c1c' : selectedTask.priority === "Medium" ? '#92400e' : '#1d4ed8',
                                }}
                              >
                                {selectedTask.priority}
                              </span>
                            </div>
                          )}
                          {selectedTask.owner && (
                            <div className="flex gap-2">
                              <span className="text-subtle w-20">Owner</span>
                              <span className="text-body">@ {selectedTask.owner}</span>
                            </div>
                          )}
                          {selectedTask.due_date && (
                            <div className="flex gap-2">
                              <span className="text-subtle w-20">Due</span>
                              <span className="text-body">{selectedTask.due_date}</span>
                            </div>
                          )}
                          {selectedTask.notes && (
                            <div>
                              <span className="text-subtle">Notes</span>
                              <p className="mt-1 bg-page-bg p-2 rounded text-body whitespace-pre-wrap">{selectedTask.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4 pt-3 border-t border-app-border">
                          <button onClick={() => startEdit(selectedTask)} className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover text-sm font-medium">Edit</button>
                          <button onClick={() => deleteTask(selectedTask.id)} className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredTasks.length === 0 && (
                <p className="text-center text-subtle py-8">
                  {tasks.length === 0 ? "No tasks yet. Add one above!" : "No tasks match the current filters."}
                </p>
              )}
            </div>
          </div>

          {/* Desktop sidebar — detail panel or form */}
          {(showForm || selectedTask) && (
            <div className={`hidden lg:block shrink-0 sticky top-6 self-start ${showForm ? "w-[560px]" : "w-[340px]"}`}>
              {showForm ? renderForm() : renderDetailPanel()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
