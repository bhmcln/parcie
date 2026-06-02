"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_SOLUTION, type Solution, type SolveConfig } from "./data";

// Versioned so a solution shape change (e.g. adding stability fields) discards
// incompatible data cached by an earlier build rather than rendering it.
const SOLUTION_KEY = "parcie:solution:v2";
const CONFIG_KEY = "parcie:config:v2";

type SolutionState = {
  solution: Solution;
  solving: boolean;
  error: string | null;
  // Whether the current solution came from a live solve this session, as
  // opposed to the shipped seed.
  fromSolve: boolean;
  // Solve a config; resolves to the new solution, or null on failure.
  solve: (config: SolveConfig) => Promise<Solution | null>;
  // Re-run the last config (or defaults if none yet). Used by the engine view.
  resolve: () => Promise<Solution | null>;
};

const SolutionContext = createContext<SolutionState | null>(null);

export function SolutionProvider({ children }: { children: React.ReactNode }) {
  const [solution, setSolution] = useState<Solution>(DEFAULT_SOLUTION);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromSolve, setFromSolve] = useState(false);

  // Hydrate from a previous solve in this browser. Read after mount so the
  // server-rendered markup (the seed) matches the first client render.
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(SOLUTION_KEY);
      if (cached) {
        setSolution(JSON.parse(cached) as Solution);
        setFromSolve(true);
      }
    } catch {
      // Corrupt or unavailable storage: fall back to the seed silently.
    }
  }, []);

  const solve = useCallback(async (config: SolveConfig) => {
    setSolving(true);
    setError(null);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`engine returned ${res.status}: ${detail.slice(0, 300)}`);
      }
      const next = (await res.json()) as Solution;
      if (!next.boxes?.length) {
        throw new Error(`engine returned no placement (${next.status})`);
      }
      setSolution(next);
      setFromSolve(true);
      try {
        window.localStorage.setItem(SOLUTION_KEY, JSON.stringify(next));
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch {
        // Persistence is best-effort; the in-memory solution still updates.
      }
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSolving(false);
    }
  }, []);

  const resolve = useCallback(() => {
    let config: SolveConfig = {};
    try {
      const cached = window.localStorage.getItem(CONFIG_KEY);
      if (cached) config = JSON.parse(cached) as SolveConfig;
    } catch {
      // No stored config: re-solve the defaults.
    }
    return solve(config);
  }, [solve]);

  return (
    <SolutionContext.Provider
      value={{ solution, solving, error, fromSolve, solve, resolve }}
    >
      {children}
    </SolutionContext.Provider>
  );
}

export function useSolution(): SolutionState {
  const ctx = useContext(SolutionContext);
  if (!ctx) {
    throw new Error("useSolution must be used within a SolutionProvider");
  }
  return ctx;
}
