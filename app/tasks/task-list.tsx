"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CATEGORIES = [
  "General", "Venue", "Catering", "Attire", "Flowers & Decor",
  "Photography", "Music & Entertainment", "Stationery", "Legal",
  "Transportation", "Gifts & Favors"
];

const CATEGORY_COLORS: Record<string, string> = {
  "General": "bg-gray-100 text-gray-700",
  "Venue": "bg-blue-100 text-blue-700",
  "Catering": "bg-orange-100 text-orange-700",
  "Attire": "bg-purple-100 text-purple-700",
  "Flowers & Decor": "bg-pink-100 text-pink-700",
  "Photography": "bg-yellow-100 text-yellow-700",
  "Music & Entertainment": "bg-indigo-100 text-indigo-700",
  "Stationery": "bg-teal-100 text-teal-700",
  "Legal": "bg-red-100 text-red-700",
  "Transportation": "bg-cyan-100 text-cyan-700",
  "Gifts & Favors": "bg-emerald-100 text-emerald-700",
};

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
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Checklist</h1>
          <a href="/dashboard" className="text-sm text-rose-600 hover:text-rose-700">← Dashboard</a>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{completedCount} of {tasks.length} tasks complete</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-rose-500 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={addTask} className="bg-white p-4 rounded-lg shadow border mb-6">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a new task..."
              required
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button type="submit" className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700">
              Add
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-lg px-3 py-1 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border rounded-lg px-3 py-1 text-sm"
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
                    ? "bg-rose-600 text-white"
                    : "bg-white text-gray-600 border hover:bg-gray-50"
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
            <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm border flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.is_complete}
                onChange={() => toggleComplete(task.id, task.is_complete)}
                className="h-5 w-5 rounded accent-rose-600"
              />
              <div className="flex-1">
                <p className={`font-medium ${task.is_complete ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {task.title}
                </p>
                <div className="flex gap-2 items-center mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] || "bg-gray-100 text-gray-700"}`}>
                    {task.category}
                  </span>
                  <input
                    type="date"
                    value={task.due_date || ""}
                    onChange={(e) => updateDueDate(task.id, e.target.value)}
                    className="text-xs border rounded px-2 py-0.5 text-gray-500"
                  />
                </div>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-400 hover:text-red-500 text-lg"
              >
                ×
              </button>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <p className="text-center text-gray-400 py-8">No tasks yet. Add one above!</p>
          )}
        </div>
      </div>
    </div>
  );
}