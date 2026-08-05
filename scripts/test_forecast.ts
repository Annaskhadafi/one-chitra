import 'dotenv/config';
import { fetchDashboardRevenueForecast, fetchAllSalesRevenueData } from "@/app/actions/dashboard-revenue-logic";

async function test() {
  console.log("Testing 07.2026 forecast data...");
  try {
    const res = await fetchDashboardRevenueForecast({ period: "07.2026" });
    console.log("Forecast result success:", res.success);
    if (!res.success) {
      console.error("Forecast Error:", res);
    } else {
      console.log("Forecast data keys:", Object.keys(res.data || {}));
      console.log("Consolidate target:", res.data?.targets?.consolidate);
    }

    const salesRes = await fetchAllSalesRevenueData({ period: "07.2026" });
    console.log("Sales data success:", salesRes.success);
    if (!salesRes.success) {
      console.error("Sales Error:", salesRes);
    } else {
      console.log("Sales data count:", salesRes.count, "total:", salesRes.total);
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

test();
