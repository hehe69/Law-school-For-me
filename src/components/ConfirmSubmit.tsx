"use client";

/** A submit button that asks before submitting its form. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className={className ?? "btn-danger"}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
