import {
  DayOfWeek,
  DriverStatus,
  NoticeSeverity,
  RouteStatus,
  ScheduleStatus,
  UserRole,
  VehicleStatus,
} from '@prisma/client';

export interface DemoUserSeed {
  email: string;
  name: string;
  role: UserRole;
}

export interface DemoRouteSeed {
  key: string;
  name: string;
  legacyNames?: string[];
  description: string;
  direction: string;
  status: RouteStatus;
}

export interface DemoStopSeed {
  key: string;
  name: string;
  legacyNames?: string[];
  reference: string;
  latitude: number;
  longitude: number;
}

export interface DemoRouteStopSeed {
  routeKey: string;
  stopKey: string;
  stopOrder: number;
  estimatedArrivalMinutes: number;
  notes?: string;
}

export interface DemoScheduleSeed {
  routeKey: string;
  dayOfWeek: DayOfWeek;
  direction: string;
  departureTime: string;
  approximateArrivalTime: string;
  status: ScheduleStatus;
}

export interface DemoVehicleSeed {
  plate: string;
  code: string;
  capacity: number;
  status: VehicleStatus;
}

export interface DemoDriverSeed {
  name: string;
  phone: string;
  licenseNumber: string;
  status: DriverStatus;
  assignedVehicleCode: string;
  assignedRouteKey: string;
}

export interface DemoNoticeSeed {
  title: string;
  message: string;
  severity: NoticeSeverity;
  publishedOffsetDays: number;
  expiresAfterDays?: number;
  createdByEmail: string;
}

export interface DemoTripFeedbackSeed {
  userEmail: string;
  routeKey: string;
  driverName?: string;
  rating: number;
  comment: string;
  travelOffsetDays: number;
}

export interface DemoCatalog {
  users: DemoUserSeed[];
  routes: DemoRouteSeed[];
  stops: DemoStopSeed[];
  routeStops: DemoRouteStopSeed[];
  schedules: DemoScheduleSeed[];
  vehicles: DemoVehicleSeed[];
  drivers: DemoDriverSeed[];
  notices: DemoNoticeSeed[];
  tripFeedbacks: DemoTripFeedbackSeed[];
}

const WEEKDAYS = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
];

function buildWeeklySchedules(
  routeKey: string,
  direction: string,
  slots: Array<{ departureTime: string; approximateArrivalTime: string }>,
): DemoScheduleSeed[] {
  return WEEKDAYS.flatMap((dayOfWeek) =>
    slots.map((slot) => ({
      routeKey,
      dayOfWeek,
      direction,
      departureTime: slot.departureTime,
      approximateArrivalTime: slot.approximateArrivalTime,
      status: ScheduleStatus.ACTIVE,
    })),
  );
}

export function shouldIncludeDemoData(nodeEnv: string | undefined, flag: string | undefined): boolean {
  const normalized = String(flag ?? '').trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return nodeEnv !== 'production';
}

export function buildAllowedDomains(raw: string | undefined): string[] {
  return String(raw ?? 'ups.edu.ec,est.ups.edu.ec')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

export function getDemoCatalog(): DemoCatalog {
  const users: DemoUserSeed[] = [
    { email: 'carlitosmoran245@gmail.com', name: 'Carlos Morán', role: UserRole.SUPER_ADMIN },
    { email: 'Ignacioflows594@gmail.com', name: 'Ignacio Flows', role: UserRole.ADMIN },
    { email: 'admin.flotas@ups.edu.ec', name: 'Javier Flotas', role: UserRole.ADMIN },
    { email: 'coordinacion.movilidad@ups.edu.ec', name: 'Pamela Movilidad', role: UserRole.ADMIN },
    { email: 'movil1@est.ups.edu.ec', name: 'Andrea Centenario', role: UserRole.STUDENT },
    { email: 'movil2@est.ups.edu.ec', name: 'Mateo Vía a la Costa', role: UserRole.STUDENT },
    { email: 'movil3@est.ups.edu.ec', name: 'Sofía Guasmo Sur', role: UserRole.STUDENT },
    { email: 'movil4@est.ups.edu.ec', name: 'Diego Río Daule', role: UserRole.STUDENT },
    { email: 'movil5@est.ups.edu.ec', name: 'Lucía Los Ceibos', role: UserRole.STUDENT },
    { email: 'movil6@est.ups.edu.ec', name: 'Emilio Puerto Azul', role: UserRole.STUDENT },
    { email: 'movil7@gmail.com', name: 'Carlos Demo Gmail', role: UserRole.STUDENT },
    { email: 'movil8@gmail.com', name: 'Valentina Externa', role: UserRole.STUDENT },
    { email: 'conductor.portal1@ups.edu.ec', name: 'Portal Conductor Uno', role: UserRole.DRIVER },
    { email: 'conductor.portal2@ups.edu.ec', name: 'Portal Conductor Dos', role: UserRole.DRIVER },
  ];

  const routes: DemoRouteSeed[] = [
    {
      key: 'rio-daule-centenario-ida',
      name: 'Terminal Río Daule → Campus Centenario',
      legacyNames: ['Ruta Campus Sur'],
      description:
        'Recorrido institucional de referencia desde la Terminal Río Daule hasta la UPS Campus Centenario por puntos reales de Guayaquil.',
      direction: 'IDA',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'centenario-rio-daule-retorno',
      name: 'Campus Centenario → Terminal Río Daule',
      legacyNames: ['Ruta Campus Sur Retorno'],
      description:
        'Retorno institucional de referencia desde la UPS Campus Centenario hasta la Terminal Río Daule, dentro de Guayaquil.',
      direction: 'RETORNO',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'terminal-25-centenario-ida',
      name: 'Terminal 25 de Julio → Campus Centenario',
      legacyNames: ['Ruta Campus Norte'],
      description:
        'Recorrido institucional de referencia desde la Terminal 25 de Julio hasta la UPS Campus Centenario por el sur de Guayaquil.',
      direction: 'IDA',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'centenario-terminal-25-retorno',
      name: 'Campus Centenario → Terminal 25 de Julio',
      legacyNames: ['Ruta Campus Norte Retorno'],
      description:
        'Retorno institucional de referencia desde la UPS Campus Centenario hasta la Terminal 25 de Julio por el sur de Guayaquil.',
      direction: 'RETORNO',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'terminal-costa-maria-auxiliadora-ida',
      name: 'Terminal Costa → Campus María Auxiliadora',
      legacyNames: ['Ruta Centro Histórico'],
      description:
        'Recorrido institucional de referencia desde la Terminal Terrestre Municipal Costa hasta la UPS Campus María Auxiliadora por Vía a la Costa.',
      direction: 'IDA',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'maria-auxiliadora-terminal-costa-retorno',
      name: 'Campus María Auxiliadora → Terminal Costa',
      legacyNames: ['Ruta Centro Histórico Retorno'],
      description:
        'Retorno institucional de referencia desde la UPS Campus María Auxiliadora hasta la Terminal Terrestre Municipal Costa.',
      direction: 'RETORNO',
      status: RouteStatus.ACTIVE,
    },
    {
      key: 'intercampus-centenario-maria-auxiliadora',
      name: 'Intercampus Centenario → María Auxiliadora',
      legacyNames: ['Intercampus Express'],
      description:
        'Recorrido institucional de referencia entre los dos campus de la UPS en Guayaquil, con conexión por Vía a la Costa.',
      direction: 'IDA',
      status: RouteStatus.ACTIVE,
    },
  ];

  // Coordenadas WGS84 de lugares reales de Guayaquil, Guayas, contrastadas con
  // OpenStreetMap/Nominatim el 31-07-2026. No representan paradas oficiales de transporte público.
  const stops: DemoStopSeed[] = [
    {
      key: 'terminal-rio-daule',
      name: 'Terminal Río Daule',
      legacyNames: ['Terminal Principal', 'Parada Entrada Principal'],
      reference: 'Terminal de la Metrovía junto a la Terminal Terrestre de Guayaquil.',
      latitude: -2.1401756,
      longitude: -79.8800529,
    },
    {
      key: 'mall-del-sol',
      name: 'Mall del Sol',
      legacyNames: ['Biblioteca Central', 'Parada Biblioteca'],
      reference: 'Acceso del centro comercial Mall del Sol, avenida Joaquín Orrantia.',
      latitude: -2.1550405,
      longitude: -79.8926855,
    },
    {
      key: 'universidad-guayaquil',
      name: 'Universidad de Guayaquil',
      legacyNames: ['Cancha Deportiva', 'Parada Cancha'],
      reference: 'Ingreso del campus de la Universidad de Guayaquil, sector Kennedy.',
      latitude: -2.1814973,
      longitude: -79.8986378,
    },
    {
      key: 'parque-centenario',
      name: 'Parque Centenario',
      legacyNames: ['Parking Norte', 'Parada Parking Norte'],
      reference: 'Parque Centenario, centro de Guayaquil.',
      latitude: -2.1898725,
      longitude: -79.8876439,
    },
    {
      key: 'estadio-capwell',
      name: 'Estadio George Capwell',
      legacyNames: ['Bloque Laboratorios'],
      reference: 'Estadio George Capwell, avenida Quito, sector General Gómez.',
      latitude: -2.206623,
      longitude: -79.8937897,
    },
    {
      key: 'ups-centenario',
      name: 'UPS Campus Centenario',
      legacyNames: ['Residencias Universitarias'],
      reference: 'Universidad Politécnica Salesiana, Robles 107 y Chambers, barrio Centenario.',
      latitude: -2.2206355,
      longitude: -79.886659,
    },
    {
      key: 'terminal-25-julio',
      name: 'Terminal 25 de Julio',
      legacyNames: ['Coliseo UPS'],
      reference: 'Terminal de la Metrovía sobre la avenida 25 de Julio, sur de Guayaquil.',
      latitude: -2.23969,
      longitude: -79.89831,
    },
    {
      key: 'hospital-teodoro-maldonado',
      name: 'Hospital Teodoro Maldonado Carbo',
      legacyNames: ['Rectorado'],
      reference: 'Hospital del IESS sobre la avenida 25 de Julio.',
      latitude: -2.2326772,
      longitude: -79.898447,
    },
    {
      key: 'mall-del-sur',
      name: 'Mall del Sur',
      legacyNames: ['Centro Histórico'],
      reference: 'Centro comercial Mall del Sur, avenida 25 de Julio.',
      latitude: -2.2272268,
      longitude: -79.8979628,
    },
    {
      key: 'terminal-costa',
      name: 'Terminal Terrestre Municipal Costa',
      legacyNames: ['Malecón Universitario'],
      reference: 'Terminal terrestre municipal en Los Ceibos, inicio de Vía a la Costa.',
      latitude: -2.1817002,
      longitude: -79.9493309,
    },
    {
      key: 'puerto-azul',
      name: 'Puerto Azul',
      legacyNames: ['Facultad de Ciencias'],
      reference: 'Ingreso a la urbanización Puerto Azul por Vía a la Costa.',
      latitude: -2.1906289,
      longitude: -79.9675719,
    },
    {
      key: 'costalmar',
      name: 'Costalmar Shopping',
      legacyNames: ['Auditorio Principal'],
      reference: 'Centro comercial Costalmar Shopping, Vía a la Costa.',
      latitude: -2.185382,
      longitude: -80.0058523,
    },
    {
      key: 'ups-maria-auxiliadora',
      name: 'UPS Campus María Auxiliadora',
      reference: 'Universidad Politécnica Salesiana, km 19 de Vía a la Costa.',
      latitude: -2.1918485,
      longitude: -80.0458099,
    },
    {
      key: 'ucsg',
      name: 'Universidad Católica de Santiago de Guayaquil',
      reference: 'Ingreso de la UCSG sobre la avenida Carlos Julio Arosemena.',
      latitude: -2.1815949,
      longitude: -79.904237,
    },
  ];

  const routeStops: DemoRouteStopSeed[] = [
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'terminal-rio-daule', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida Terminal Río Daule' },
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'mall-del-sol', stopOrder: 2, estimatedArrivalMinutes: 7 },
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'universidad-guayaquil', stopOrder: 3, estimatedArrivalMinutes: 21 },
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'parque-centenario', stopOrder: 4, estimatedArrivalMinutes: 28 },
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'estadio-capwell', stopOrder: 5, estimatedArrivalMinutes: 33 },
    { routeKey: 'rio-daule-centenario-ida', stopKey: 'ups-centenario', stopOrder: 6, estimatedArrivalMinutes: 40, notes: 'Llegada UPS Campus Centenario' },

    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'ups-centenario', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida UPS Campus Centenario' },
    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'estadio-capwell', stopOrder: 2, estimatedArrivalMinutes: 7 },
    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'parque-centenario', stopOrder: 3, estimatedArrivalMinutes: 12 },
    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'universidad-guayaquil', stopOrder: 4, estimatedArrivalMinutes: 19 },
    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'mall-del-sol', stopOrder: 5, estimatedArrivalMinutes: 33 },
    { routeKey: 'centenario-rio-daule-retorno', stopKey: 'terminal-rio-daule', stopOrder: 6, estimatedArrivalMinutes: 40 },

    { routeKey: 'terminal-25-centenario-ida', stopKey: 'terminal-25-julio', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida Terminal 25 de Julio' },
    { routeKey: 'terminal-25-centenario-ida', stopKey: 'hospital-teodoro-maldonado', stopOrder: 2, estimatedArrivalMinutes: 4 },
    { routeKey: 'terminal-25-centenario-ida', stopKey: 'mall-del-sur', stopOrder: 3, estimatedArrivalMinutes: 8 },
    { routeKey: 'terminal-25-centenario-ida', stopKey: 'ups-centenario', stopOrder: 4, estimatedArrivalMinutes: 13, notes: 'Llegada UPS Campus Centenario' },

    { routeKey: 'centenario-terminal-25-retorno', stopKey: 'ups-centenario', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida UPS Campus Centenario' },
    { routeKey: 'centenario-terminal-25-retorno', stopKey: 'mall-del-sur', stopOrder: 2, estimatedArrivalMinutes: 5 },
    { routeKey: 'centenario-terminal-25-retorno', stopKey: 'hospital-teodoro-maldonado', stopOrder: 3, estimatedArrivalMinutes: 9 },
    { routeKey: 'centenario-terminal-25-retorno', stopKey: 'terminal-25-julio', stopOrder: 4, estimatedArrivalMinutes: 13 },

    { routeKey: 'terminal-costa-maria-auxiliadora-ida', stopKey: 'terminal-costa', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida Terminal Costa' },
    { routeKey: 'terminal-costa-maria-auxiliadora-ida', stopKey: 'puerto-azul', stopOrder: 2, estimatedArrivalMinutes: 6 },
    { routeKey: 'terminal-costa-maria-auxiliadora-ida', stopKey: 'costalmar', stopOrder: 3, estimatedArrivalMinutes: 15 },
    { routeKey: 'terminal-costa-maria-auxiliadora-ida', stopKey: 'ups-maria-auxiliadora', stopOrder: 4, estimatedArrivalMinutes: 24, notes: 'Llegada UPS Campus María Auxiliadora' },

    { routeKey: 'maria-auxiliadora-terminal-costa-retorno', stopKey: 'ups-maria-auxiliadora', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida UPS Campus María Auxiliadora' },
    { routeKey: 'maria-auxiliadora-terminal-costa-retorno', stopKey: 'costalmar', stopOrder: 2, estimatedArrivalMinutes: 9 },
    { routeKey: 'maria-auxiliadora-terminal-costa-retorno', stopKey: 'puerto-azul', stopOrder: 3, estimatedArrivalMinutes: 18 },
    { routeKey: 'maria-auxiliadora-terminal-costa-retorno', stopKey: 'terminal-costa', stopOrder: 4, estimatedArrivalMinutes: 24 },

    { routeKey: 'intercampus-centenario-maria-auxiliadora', stopKey: 'ups-centenario', stopOrder: 1, estimatedArrivalMinutes: 0, notes: 'Salida UPS Campus Centenario' },
    { routeKey: 'intercampus-centenario-maria-auxiliadora', stopKey: 'ucsg', stopOrder: 2, estimatedArrivalMinutes: 14 },
    { routeKey: 'intercampus-centenario-maria-auxiliadora', stopKey: 'terminal-costa', stopOrder: 3, estimatedArrivalMinutes: 35 },
    { routeKey: 'intercampus-centenario-maria-auxiliadora', stopKey: 'puerto-azul', stopOrder: 4, estimatedArrivalMinutes: 41 },
    { routeKey: 'intercampus-centenario-maria-auxiliadora', stopKey: 'ups-maria-auxiliadora', stopOrder: 5, estimatedArrivalMinutes: 58, notes: 'Llegada UPS Campus María Auxiliadora' },
  ];

  const schedules: DemoScheduleSeed[] = [
    ...buildWeeklySchedules('rio-daule-centenario-ida', 'IDA', [
      { departureTime: '06:10', approximateArrivalTime: '06:55' },
      { departureTime: '11:30', approximateArrivalTime: '12:15' },
      { departureTime: '16:00', approximateArrivalTime: '16:45' },
    ]),
    ...buildWeeklySchedules('centenario-rio-daule-retorno', 'RETORNO', [
      { departureTime: '07:10', approximateArrivalTime: '07:55' },
      { departureTime: '13:15', approximateArrivalTime: '14:00' },
      { departureTime: '20:00', approximateArrivalTime: '20:45' },
    ]),
    ...buildWeeklySchedules('terminal-25-centenario-ida', 'IDA', [
      { departureTime: '06:30', approximateArrivalTime: '06:50' },
      { departureTime: '11:50', approximateArrivalTime: '12:10' },
      { departureTime: '16:15', approximateArrivalTime: '16:35' },
    ]),
    ...buildWeeklySchedules('centenario-terminal-25-retorno', 'RETORNO', [
      { departureTime: '07:05', approximateArrivalTime: '07:25' },
      { departureTime: '12:30', approximateArrivalTime: '12:50' },
      { departureTime: '18:10', approximateArrivalTime: '18:30' },
    ]),
    ...buildWeeklySchedules('terminal-costa-maria-auxiliadora-ida', 'IDA', [
      { departureTime: '06:20', approximateArrivalTime: '06:55' },
      { departureTime: '14:10', approximateArrivalTime: '14:45' },
    ]),
    ...buildWeeklySchedules('maria-auxiliadora-terminal-costa-retorno', 'RETORNO', [
      { departureTime: '07:20', approximateArrivalTime: '07:55' },
      { departureTime: '19:10', approximateArrivalTime: '19:45' },
    ]),
    ...buildWeeklySchedules('intercampus-centenario-maria-auxiliadora', 'IDA', [
      { departureTime: '08:30', approximateArrivalTime: '09:40' },
      { departureTime: '15:00', approximateArrivalTime: '16:10' },
    ]),
  ];

  const vehicles: DemoVehicleSeed[] = [
    { plate: 'PPN-1234', code: 'BUS-001', capacity: 40, status: VehicleStatus.ACTIVE },
    { plate: 'GSA-4501', code: 'BUS-002', capacity: 32, status: VehicleStatus.ACTIVE },
    { plate: 'PCD-7788', code: 'BUS-003', capacity: 28, status: VehicleStatus.ACTIVE },
    { plate: 'MBA-2201', code: 'BUS-004', capacity: 36, status: VehicleStatus.MAINTENANCE },
    { plate: 'UPE-9911', code: 'BUS-005', capacity: 24, status: VehicleStatus.INACTIVE },
  ];

  const drivers: DemoDriverSeed[] = [
    {
      name: 'Luis Herrera',
      phone: '+593991110001',
      licenseNumber: 'LIC-DEMO-001',
      status: DriverStatus.ACTIVE,
      assignedVehicleCode: 'BUS-001',
      assignedRouteKey: 'rio-daule-centenario-ida',
    },
    {
      name: 'María Paredes',
      phone: '+593991110002',
      licenseNumber: 'LIC-DEMO-002',
      status: DriverStatus.ACTIVE,
      assignedVehicleCode: 'BUS-002',
      assignedRouteKey: 'terminal-25-centenario-ida',
    },
    {
      name: 'José Cedeño',
      phone: '+593991110003',
      licenseNumber: 'LIC-DEMO-003',
      status: DriverStatus.ACTIVE,
      assignedVehicleCode: 'BUS-003',
      assignedRouteKey: 'terminal-costa-maria-auxiliadora-ida',
    },
    {
      name: 'Ana Villacís',
      phone: '+593991110004',
      licenseNumber: 'LIC-DEMO-004',
      status: DriverStatus.ACTIVE,
      assignedVehicleCode: 'BUS-004',
      assignedRouteKey: 'centenario-rio-daule-retorno',
    },
    {
      name: 'Pedro Zambrano',
      phone: '+593991110005',
      licenseNumber: 'LIC-DEMO-005',
      status: DriverStatus.ACTIVE,
      assignedVehicleCode: 'BUS-005',
      assignedRouteKey: 'intercampus-centenario-maria-auxiliadora',
    },
  ];

  const notices: DemoNoticeSeed[] = [
    {
      title: 'Bienvenido a UPS ExpresosApp',
      message: 'El sistema de transporte institucional se encuentra operativo con datos completos de prueba.',
      severity: NoticeSeverity.INFO,
      publishedOffsetDays: -5,
      expiresAfterDays: 30,
      createdByEmail: 'Ignacioflows594@gmail.com',
    },
    {
      title: 'Mantenimiento preventivo de BUS-004',
      message: 'La unidad BUS-004 entrará a mantenimiento preventivo este fin de semana.',
      severity: NoticeSeverity.WARNING,
      publishedOffsetDays: -1,
      expiresAfterDays: 10,
      createdByEmail: 'admin.flotas@ups.edu.ec',
    },
    {
      title: 'Refuerzo de frecuencia Campus Centenario',
      message: 'Se añadieron salidas de referencia en horas pico hacia Campus Centenario durante el ciclo intensivo.',
      severity: NoticeSeverity.INFO,
      publishedOffsetDays: -2,
      expiresAfterDays: 20,
      createdByEmail: 'coordinacion.movilidad@ups.edu.ec',
    },
    {
      title: 'Recorrido intercampus habilitado',
      message: 'El recorrido entre Campus Centenario y Campus María Auxiliadora está disponible en los horarios publicados.',
      severity: NoticeSeverity.INFO,
      publishedOffsetDays: -3,
      expiresAfterDays: 15,
      createdByEmail: 'Ignacioflows594@gmail.com',
    },
    {
      title: 'Parada habilitada en Costalmar',
      message: 'La ruta de Vía a la Costa incluye una parada de referencia en Costalmar antes de Campus María Auxiliadora.',
      severity: NoticeSeverity.INFO,
      publishedOffsetDays: 0,
      expiresAfterDays: 7,
      createdByEmail: 'coordinacion.movilidad@ups.edu.ec',
    },
    {
      title: 'Inspección extraordinaria de flota',
      message: 'Se realizará una revisión de seguridad con prioridad alta sobre toda la flota activa.',
      severity: NoticeSeverity.CRITICAL,
      publishedOffsetDays: 1,
      expiresAfterDays: 5,
      createdByEmail: 'admin.flotas@ups.edu.ec',
    },
  ];

  const tripFeedbacks: DemoTripFeedbackSeed[] = [
    {
      userEmail: 'movil1@est.ups.edu.ec',
      routeKey: 'rio-daule-centenario-ida',
      driverName: 'Luis Herrera',
      rating: 5,
      comment: 'El recorrido desde Río Daule llegó puntual al Campus Centenario.',
      travelOffsetDays: -6,
    },
    {
      userEmail: 'movil2@est.ups.edu.ec',
      routeKey: 'terminal-25-centenario-ida',
      driverName: 'María Paredes',
      rating: 4,
      comment: 'Buen recorrido desde la Terminal 25 de Julio; sería útil una notificación antes de la salida.',
      travelOffsetDays: -5,
    },
    {
      userEmail: 'movil3@est.ups.edu.ec',
      routeKey: 'terminal-costa-maria-auxiliadora-ida',
      driverName: 'José Cedeño',
      rating: 5,
      comment: 'Muy útil para llegar temprano desde la Terminal Costa al Campus María Auxiliadora.',
      travelOffsetDays: -4,
    },
    {
      userEmail: 'movil4@est.ups.edu.ec',
      routeKey: 'centenario-rio-daule-retorno',
      driverName: 'Ana Villacís',
      rating: 3,
      comment: 'El retorno salió con algo de demora, pero el recorrido fue seguro.',
      travelOffsetDays: -4,
    },
    {
      userEmail: 'movil5@est.ups.edu.ec',
      routeKey: 'centenario-terminal-25-retorno',
      driverName: 'María Paredes',
      rating: 4,
      comment: 'Sería ideal ver el bus asignado dentro de la app.',
      travelOffsetDays: -3,
    },
    {
      userEmail: 'movil6@est.ups.edu.ec',
      routeKey: 'rio-daule-centenario-ida',
      driverName: 'Luis Herrera',
      rating: 5,
      comment: 'Las paradas por Mall del Sol y la Universidad de Guayaquil facilitan el recorrido.',
      travelOffsetDays: -3,
    },
    {
      userEmail: 'movil7@gmail.com',
      routeKey: 'maria-auxiliadora-terminal-costa-retorno',
      driverName: 'José Cedeño',
      rating: 4,
      comment: 'Ruta clara y útil para regresar desde María Auxiliadora hacia Los Ceibos.',
      travelOffsetDays: -2,
    },
    {
      userEmail: 'movil8@gmail.com',
      routeKey: 'terminal-25-centenario-ida',
      driverName: 'María Paredes',
      rating: 5,
      comment: 'La información de horarios coincide con el viaje real.',
      travelOffsetDays: -2,
    },
    {
      userEmail: 'movil1@est.ups.edu.ec',
      routeKey: 'centenario-rio-daule-retorno',
      driverName: 'Ana Villacís',
      rating: 4,
      comment: 'El retorno de la tarde tuvo buena capacidad disponible.',
      travelOffsetDays: -1,
    },
    {
      userEmail: 'movil2@est.ups.edu.ec',
      routeKey: 'centenario-terminal-25-retorno',
      driverName: 'María Paredes',
      rating: 5,
      comment: 'Buena experiencia general y tiempos correctos.',
      travelOffsetDays: -1,
    },
    {
      userEmail: 'movil3@est.ups.edu.ec',
      routeKey: 'terminal-costa-maria-auxiliadora-ida',
      driverName: 'José Cedeño',
      rating: 4,
      comment: 'La parada de Puerto Azul facilita el acceso desde Vía a la Costa.',
      travelOffsetDays: 0,
    },
    {
      userEmail: 'movil4@est.ups.edu.ec',
      routeKey: 'intercampus-centenario-maria-auxiliadora',
      driverName: 'Luis Herrera',
      rating: 5,
      comment: 'El recorrido intercampus se visualiza completo y con datos consistentes.',
      travelOffsetDays: 0,
    },
  ];

  return {
    users,
    routes,
    stops,
    routeStops,
    schedules,
    vehicles,
    drivers,
    notices,
    tripFeedbacks,
  };
}
