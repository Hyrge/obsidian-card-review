declare global {
  interface WindowEventMap {
    'card-review-move-source': CustomEvent<{ source: string; dir: string }>;
    'card-review-move-complete': Event;
  }
}

export {};
