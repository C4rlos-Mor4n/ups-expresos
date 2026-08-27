import { tripFeedbackService } from "./trip-feedback.service";
import api from "../api/client";

jest.mock("../api/client", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;

const feedbackResponse = {
  id: "fb-1",
  userId: "u1",
  routeId: "route-1",
  driverId: "driver-1",
  rating: 5,
  comment: "Excelente viaje",
  travelDate: null,
  createdAt: "2026-08-27T00:00:00.000Z",
};

describe("tripFeedbackService", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it("submits a valid feedback with rating 1..5", async () => {
    apiPost.mockResolvedValue({ data: feedbackResponse });
    const result = await tripFeedbackService.submit({
      routeId: "route-1",
      driverId: "driver-1",
      rating: 5,
      comment: "Excelente viaje",
    });
    expect(apiPost).toHaveBeenCalledWith("/trip-feedback", {
      routeId: "route-1",
      driverId: "driver-1",
      rating: 5,
      comment: "Excelente viaje",
    });
    expect(result.id).toBe("fb-1");
    expect(result.rating).toBe(5);
  });

  it("submits without optional driverId and comment", async () => {
    apiPost.mockResolvedValue({ data: feedbackResponse });
    await tripFeedbackService.submit({ routeId: "route-1", rating: 3 });
    expect(apiPost).toHaveBeenCalledWith("/trip-feedback", {
      routeId: "route-1",
      rating: 3,
    });
  });

  it("fetches the feedback history", async () => {
    apiGet.mockResolvedValue({ data: { data: [feedbackResponse], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } });
    const result = await tripFeedbackService.getHistory({ page: 1, limit: 20 });
    expect(apiGet).toHaveBeenCalledWith("/trip-feedback", { params: { page: 1, limit: 20 } });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});