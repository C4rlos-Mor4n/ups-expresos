/** Personas que hicieron posible UPS GO (pantalla de agradecimientos). */

export interface Contributor {
  name: string;
  initials: string;
  role: string;
  description?: string;
}

export const PROJECT_TUTOR: Contributor = {
  name: "Dario Fernando Huilcapi Subia",
  initials: "DH",
  role: "Tutor y guía del proyecto",
  description: "Acompañó y orientó al equipo durante todo el desarrollo de la app.",
};

export const DEVELOPMENT_TEAM: Contributor[] = [
  {
    name: "Carlos Andrés Morán Vásquez",
    initials: "CM",
    role: "Líder de Proyecto y Desarrollador Full Stack",
    description:
      "Lideró el proyecto de principio a fin y participó en todas sus piezas: backend, app móvil, infraestructura y despliegue.",
  },
  {
    name: "Denisse Andrea Pazmiño Méndez",
    initials: "DP",
    role: "Diseñadora UX/UI y Desarrolladora Backend",
    description:
      "Diseñó la experiencia y la imagen de UPS GO, y construyó servicios del backend que la hacen funcionar.",
  },
  {
    name: "Misael Ariel Delgado Reyes",
    initials: "MD",
    role: "Desarrollador de la App Móvil",
    description: "Colaboró en el desarrollo de la aplicación móvil.",
  },
  {
    name: "José Ignacio Tómala Flores",
    initials: "JT",
    role: "Desarrollador del Portal Web",
    description: "Construye el portal web administrativo de UPS GO.",
  },
];
