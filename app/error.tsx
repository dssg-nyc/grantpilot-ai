"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console; server-side errors land in the app logs.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-600">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
