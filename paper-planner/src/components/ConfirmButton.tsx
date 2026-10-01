"use client";

// A submit button that asks for confirmation first. Used for deletes.
export function ConfirmButton({
  message,
  children,
  className = "danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
