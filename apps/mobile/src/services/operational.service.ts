import api from "@/api/client";
import { operationalContract } from "@/services/operational-contract";
import type {
  Campus,
  DepartureSummary,
  Direction,
  DriverAssignment,
  ServiceLine,
  StudentDepartureDetail,
} from "@/types/operational";

export const operationalService = {
  async getCampuses(): Promise<Campus[]> {
    const response = await api.get<unknown>("/student/campuses");
    return operationalContract.campuses(response.data);
  },

  async getServiceLines(campusId: string): Promise<ServiceLine[]> {
    const response = await api.get<unknown>(`/student/campuses/${campusId}/service-lines`);
    return operationalContract.serviceLines(response.data);
  },

  async getDepartures(
    serviceLineId: string,
    date: string,
    direction: Direction,
  ): Promise<DepartureSummary[]> {
    const response = await api.get<unknown>(
      `/student/service-lines/${serviceLineId}/departures`,
      { params: { date, direction } },
    );
    return operationalContract.departures(response.data);
  },

  async getStudentDeparture(id: string): Promise<StudentDepartureDetail> {
    const response = await api.get<unknown>(`/student/scheduled-departures/${id}`);
    return operationalContract.studentDeparture(response.data);
  },

  async getDriverAssignmentsToday(): Promise<DriverAssignment[]> {
    const response = await api.get<unknown>("/driver/operational/assignments/today");
    return operationalContract.driverAssignments(response.data);
  },

  async getDriverAssignment(id: string): Promise<DriverAssignment> {
    const response = await api.get<unknown>(`/driver/operational/assignments/${id}`);
    return operationalContract.driverAssignment(response.data);
  },

  async startDriverRun(assignmentId: string): Promise<DriverAssignment> {
    const response = await api.post<unknown>(`/driver/operational/assignments/${assignmentId}/start`);
    return operationalContract.driverAssignment(response.data);
  },

  async getCurrentDriverRun(): Promise<DriverAssignment | null> {
    const response = await api.get<unknown>("/driver/operational/service-runs/current");
    return operationalContract.currentDriverRun(response.data);
  },

  async finishDriverRun(runId: string): Promise<DriverAssignment> {
    const response = await api.post<unknown>(`/driver/operational/service-runs/${runId}/finish`);
    return operationalContract.driverAssignment(response.data);
  },
};
