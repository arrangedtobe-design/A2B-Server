"use client";

import { useState } from "react";
import type {
  RsvpTheme,
  RsvpGuestData,
  RsvpToken,
  RsvpFormConfig,
  RsvpResponse,
  PartyMemberResponse,
} from "@/lib/rsvp/types";

interface RsvpFormRendererProps {
  theme: RsvpTheme;
  guest: RsvpGuestData;
  token: RsvpToken;
  formConfig: RsvpFormConfig;
  existingResponse: RsvpResponse | null;
}

export function RsvpFormRenderer({
  theme,
  guest,
  token,
  formConfig,
  existingResponse,
}: RsvpFormRendererProps) {
  const [attending, setAttending] = useState<"yes" | "no" | "">(
    existingResponse?.attending || "",
  );
  const [mealPreference, setMealPreference] = useState(
    existingResponse?.meal_preference || "",
  );
  const [plusOne, setPlusOne] = useState(existingResponse?.plus_one || false);
  const [plusOneName, setPlusOneName] = useState(
    existingResponse?.plus_one_name || "",
  );
  const [dietaryNotes, setDietaryNotes] = useState(
    existingResponse?.dietary_notes || "",
  );
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    existingResponse?.custom_answers || {},
  );
  const [comment, setComment] = useState(existingResponse?.comment || "");

  // Party member responses
  const partyMembers = guest.party_members || [];
  const [partyResponses, setPartyResponses] = useState<PartyMemberResponse[]>(
    () => {
      if (existingResponse?.party_responses?.length) {
        return existingResponse.party_responses;
      }
      return partyMembers.map((m) => ({
        name: m.name,
        attending: "coming" as const,
        meal_preference: null,
      }));
    },
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const updatePartyMember = (
    index: number,
    updates: Partial<PartyMemberResponse>,
  ) => {
    setPartyResponses((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    );
  };

  const hasMealOptions =
    formConfig.showMealPreference && formConfig.mealOptions.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attending) return;

    // Validation when attending
    if (attending === "yes") {
      if (hasMealOptions && !mealPreference) {
        setError("Please select a meal preference.");
        return;
      }

      if (partyMembers.length > 0) {
        for (let i = 0; i < partyResponses.length; i++) {
          const pr = partyResponses[i];
          if (pr.attending === "coming" && !pr.name.trim()) {
            setError(
              `Please enter a name for attending ${partyMembers[i]?.label || "guest"} #${i + 1}.`,
            );
            return;
          }
          const isChild = partyMembers[i]?.label === "Child" || pr.needs_highchair;
          if (pr.attending === "coming" && hasMealOptions && !pr.meal_preference && !isChild) {
            setError(
              `Please select a meal for ${pr.name || partyMembers[i]?.label || "guest"}.`,
            );
            return;
          }
        }
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/rsvp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.token,
          attending,
          meal_preference: attending === "yes" ? mealPreference : null,
          plus_one: attending === "yes" ? plusOne : false,
          plus_one_name: attending === "yes" && plusOne ? plusOneName : null,
          dietary_notes: attending === "yes" ? dietaryNotes : null,
          custom_answers: attending === "yes" ? customAnswers : null,
          party_responses:
            attending === "yes" && partyMembers.length > 0
              ? partyResponses
              : null,
          comment: comment.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit RSVP");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="p-8 text-center"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div className="text-4xl mb-4">
          {attending === "yes" ? "🎉" : "💌"}
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{
            fontFamily: theme.fonts.heading,
            color: theme.colors.heading,
          }}
        >
          {attending === "yes"
            ? "We can't wait to see you!"
            : "We'll miss you!"}
        </h3>
        <p style={{ color: theme.colors.muted }}>
          {attending === "yes"
            ? "Your RSVP has been recorded. See you there!"
            : "Thank you for letting us know."}
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm underline"
          style={{ color: theme.colors.accent }}
        >
          Update your response
        </button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius,
    padding: "10px 14px",
    width: "100%",
    fontSize: "14px",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius,
        border: `1px solid ${theme.colors.border}`,
        padding: "24px",
      }}
    >
      {/* Guest name */}
      <div className="text-center">
        <p className="text-sm" style={{ color: theme.colors.muted }}>
          Responding for
        </p>
        <p
          className="text-lg font-semibold"
          style={{
            fontFamily: theme.fonts.heading,
            color: theme.colors.heading,
          }}
        >
          {guest.name}
        </p>
      </div>

      {/* Attending toggle */}
      <div>
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: theme.colors.heading }}
        >
          Will you be attending?
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAttending("yes")}
            className="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            style={{
              borderRadius: theme.borderRadius,
              border: `2px solid ${attending === "yes" ? theme.colors.accent : theme.colors.border}`,
              backgroundColor:
                attending === "yes" ? theme.colors.accent : theme.colors.surface,
              color: attending === "yes" ? "#ffffff" : theme.colors.text,
            }}
          >
            Joyfully Accept
          </button>
          <button
            type="button"
            onClick={() => setAttending("no")}
            className="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            style={{
              borderRadius: theme.borderRadius,
              border: `2px solid ${attending === "no" ? theme.colors.accent : theme.colors.border}`,
              backgroundColor:
                attending === "no" ? theme.colors.accent : theme.colors.surface,
              color: attending === "no" ? "#ffffff" : theme.colors.text,
            }}
          >
            Respectfully Decline
          </button>
        </div>
      </div>

      {/* Conditional fields — only show if attending */}
      {attending === "yes" && (
        <>
          {/* Meal preference for primary guest */}
          {formConfig.showMealPreference && formConfig.mealOptions.length > 0 && (
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.colors.heading }}
              >
                Meal Preference
                <span style={{ color: theme.colors.accent }}> *</span>
              </label>
              <select
                value={mealPreference}
                onChange={(e) => setMealPreference(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a meal...</option>
                {formConfig.mealOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dietary notes for primary guest */}
          {formConfig.showDietaryNotes && (
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.colors.heading }}
              >
                Dietary Restrictions or Allergies
              </label>
              <textarea
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Any dietary needs we should know about?"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
            </div>
          )}

          {/* Party members section */}
          {partyMembers.length > 0 && (
            <div>
              <label
                className="block text-sm font-medium mb-3"
                style={{ color: theme.colors.heading }}
              >
                Your Party
              </label>
              <div className="space-y-3">
                {partyResponses.map((pr, index) => {
                  const member = partyMembers[index];
                  return (
                    <div
                      key={index}
                      className="p-3"
                      style={{
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: theme.colors.border,
                        borderRadius: theme.borderRadius,
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: theme.colors.accent + "20",
                            color: theme.colors.accent,
                          }}
                        >
                          {member?.label || "Guest"}
                        </span>
                        <input
                          type="text"
                          value={pr.name}
                          onChange={(e) =>
                            updatePartyMember(index, { name: e.target.value })
                          }
                          placeholder={pr.attending === "coming" ? "Name *" : "Name"}
                          className="flex-1"
                          style={{
                            ...inputStyle,
                            padding: "6px 10px",
                            fontSize: "13px",
                            ...(pr.attending === "coming" && !pr.name.trim()
                              ? { borderColor: theme.colors.accent }
                              : {}),
                          }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={pr.attending}
                          onChange={(e) =>
                            updatePartyMember(index, {
                              attending: e.target.value as "coming" | "not_coming" | "unsure",
                              ...(e.target.value !== "coming" ? { meal_preference: null } : {}),
                            })
                          }
                          style={{
                            ...inputStyle,
                            padding: "6px 10px",
                            fontSize: "13px",
                            width: "auto",
                            flex: "none",
                          }}
                        >
                          <option value="coming">Coming</option>
                          <option value="not_coming">Not Coming</option>
                          <option value="unsure">Unsure</option>
                        </select>
                        {pr.attending === "coming" &&
                          formConfig.showMealPreference &&
                          formConfig.mealOptions.length > 0 &&
                          member?.label !== "Child" &&
                          !pr.needs_highchair && (
                            <select
                              value={pr.meal_preference || ""}
                              onChange={(e) =>
                                updatePartyMember(index, {
                                  meal_preference: e.target.value || null,
                                })
                              }
                              style={{
                                ...inputStyle,
                                padding: "6px 10px",
                                fontSize: "13px",
                                flex: "1",
                                minWidth: 0,
                                ...(!pr.meal_preference
                                  ? { borderColor: theme.colors.accent }
                                  : {}),
                              }}
                            >
                              <option value="">Select meal *</option>
                              {formConfig.mealOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}
                      </div>
                      {pr.attending === "coming" && formConfig.showDietaryNotes && (
                        <input
                          type="text"
                          value={pr.dietary_notes || ""}
                          onChange={(e) =>
                            updatePartyMember(index, {
                              dietary_notes: e.target.value || null,
                            })
                          }
                          placeholder="Dietary restrictions / allergies"
                          className="mt-2"
                          style={{
                            ...inputStyle,
                            padding: "6px 10px",
                            fontSize: "13px",
                          }}
                        />
                      )}
                      {pr.attending === "coming" && member?.label === "Child" && (
                        <label
                          className="flex items-center gap-2 mt-2 cursor-pointer"
                          style={{ fontSize: "13px", color: theme.colors.text }}
                        >
                          <input
                            type="checkbox"
                            checked={pr.needs_highchair || false}
                            onChange={(e) =>
                              updatePartyMember(index, { needs_highchair: e.target.checked })
                            }
                            style={{ accentColor: theme.colors.accent }}
                          />
                          Needs highchair
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plus one removed — party members are managed by admin in the guest list */}

          {/* Custom questions */}
          {formConfig.customQuestions.map((q) => (
            <div key={q.id}>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.colors.heading }}
              >
                {q.label}
                {q.required && (
                  <span style={{ color: theme.colors.accent }}> *</span>
                )}
              </label>
              {q.type === "select" && q.options ? (
                <select
                  value={customAnswers[q.id] || ""}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  required={q.required}
                  style={inputStyle}
                >
                  <option value="">Select...</option>
                  {q.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customAnswers[q.id] || ""}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  required={q.required}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </>
      )}

      {/* Comment — shown for any response */}
      {attending && (
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: theme.colors.heading }}
          >
            Leave a comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any message for the couple? (optional)"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!attending || submitting}
        className="w-full py-3 px-6 font-semibold text-white transition-colors disabled:opacity-50"
        style={{
          backgroundColor: theme.colors.accent,
          borderRadius: theme.borderRadius,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = theme.colors.accentHover)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = theme.colors.accent)
        }
      >
        {submitting
          ? "Submitting..."
          : existingResponse
            ? "Update RSVP"
            : "Submit RSVP"}
      </button>

      {existingResponse && (
        <p
          className="text-xs text-center"
          style={{ color: theme.colors.muted }}
        >
          You previously responded. You can update your response above.
        </p>
      )}
    </form>
  );
}
