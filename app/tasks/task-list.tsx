"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useThemeColors } from "@/lib/use-theme-colors";

const CATEGORIES = [
  "General", "Venue", "Catering", "Attire", "Flowers & Decor",
  "Photography", "Music & Entertainment", "Stationery", "Legal",
  "Transportation", "Gifts & Favors"
];

export default function TaskList({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const themeColors = useThemeColors();
  const CATEGORY_COLORS = themeColors.taskCategories;

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);
    fetchTasks(eid);
  }, []);

  const fetchTasks = async (eid: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("event_id", eid)
      .order("created_at", { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventId) return;

    const { error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        category,
        due_date: dueDate || null,
        event_id: eventId,
      });

    if (!error) {
      setTitle("");
      setDueDate("");
      setCategory("General");
      fetchTasks(eventId);
    }
  };

  const toggleComplete = async (id: string, current: boolean) => {
    if (!eventId) return;
    await supabase.from("tasks").update({ is_complete: !current }).eq("id", id);
    fetchTasks(eventId);
  };

  const updateDueDate = async (id: string, date: string) => {
    if (!eventId) return;
    await supabase.from("tasks").update({ due_date: date || null }).eq("id", id);
    fetchTasks(eventId);
  };

  const deleteTask = async (id: string) => {
    if (!eventId) return;
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks(eventId);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  }

  const filteredTasks = filterCategory === "All"
    ? tasks
    : tasks.filter((t) => t.category === filterCategory);

  const completedCount = tasks.filter((t) => t.is_complete).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Count tasks per category
  const categoryCounts: Record<string, number> = { All: tasks.length };
  tasks.forEach((t) => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-heading">Checklist</h1>
          <a href="/dashboard" className="text-sm text-rose-app hover:text-rose-app-hover">← Dashboard</a>
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

        {/* Add Task Form */}
        <form onSubmit={addTask} className="bg-surface p-4 rounded-lg shadow border border-app-border mb-6">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a new task..."
              required
              className="flex-1 border border-app-border rounded-lg px-3 py-2 bg-surface text-heading"
            />
            <button type="submit" className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover">
              Add
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-app-border rounded-lg px-3 py-1 text-sm bg-surface text-heading"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border border-app-border rounded-lg px-3 py-1 text-sm bg-surface text-heading"
            />
          </div>
        </form>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {["All", ...CATEGORIES].map((c) => {
            const count = categoryCounts[c] || 0;
            if (c !== "All" && count === 0) return null;
            return (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`px-3 py-1 rounded-full text-sm ${
                  filterCategory === c
                    ? "bg-rose-app text-white"
                    : "bg-surface text-body border border-app-border hover:bg-page-bg"
                }`}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-surface p-3 rounded-lg shadow-sm border border-app-border flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.is_complete}
                onChange={() => toggleComplete(task.id, task.is_complete)}
                className="h-5 w-5 rounded accent-rose-600"
              />
              <div className="flex-1">
                <p className={`font-medium ${task.is_complete ? "line-through text-subtle" : "text-heading"}`}>
                  {task.title}
                </p>
                <div className="flex gap-2 items-center mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.General}`}>
                    {task.category}
                  </span>
                  <input
                    type="date"
                    value={task.due_date || ""}
                    onChange={(e) => updateDueDate(task.id, e.target.value)}
                    className="text-xs border border-app-border rounded px-2 py-0.5 text-subtle bg-surface"
                  />
                </div>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-subtle hover:text-red-500 text-lg"
              >
                ×
              </button>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <p className="text-center text-subtle py-8">No tasks yet. Add one above!</p>
          )}
        </div>
      </div>
    </div>
  );
}
