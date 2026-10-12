import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useGetFinancialReportQuery } from "@/store/api/apiSlice";

export function useFinancialReport(month: number, year: number) {
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const query = useGetFinancialReportQuery({ currentMonth: month, currentYear: year }, { refetchOnMountOrArgChange: 60, pollingInterval: active ? 60000 : 0 });
  const report = query.currentData;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const subscription = AppState.addEventListener("change", state => {
      setActive(state === "active");
      if (state === "active") { setNow(Date.now()); void query.refetch(); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [query.refetch]);
  const stale = Boolean(report && (query.error || query.isFetching || now - Date.parse(report.generatedAt) > 60000));
  return { ...query, report, stale };
}
