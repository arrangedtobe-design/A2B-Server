"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BlockRenderer } from "@/components/rsvp/block-renderer";
import { rsvpThemes, rsvpFontsUrl } from "@/lib/rsvp/themes";
import {
  createBlock,
  getDefaultBlocks,
  getDefaultFormConfig,
  blockLabels,
  blockDescriptions,
} from "@/lib/rsvp/blocks";
import type {
  RsvpBlock,
  RsvpTheme,
  BlockType,
  RsvpThemeName,
  RsvpFormConfig,
  RsvpEventData,
  RsvpGuestData,
  CustomQuestion,
  HeroBlockData,
  TextBlockData,
  EventDetailsBlockData,
  RsvpFormBlockData,
  PhotoBlockData,
  DividerBlockData,
} from "@/lib/rsvp/types";

interface PageState {
  id?: string;
  theme: RsvpThemeName;
  blocks: RsvpBlock[];
  couple_names: string;
  is_published: boolean;
  form_config: RsvpFormConfig;
  slug: string;
}

const allBlockTypes: BlockType[] = [
  "hero",
  "text",
  "event_details",
  "rsvp_form",
  "photo",
  "divider",
];

export default function RsvpEditor({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [page, setPage] = useState<PageState | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [event, setEvent] = useState<RsvpEventData | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [newMealOption, setNewMealOption] = useState("");
  const [newQuestionLabel, setNewQuestionLabel] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<"text" | "select">("text");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("phone-portrait");
  const [previewPartySize, setPreviewPartySize] = useState(0);
  const [undoStack, setUndoStack] = useState<PageState[]>([]);

  // Load data on mount
  useEffect(() => {
    const load = async () => {
      const eventId = localStorage.getItem("activeEventId");
      if (!eventId) {
        router.push("/");
        return;
      }

      const [{ data: eventData }, { data: pageData }] = await Promise.all([
        supabase.from("events").select("id, name, wedding_date, venue").eq("id", eventId).single(),
        supabase.from("rsvp_pages").select("*").eq("event_id", eventId).single(),
      ]);

      if (!eventData) {
        router.push("/dashboard");
        return;
      }

      setEvent({
        id: eventData.id,
        name: eventData.name,
        wedding_date: eventData.wedding_date,
        venue: eventData.venue,
      });

      if (pageData) {
        setPage({
          id: pageData.id,
          theme: pageData.theme || "romantic",
          blocks: pageData.blocks || getDefaultBlocks(),
          couple_names: pageData.couple_names || "",
          is_published: pageData.is_published || false,
          form_config: pageData.form_config || getDefaultFormConfig(),
          slug: pageData.slug || eventData.id,
        });
      } else {
        setPage({
          theme: "romantic",
          blocks: getDefaultBlocks(),
          couple_names: "",
          is_published: false,
          form_config: getDefaultFormConfig(),
          slug: eventId,
        });
      }

      setLoading(false);
    };

    load();
  }, []);

  // Show notification briefly
  const flash = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  // Push current page state onto undo stack (max 30 entries)
  const pushUndo = useCallback(() => {
    setPage((prev) => {
      if (prev) {
        setUndoStack((stack) => [...stack.slice(-29), prev]);
      }
      return prev;
    });
  }, []);

  // Undo — pop the last state from the stack
  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setPage(prev);
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, []);

  // Update page state + mark dirty
  const updatePage = useCallback((updates: Partial<PageState>) => {
    pushUndo();
    setPage((prev) => (prev ? { ...prev, ...updates } : prev));
    setDirty(true);
  }, [pushUndo]);

  // Update a specific block's data
  const updateBlockData = useCallback(
    (blockId: string, dataUpdates: Record<string, unknown>) => {
      pushUndo();
      setPage((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === blockId ? { ...b, data: { ...b.data, ...dataUpdates } } : b,
          ),
        };
      });
      setDirty(true);
    },
    [pushUndo],
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (!page || !event) return;
    setSaving(true);

    const payload = {
      event_id: event.id,
      page_type: "blocks" as const,
      theme: page.theme,
      blocks: page.blocks,
      couple_names: page.couple_names || null,
      is_published: page.is_published,
      form_config: page.form_config,
      slug: page.slug || event.id,
    };

    let error;
    if (page.id) {
      ({ error } = await supabase.from("rsvp_pages").update(payload).eq("id", page.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("rsvp_pages")
        .insert(payload)
        .select("id")
        .single();
      error = insertError;
      if (data) {
        setPage((prev) => (prev ? { ...prev, id: data.id } : prev));
      }
    }

    setSaving(false);
    if (error) {
      flash("Error saving: " + error.message);
    } else {
      setDirty(false);
      flash("Saved!");
    }
  }, [page, event, supabase, flash]);

  // Publish toggle (auto-saves)
  const togglePublish = useCallback(async () => {
    if (!page) return;
    const next = !page.is_published;
    setPage((prev) => (prev ? { ...prev, is_published: next } : prev));
    setDirty(true);
    // Auto-save after state update via effect won't work — save inline
    setSaving(true);

    const payload = {
      event_id: event!.id,
      page_type: "blocks" as const,
      theme: page.theme,
      blocks: page.blocks,
      couple_names: page.couple_names || null,
      is_published: next,
      form_config: page.form_config,
      slug: page.slug || event!.id,
    };

    let error;
    if (page.id) {
      ({ error } = await supabase.from("rsvp_pages").update(payload).eq("id", page.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("rsvp_pages")
        .insert(payload)
        .select("id")
        .single();
      error = insertError;
      if (data) setPage((prev) => (prev ? { ...prev, id: data.id } : prev));
    }

    setSaving(false);
    if (error) {
      flash("Error saving: " + error.message);
    } else {
      setDirty(false);
      flash(next ? "Published!" : "Unpublished");
    }
  }, [page, event, supabase, flash]);

  // Block operations
  const moveBlock = (index: number, dir: -1 | 1) => {
    pushUndo();
    setPage((prev) => {
      if (!prev) return prev;
      const blocks = [...prev.blocks];
      const target = index + dir;
      if (target < 0 || target >= blocks.length) return prev;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...prev, blocks };
    });
    setDirty(true);
  };

  const removeBlock = (blockId: string) => {
    pushUndo();
    setPage((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) };
    });
    if (activeBlockId === blockId) setActiveBlockId(null);
    setDirty(true);
  };

  const addBlock = (type: BlockType) => {
    pushUndo();
    const block = createBlock(type);
    setPage((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
    setActiveBlockId(block.id);
    setShowBlockPicker(false);
    setDirty(true);
  };

  // Form config helpers
  const updateFormConfig = (updates: Partial<RsvpFormConfig>) => {
    pushUndo();
    setPage((prev) =>
      prev ? { ...prev, form_config: { ...prev.form_config, ...updates } } : prev,
    );
    setDirty(true);
  };

  const addMealOption = () => {
    const opt = newMealOption.trim();
    if (!opt || !page) return;
    if (page.form_config.mealOptions.includes(opt)) return;
    updateFormConfig({ mealOptions: [...page.form_config.mealOptions, opt] });
    setNewMealOption("");
  };

  const removeMealOption = (opt: string) => {
    if (!page) return;
    updateFormConfig({ mealOptions: page.form_config.mealOptions.filter((m) => m !== opt) });
  };

  const addCustomQuestion = () => {
    const label = newQuestionLabel.trim();
    if (!label || !page) return;
    const q: CustomQuestion = {
      id: `q_${Date.now()}`,
      label,
      type: newQuestionType,
      options: newQuestionType === "select" ? [] : undefined,
      required: false,
    };
    updateFormConfig({ customQuestions: [...page.form_config.customQuestions, q] });
    setNewQuestionLabel("");
    setNewQuestionType("text");
  };

  const updateQuestion = (qId: string, updates: Partial<CustomQuestion>) => {
    if (!page) return;
    updateFormConfig({
      customQuestions: page.form_config.customQuestions.map((q) =>
        q.id === qId ? { ...q, ...updates } : q,
      ),
    });
  };

  const removeQuestion = (qId: string) => {
    if (!page) return;
    updateFormConfig({
      customQuestions: page.form_config.customQuestions.filter((q) => q.id !== qId),
    });
  };

  // ── Loading / no page ──
  if (loading || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>
    );
  }

  const theme = rsvpThemes[page.theme];
  const activeBlock = page.blocks.find((b) => b.id === activeBlockId) || null;

  const partyLabels = ["Spouse", "Child", "Guest", "Guest"];
  const mockGuest: RsvpGuestData = {
    id: "preview",
    name: "Guest Name",
    party_members: Array.from({ length: previewPartySize }, (_, i) => ({
      name: `Party Member ${i + 1}`,
      label: partyLabels[i] || "Guest",
    })),
  };
  const mockToken = {
    id: "preview",
    guest_id: "preview",
    event_id: event?.id || "",
    token: "preview",
  };

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-30 bg-surface border-b border-app-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-subtle hover:text-body text-sm shrink-0">
            &larr; Dashboard
          </Link>
          <h1 className="text-lg font-bold text-heading truncate">RSVP Editor</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {notification && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              {notification}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-rose-app text-white hover:bg-rose-app-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : dirty ? "Save *" : "Save"}
          </button>
          <button
            onClick={togglePublish}
            disabled={saving}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              page.is_published
                ? "border-green-500 text-green-700 bg-green-50 hover:bg-green-100"
                : "border-app-border text-subtle hover:bg-surface"
            }`}
          >
            {page.is_published ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* ── Left Panel ── */}
        <div className="md:w-[420px] md:shrink-0 overflow-y-auto border-r border-app-border p-4 space-y-6">
          {/* 1. Page Settings */}
          <section>
            <h2 className="text-sm font-semibold text-heading mb-3 uppercase tracking-wide">
              Page Settings
            </h2>
            <label className="block text-sm text-body mb-1">Couple Names</label>
            <input
              type="text"
              value={page.couple_names}
              onChange={(e) => updatePage({ couple_names: e.target.value })}
              placeholder="e.g. Sarah & James"
              className="w-full px-3 py-2 text-sm border border-app-border rounded-md bg-surface text-body focus:outline-none focus:ring-1 focus:ring-rose-app"
            />

            <label className="block text-sm text-body mt-3 mb-1">Theme</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(rsvpThemes) as RsvpThemeName[]).map((key) => (
                <button
                  key={key}
                  onClick={() => updatePage({ theme: key })}
                  className={`px-2 py-2 text-xs font-medium rounded-md border-2 transition-colors ${
                    page.theme === key
                      ? "border-rose-app bg-rose-50 text-rose-app"
                      : "border-app-border text-subtle hover:border-rose-app/40"
                  }`}
                >
                  {rsvpThemes[key].label}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Block List */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                Blocks
              </h2>
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className="text-xs font-medium px-2 py-1 rounded border border-app-border text-body hover:bg-page-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={undoStack.length > 0 ? `Undo (${undoStack.length})` : "Nothing to undo"}
              >
                Undo
              </button>
            </div>
            <div className="space-y-1">
              {page.blocks.map((block, idx) => (
                <div
                  key={block.id}
                  onClick={() =>
                    setActiveBlockId(activeBlockId === block.id ? null : block.id)
                  }
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                    activeBlockId === block.id
                      ? "bg-rose-50 border border-rose-app/30 text-rose-app"
                      : "bg-surface border border-app-border text-body hover:bg-page-bg"
                  }`}
                >
                  <span className="font-medium truncate">{blockLabels[block.type]}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(idx, -1);
                      }}
                      disabled={idx === 0}
                      className="p-1 text-xs hover:bg-black/5 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(idx, 1);
                      }}
                      disabled={idx === page.blocks.length - 1}
                      className="p-1 text-xs hover:bg-black/5 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      &#9660;
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                      className="p-1 text-xs text-red-500 hover:bg-red-50 rounded"
                      title="Remove block"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showBlockPicker ? (
              <div className="mt-2 border border-app-border rounded-md bg-surface p-2 space-y-1">
                {allBlockTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => addBlock(type)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-page-bg transition-colors"
                  >
                    <span className="font-medium text-heading">{blockLabels[type]}</span>
                    <span className="text-xs text-subtle ml-2">{blockDescriptions[type]}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowBlockPicker(false)}
                  className="w-full text-center text-xs text-subtle py-1 hover:text-body"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBlockPicker(true)}
                className="mt-2 w-full py-2 text-sm font-medium border border-dashed border-app-border rounded-md text-subtle hover:text-body hover:border-rose-app/40 transition-colors"
              >
                + Add Block
              </button>
            )}
          </section>

          {/* 3. Block Editor */}
          {activeBlock && (
            <section>
              <h2 className="text-sm font-semibold text-heading mb-3 uppercase tracking-wide">
                Edit: {blockLabels[activeBlock.type]}
              </h2>
              <BlockEditorFields
                block={activeBlock}
                onUpdate={(updates) => updateBlockData(activeBlock.id, updates)}
              />
            </section>
          )}

          {/* 4. Form Configuration */}
          <section>
            <h2 className="text-sm font-semibold text-heading mb-3 uppercase tracking-wide">
              Form Configuration
            </h2>

            {/* Meal preference */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-body mb-2">
                <input
                  type="checkbox"
                  checked={page.form_config.showMealPreference}
                  onChange={(e) => updateFormConfig({ showMealPreference: e.target.checked })}
                  className="rounded"
                />
                Meal Preference
              </label>
              {page.form_config.showMealPreference && (
                <div className="ml-6 space-y-1">
                  {page.form_config.mealOptions.map((opt) => (
                    <div key={opt} className="flex items-center gap-2 text-sm">
                      <span className="text-body">{opt}</span>
                      <button
                        onClick={() => removeMealOption(opt)}
                        className="text-red-500 text-xs hover:text-red-700"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={newMealOption}
                      onChange={(e) => setNewMealOption(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addMealOption()}
                      placeholder="Add option..."
                      className="flex-1 px-2 py-1 text-sm border border-app-border rounded bg-surface text-body focus:outline-none focus:ring-1 focus:ring-rose-app"
                    />
                    <button
                      onClick={addMealOption}
                      className="px-2 py-1 text-sm bg-rose-app text-white rounded hover:bg-rose-app-hover"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dietary notes */}
            <label className="flex items-center gap-2 text-sm text-body mb-4">
              <input
                type="checkbox"
                checked={page.form_config.showDietaryNotes}
                onChange={(e) => updateFormConfig({ showDietaryNotes: e.target.checked })}
                className="rounded"
              />
              Dietary Notes
            </label>

            {/* Custom questions */}
            <div>
              <h3 className="text-sm font-medium text-heading mb-2">Custom Questions</h3>
              <div className="space-y-3">
                {page.form_config.customQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="border border-app-border rounded-md p-3 bg-surface space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-app-border rounded bg-page-bg text-body focus:outline-none focus:ring-1 focus:ring-rose-app"
                        placeholder="Question label"
                      />
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className="text-red-500 text-xs hover:text-red-700 p-1"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            type: e.target.value as "text" | "select",
                            options: e.target.value === "select" ? q.options || [] : undefined,
                          })
                        }
                        className="px-2 py-1 text-sm border border-app-border rounded bg-page-bg text-body focus:outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="select">Select</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-subtle">
                        <input
                          type="checkbox"
                          checked={q.required || false}
                          onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    {q.type === "select" && (
                      <QuestionOptionsEditor
                        options={q.options || []}
                        onChange={(opts) => updateQuestion(q.id, { options: opts })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-2">
                <input
                  type="text"
                  value={newQuestionLabel}
                  onChange={(e) => setNewQuestionLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomQuestion()}
                  placeholder="New question label..."
                  className="flex-1 px-2 py-1 text-sm border border-app-border rounded bg-surface text-body focus:outline-none focus:ring-1 focus:ring-rose-app"
                />
                <select
                  value={newQuestionType}
                  onChange={(e) => setNewQuestionType(e.target.value as "text" | "select")}
                  className="px-2 py-1 text-sm border border-app-border rounded bg-surface text-body focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="select">Select</option>
                </select>
                <button
                  onClick={addCustomQuestion}
                  className="px-2 py-1 text-sm bg-rose-app text-white rounded hover:bg-rose-app-hover"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right Panel — Live Preview ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100/50">
          <div className="md:sticky md:top-0">
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wide">
                  Live Preview
                </h2>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-heading font-medium">Party</span>
                  <div className="flex border border-app-border rounded-md overflow-hidden">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPreviewPartySize(n)}
                        className={`px-2.5 py-1.5 font-medium transition-colors ${
                          previewPartySize === n
                            ? "bg-rose-app text-white"
                            : "bg-surface text-body hover:bg-page-bg"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex border border-app-border rounded-md overflow-hidden text-xs w-fit">
                {([
                  { key: "phone-portrait" as PreviewMode, label: "Phone" },
                  { key: "phone-landscape" as PreviewMode, label: "Phone \u2194" },
                  { key: "tablet-portrait" as PreviewMode, label: "Tablet" },
                  { key: "tablet-landscape" as PreviewMode, label: "Tablet \u2194" },
                  { key: "desktop" as PreviewMode, label: "Desktop" },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPreviewMode(key)}
                    className={`px-2.5 py-1.5 font-medium transition-colors ${
                      previewMode === key
                        ? "bg-rose-app text-white"
                        : "bg-surface text-body hover:bg-page-bg"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <PreviewFrame
              mode={previewMode}
              theme={theme}
              fontsUrl={rsvpFontsUrl}
              blocks={page.blocks}
              event={event}
              mockGuest={mockGuest}
              mockToken={mockToken}
              formConfig={page.form_config}
              coupleNames={page.couple_names || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Block Editor Fields ──────────────────────────────────────

function BlockEditorFields({
  block,
  onUpdate,
}: {
  block: RsvpBlock;
  onUpdate: (updates: Record<string, unknown>) => void;
}) {
  const inputClass =
    "w-full px-3 py-2 text-sm border border-app-border rounded-md bg-surface text-body focus:outline-none focus:ring-1 focus:ring-rose-app";

  switch (block.type) {
    case "hero": {
      const data = block.data as HeroBlockData;
      return (
        <div className="space-y-3">
          <Field label="Overlay Text">
            <input
              type="text"
              value={data.overlayText || ""}
              onChange={(e) => onUpdate({ overlayText: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Subtitle">
            <input
              type="text"
              value={data.subtitle || ""}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Image URL">
            <input
              type="text"
              value={data.imageUrl || ""}
              onChange={(e) => onUpdate({ imageUrl: e.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
          <Field label={`Overlay Opacity: ${data.overlayOpacity ?? 40}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={data.overlayOpacity ?? 40}
              onChange={(e) => onUpdate({ overlayOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
        </div>
      );
    }

    case "text": {
      const data = block.data as TextBlockData;
      return (
        <div className="space-y-3">
          <Field label="Content">
            <textarea
              value={data.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={3}
              className={inputClass}
              style={{ resize: "vertical" }}
            />
          </Field>
          <Field label="Alignment">
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onUpdate({ alignment: a })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                    data.alignment === a
                      ? "border-rose-app bg-rose-50 text-rose-app"
                      : "border-app-border text-subtle hover:text-body"
                  }`}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Size">
            <select
              value={data.size || "md"}
              onChange={(e) => onUpdate({ size: e.target.value })}
              className={inputClass}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </Field>
        </div>
      );
    }

    case "event_details": {
      const data = block.data as EventDetailsBlockData;
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={data.showDate ?? true}
              onChange={(e) => onUpdate({ showDate: e.target.checked })}
              className="rounded"
            />
            Show Date
          </label>
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={data.showVenue ?? true}
              onChange={(e) => onUpdate({ showVenue: e.target.checked })}
              className="rounded"
            />
            Show Venue
          </label>
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={data.showTime ?? true}
              onChange={(e) => onUpdate({ showTime: e.target.checked })}
              className="rounded"
            />
            Show Time
          </label>
          <Field label="Custom Text">
            <input
              type="text"
              value={data.customText || ""}
              onChange={(e) => onUpdate({ customText: e.target.value })}
              placeholder="Optional extra text..."
              className={inputClass}
            />
          </Field>
        </div>
      );
    }

    case "rsvp_form": {
      const data = block.data as RsvpFormBlockData;
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <input
              type="text"
              value={data.heading || ""}
              onChange={(e) => onUpdate({ heading: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              value={data.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      );
    }

    case "photo": {
      const data = block.data as PhotoBlockData;
      return (
        <div className="space-y-3">
          <Field label="Image URL">
            <input
              type="text"
              value={data.imageUrl || ""}
              onChange={(e) => onUpdate({ imageUrl: e.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
          <Field label="Caption">
            <input
              type="text"
              value={data.caption || ""}
              onChange={(e) => onUpdate({ caption: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Aspect Ratio">
            <select
              value={data.aspectRatio || "auto"}
              onChange={(e) => onUpdate({ aspectRatio: e.target.value })}
              className={inputClass}
            >
              <option value="auto">Auto</option>
              <option value="square">Square</option>
              <option value="wide">Wide</option>
            </select>
          </Field>
        </div>
      );
    }

    case "divider": {
      const data = block.data as DividerBlockData;
      return (
        <div className="space-y-3">
          <Field label="Style">
            <select
              value={data.style || "line"}
              onChange={(e) => onUpdate({ style: e.target.value })}
              className={inputClass}
            >
              <option value="line">Line</option>
              <option value="dots">Dots</option>
              <option value="flourish">Flourish</option>
              <option value="space">Space</option>
            </select>
          </Field>
        </div>
      );
    }

    default:
      return null;
  }
}

// ── Reusable field wrapper ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-body mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Preview Frame — handles portrait / landscape / desktop sizing ──
//
// Phone Portrait:    390×844 device frame with internal scroll
// Phone Landscape:   844×390 device frame with internal scroll
// Tablet Portrait:   820×1180 device frame (iPad) with internal scroll
// Tablet Landscape:  1180×820 device frame (iPad) with internal scroll
// Desktop:           1280px wide, scaled to fit panel, no fixed height

type PreviewMode = "phone-portrait" | "phone-landscape" | "tablet-portrait" | "tablet-landscape" | "desktop";

const DEVICE_SIZES: Record<PreviewMode, { w: number; h: number }> = {
  "phone-portrait":    { w: 390, h: 844 },
  "phone-landscape":   { w: 844, h: 390 },
  "tablet-portrait":   { w: 820, h: 1180 },
  "tablet-landscape":  { w: 1180, h: 820 },
  "desktop":           { w: 1280, h: 0 },
};

function PreviewFrame({
  mode,
  theme,
  fontsUrl,
  blocks,
  event,
  mockGuest,
  mockToken,
  formConfig,
  coupleNames,
}: {
  mode: PreviewMode;
  theme: RsvpTheme;
  fontsUrl: string;
  blocks: RsvpBlock[];
  event: RsvpEventData | null;
  mockGuest: RsvpGuestData;
  mockToken: { id: string; guest_id: string; event_id: string; token: string };
  formConfig: RsvpFormConfig;
  coupleNames: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  const device = DEVICE_SIZES[mode];
  const isPhone = mode === "phone-portrait" || mode === "phone-landscape";
  const isTablet = mode === "tablet-portrait" || mode === "tablet-landscape";
  const isDevice = isPhone || isTablet;
  const isLandscape = mode === "phone-landscape" || mode === "tablet-landscape";

  // Bezel padding for device modes
  const BEZEL = 12;
  const totalW = isDevice ? device.w + BEZEL * 2 : device.w;

  // Measure available width → compute scale to fit
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recalc = () => {
      const available = container.clientWidth;
      setScale(Math.min(1, available / totalW));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [mode, totalW]);

  // For desktop mode, track content height so wrapper can collapse
  useEffect(() => {
    if (isDevice) return;
    const el = contentRef.current;
    if (!el) return;

    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDevice, blocks, formConfig, mockGuest]);

  const scaledWidth = device.w * scale;
  const scaledHeight = isDevice ? device.h * scale : contentHeight * scale;

  const blockContent = (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href={fontsUrl} />
      <div style={{ fontFamily: theme.fonts.body }}>
        {blocks.map((block) => (
          <BlockRenderer
            key={`${block.id}-p${mockGuest.party_members?.length ?? 0}`}
            block={block}
            theme={theme}
            event={event || { id: "", name: "", wedding_date: null, venue: null }}
            guest={mockGuest}
            token={mockToken}
            formConfig={formConfig}
            existingResponse={null}
            coupleNames={coupleNames}
          />
        ))}
        {blocks.length === 0 && (
          <div className="p-12 text-center text-sm" style={{ color: theme.colors.muted }}>
            No blocks yet. Add one from the left panel.
          </div>
        )}
      </div>
    </>
  );

  if (isDevice) {
    const isPortrait = !isLandscape;
    const shellW = device.w + BEZEL * 2;
    const shellH = device.h + BEZEL * 2;
    const scaledShellW = shellW * scale;
    const scaledShellH = shellH * scale;

    // Shared status bar icons
    const statusIcons = (iconScale: number) => (
      <div className="flex items-center" style={{ gap: 5 * iconScale }}>
        <svg width={17 * iconScale} height={12 * iconScale} viewBox="0 0 17 12" fill="none">
          <rect x="0" y="9" width="3" height="3" rx="0.5" fill={theme.colors.text} />
          <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill={theme.colors.text} />
          <rect x="9" y="3" width="3" height="9" rx="0.5" fill={theme.colors.text} />
          <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill={theme.colors.text} />
        </svg>
        <svg width={16 * iconScale} height={12 * iconScale} viewBox="0 0 16 12" fill="none">
          <path d="M8 11.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" fill={theme.colors.text} />
          <path d="M4.7 8.2a4.7 4.7 0 016.6 0" stroke={theme.colors.text} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M2.2 5.7a8 8 0 0111.6 0" stroke={theme.colors.text} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <svg width={27 * iconScale} height={12 * iconScale} viewBox="0 0 27 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke={theme.colors.text} strokeOpacity="0.35" />
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill={theme.colors.text} />
          <path d="M24 4v4a2 2 0 000-4z" fill={theme.colors.text} fillOpacity="0.35" />
        </svg>
      </div>
    );

    // Corner radius: iPhone = 44, iPad = 18
    const screenRadius = isPhone ? 44 : 18;
    const frameRadius = isPhone ? 54 : 26;

    // ── Build screen inner chrome ──
    let screenContent: React.ReactNode;

    if (isPhone && isPortrait) {
      // iPhone portrait — DI at top center, home indicator at bottom
      screenContent = (
        <div className="relative flex flex-col overflow-hidden"
          style={{ width: device.w, height: device.h, borderRadius: screenRadius, backgroundColor: "#000" }}
        >
          <div className="shrink-0 relative flex items-start justify-between"
            style={{ height: 54, padding: "14px 24px 0", backgroundColor: theme.colors.background }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: theme.colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>9:41</span>
            <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: 11, width: 126, height: 36, backgroundColor: "#000", borderRadius: 20 }} />
            {statusIcons(1)}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: theme.colors.background }}>
            {blockContent}
          </div>
          <div className="shrink-0 flex items-center justify-center" style={{ height: 34, backgroundColor: theme.colors.background }}>
            <div style={{ width: 134, height: 5, borderRadius: 100, backgroundColor: theme.colors.text, opacity: 0.2 }} />
          </div>
        </div>
      );
    } else if (isPhone && isLandscape) {
      // iPhone landscape — software UI: status bar at top, content, home indicator at bottom
      // DI inset on the left (physical top of phone), safe area on right (physical bottom)
      screenContent = (
        <div className="relative flex flex-col overflow-hidden"
          style={{ width: device.w, height: device.h, borderRadius: screenRadius, backgroundColor: "#000" }}
        >
          {/* Status bar — time on left, icons on right (DI is part of hardware frame, not shown in software UI) */}
          <div className="shrink-0 flex items-center justify-between"
            style={{ height: 32, padding: "0 20px 0 44px", backgroundColor: theme.colors.background }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>9:41</span>
            {statusIcons(0.85)}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ backgroundColor: theme.colors.background }}
          >
            {blockContent}
          </div>
          {/* Home indicator */}
          <div className="shrink-0 flex items-center justify-center" style={{ height: 20, backgroundColor: theme.colors.background }}>
            <div style={{ width: 134, height: 5, borderRadius: 100, backgroundColor: theme.colors.text, opacity: 0.2 }} />
          </div>
        </div>
      );
    } else {
      // iPad (portrait or landscape) — simple status bar at top, content, home indicator at bottom
      screenContent = (
        <div className="relative flex flex-col overflow-hidden"
          style={{ width: device.w, height: device.h, borderRadius: screenRadius, backgroundColor: "#000" }}
        >
          <div className="shrink-0 flex items-center justify-between"
            style={{ height: 24, padding: "0 20px", backgroundColor: theme.colors.background }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>9:41</span>
            {statusIcons(0.9)}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: theme.colors.background }}>
            {blockContent}
          </div>
          <div className="shrink-0 flex items-center justify-center"
            style={{ height: isPortrait ? 24 : 20, backgroundColor: theme.colors.background }}
          >
            <div style={{ width: 134, height: 5, borderRadius: 100, backgroundColor: theme.colors.text, opacity: 0.15 }} />
          </div>
        </div>
      );
    }

    // ── Build outer frame ──
    // iPhone: titanium gradient with side buttons
    // iPad: dark aluminum with simpler bezel, no side buttons
    const frameGradient = isPhone
      ? "linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 40%, #111114 100%)"
      : "linear-gradient(145deg, #3a3a3e 0%, #2a2a2e 50%, #1a1a1e 100%)";

    return (
      <div ref={containerRef}>
        <div className="mx-auto" style={{ width: scaledShellW, height: scaledShellH }}>
          <div style={{ width: shellW, height: shellH, transformOrigin: "top left", transform: `scale(${scale})` }}>
            <div
              className="relative"
              style={{
                width: shellW, height: shellH, borderRadius: frameRadius,
                background: frameGradient,
                boxShadow: "0 25px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                padding: BEZEL,
              }}
            >
              {/* Side buttons — phone only */}
              {isPhone && isPortrait && (
                <>
                  <div className="absolute bg-gray-700" style={{ right: -2, top: 140, width: 3, height: 65, borderRadius: "0 2px 2px 0" }} />
                  <div className="absolute bg-gray-700" style={{ left: -2, top: 88, width: 3, height: 22, borderRadius: "2px 0 0 2px" }} />
                  <div className="absolute bg-gray-700" style={{ left: -2, top: 120, width: 3, height: 42, borderRadius: "2px 0 0 2px" }} />
                  <div className="absolute bg-gray-700" style={{ left: -2, top: 172, width: 3, height: 42, borderRadius: "2px 0 0 2px" }} />
                </>
              )}
              {isPhone && isLandscape && (
                <>
                  <div className="absolute bg-gray-700" style={{ bottom: -2, left: 140, height: 3, width: 65, borderRadius: "0 0 2px 2px" }} />
                  <div className="absolute bg-gray-700" style={{ top: -2, right: 88, height: 3, width: 22, borderRadius: "2px 2px 0 0" }} />
                  <div className="absolute bg-gray-700" style={{ top: -2, right: 120, height: 3, width: 42, borderRadius: "2px 2px 0 0" }} />
                  <div className="absolute bg-gray-700" style={{ top: -2, right: 172, height: 3, width: 42, borderRadius: "2px 2px 0 0" }} />
                </>
              )}

              {/* Camera dot — iPad only */}
              {isTablet && (
                <div
                  className="absolute"
                  style={isPortrait
                    ? { top: BEZEL + 10, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#1a1a2e", boxShadow: "0 0 0 1.5px #333" }
                    : { left: BEZEL + 10, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#1a1a2e", boxShadow: "0 0 0 1.5px #333" }
                  }
                />
              )}

              {screenContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop mode — scaled full-height
  return (
    <div ref={containerRef}>
      <div
        className="mx-auto overflow-hidden"
        style={{
          width: scaledWidth,
          height: scaledHeight || undefined,
        }}
      >
        <div
          ref={contentRef}
          className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg"
          style={{
            width: device.w,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            backgroundColor: theme.colors.background,
          }}
        >
          {blockContent}
        </div>
      </div>
    </div>
  );
}

// ── Question options editor for select-type custom questions ──

function QuestionOptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [newOpt, setNewOpt] = useState("");

  const addOpt = () => {
    const val = newOpt.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    setNewOpt("");
  };

  return (
    <div className="space-y-1">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-body">{opt}</span>
          <button
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="text-red-500 text-xs hover:text-red-700"
          >
            &times;
          </button>
        </div>
      ))}
      <div className="flex gap-1">
        <input
          type="text"
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addOpt()}
          placeholder="Add option..."
          className="flex-1 px-2 py-1 text-sm border border-app-border rounded bg-page-bg text-body focus:outline-none focus:ring-1 focus:ring-rose-app"
        />
        <button
          onClick={addOpt}
          className="px-2 py-1 text-xs bg-rose-app text-white rounded hover:bg-rose-app-hover"
        >
          Add
        </button>
      </div>
    </div>
  );
}
