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
    role: "Líder de desarrollo",
    description: "Coordinó todo el desarrollo y apoyó en el backend, la infraestructura y la app.",
  },
  {
    name: "Denisse Andrea Pazmiño Méndez",
    initials: "DP",
    role: "Diseñadora y jefa de arquitectura",
    description: "Lideró el diseño de la experiencia y la arquitectura de la solución.",
  },
  {
    name: "Misael Ariel Delgado Reyes",
    initials: "MD",
    role: "Desarrollador",
  },
  {
    name: "José Ignacio Tómala Flores",
    initials: "JT",
    role: "Desarrollador",
  },
];
