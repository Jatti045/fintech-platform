import apiClient from "@/config/apiClient";
import insightAPI from "@/api/insight";

jest.mock("@/config/apiClient", () => ({ __esModule: true, default: jest.fn() }));

it("sends one explicit generation POST with the selected period", async () => {
  const request = jest.mocked(apiClient);
  request.mockResolvedValue({ data: { success: true } });

  await insightAPI.fetchMonthlyInsight({ currentMonth: 0, currentYear: 2026 });

  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({
    url: "/insights/monthly",
    method: "POST",
    data: { month: 0, year: 2026 },
  });
});
