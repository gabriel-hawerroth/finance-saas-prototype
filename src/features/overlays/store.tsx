"use client";
import * as React from "react";
import { create } from "zustand";

type Render = (close: () => void) => React.ReactNode;

interface OverlayEntry {
  id: number;
  render: Render;
}

interface OverlayState {
  entries: OverlayEntry[];
  push: (render: Render) => number;
  remove: (id: number) => void;
}

let seq = 0;

/** Stack of imperatively opened dialogs (details, forms, confirmations). */
export const useOverlayStore = create<OverlayState>((set) => ({
  entries: [],
  push: (render) => {
    const id = ++seq;
    set((s) => ({ entries: [...s.entries, { id, render }] }));
    return id;
  },
  remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));

/** Opens a dialog; returns a function that closes it. */
export function openOverlay(render: Render): () => void {
  const { push, remove } = useOverlayStore.getState();
  let id = 0;
  const close = () => remove(id);
  id = push(() => render(close));
  return close;
}

/** Opens a dialog that answers a question. Resolves `null` when dismissed. */
export function ask<T>(render: (answer: (value: T | null) => void) => React.ReactNode): Promise<T | null> {
  return new Promise((resolve) => {
    const close = openOverlay((closeFn) =>
      render((value) => {
        closeFn();
        resolve(value);
      }),
    );
    void close;
  });
}

export function OverlayHost() {
  const entries = useOverlayStore((s) => s.entries);
  const remove = useOverlayStore((s) => s.remove);
  return (
    <>
      {entries.map((e) => (
        <React.Fragment key={e.id}>{e.render(() => remove(e.id))}</React.Fragment>
      ))}
    </>
  );
}
