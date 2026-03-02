"use client";

interface PartySeatDialogProps {
  guestName: string;
  partySize: number;
  tableName: string;
  availableSeats: number;
  onSeatAll: () => void;
  onSeatOne: () => void;
  onCancel: () => void;
}

export function PartySeatDialog({
  guestName,
  partySize,
  tableName,
  availableSeats,
  onSeatAll,
  onSeatOne,
  onCancel,
}: PartySeatDialogProps) {
  const canFitAll = availableSeats >= partySize;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm p-6 rounded-xl shadow-xl border border-app-border bg-surface">
        <h3 className="text-lg font-bold text-heading mb-2">
          Seat Party Together?
        </h3>
        <p className="text-sm text-body mb-4">
          <strong>{guestName}</strong> has a party of {partySize}.
          {canFitAll
            ? ` Seat everyone at ${tableName}?`
            : ` ${tableName} only has ${availableSeats} open seat${availableSeats !== 1 ? "s" : ""}.`}
        </p>

        <div className="flex flex-col gap-2">
          {canFitAll && (
            <button
              onClick={onSeatAll}
              className="w-full py-2.5 px-4 text-sm rounded-lg font-medium text-white bg-rose-app"
            >
              Seat Entire Party ({partySize})
            </button>
          )}
          <button
            onClick={onSeatOne}
            className="w-full py-2.5 px-4 text-sm rounded-lg font-medium border border-app-border text-heading"
          >
            Just {guestName}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 px-4 text-sm rounded-lg text-subtle"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
