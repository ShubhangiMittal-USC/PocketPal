"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

const USER_ID = "demo";

function formatTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

type PlannerCtx = {
  completionPct: number;
  doneCount: number;
  totalBlocks: number;
  refresh: () => Promise<void>;
};

const Ctx = createContext<PlannerCtx>({ completionPct: 0, doneCount: 0, totalBlocks: 0, refresh: async () => {} });

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [completionPct, setCompletionPct] = useState(0);
  const [doneCount,     setDoneCount]     = useState(0);
  const [totalBlocks,   setTotalBlocks]   = useState(0);

  const refresh = useCallback(async () => {
  try {
    const dateStr = formatTodayISO();
    const [planRes, statusRes] = await Promise.all([
      fetch(`http://localhost:8000/plan?user_id=${USER_ID}&date_str=${dateStr}`),
      fetch(`http://localhost:8000/plan/status?user_id=${USER_ID}&date_str=${dateStr}`),
    ]);
    const planData   = await planRes.json();
    const statusData = await statusRes.json();

    const blocks = planData?.plan?.blocks ?? [];
    const total  = blocks.length;

    // ✅ Only count done entries for valid block indices (0 to total-1)
    // This prevents stale status entries from deleted blocks inflating the count
    let done = 0;
    const statusObj = statusData?.status ?? {};
    for (let i = 0; i < total; i++) {
      const v = statusObj[i] ?? statusObj[String(i)];
      if (!v) continue;
      if (typeof v === "boolean" ? v : v?.done) done++;
    }

    setTotalBlocks(total);
    setDoneCount(done);
    setCompletionPct(total === 0 ? 0 : Math.round((done / total) * 100));
  } catch {}
}, []);

  // Poll every 5 seconds
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return <Ctx.Provider value={{ completionPct, doneCount, totalBlocks, refresh }}>{children}</Ctx.Provider>;
}

export const usePlanner = () => useContext(Ctx);