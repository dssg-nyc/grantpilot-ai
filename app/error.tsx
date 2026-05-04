"use client";

export default function GlobalError({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-600">{error.message}</p>
      </div>
    </main>
  );
}
