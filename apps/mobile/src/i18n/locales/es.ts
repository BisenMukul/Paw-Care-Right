// T110: MACHINE TRANSLATION — produced by an LLM, not reviewed by a human
// translator or a veterinarian. `reviewed: false` in the locale registry
// (`@bombaypetcompany/config`); this dictionary is NEVER served. Covers
// exactly the sections declared in `TRANSLATED_SECTIONS` (locale-registry.ts)
// -- every §5/§7 safety surface stays English by construction (never
// imported here). Read docs/I18N.md before editing.
import type { LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../../strings";

export const es = {
  tabs: {
    home: "Inicio",
    care: "Cuidado",
    timeline: "Cronología",
    settings: "Ajustes",
  },
  nav: {
    back: "Atrás",
  },
  home: {
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    settingsA11y: "Ajustes",
    quickActionsTitle: "Acciones rápidas",
    quickActions: {
      symptomCheck: "Revisión de síntomas",
      askChat: "Hacer una pregunta",
    },
    todayTitle: "Hoy",
    todayEmpty: "Nada pendiente por hoy.",
    todayError: "No pudimos cargar la agenda de hoy.",
    todayRetry: "Reintentar",
    todayOffline: "Estás sin conexión. Reconéctate para ver la agenda de hoy.",
    todayOfflineBanner: "Estás sin conexión — mostrando tu última agenda guardada.",
    seeAll: "Ver todo",
    welcomeTitle: "Empecemos",
    welcomeBody:
      "Tranquilidad entre visitas al veterinario — el cuidado de tu mascota, todo en un solo lugar.",
  },
  switcher: {
    heading: "Tus mascotas",
    switchA11y: "Cambiar mascota activa",
  },
  care: {
    body: "Aquí vivirán los recordatorios y plantillas de cuidado.",
    setupCta: "Configurar un plan de cuidado",
    noPet: "Añade una mascota para configurar un plan de cuidado.",
  },
  addPet: {
    homeCta: "Añadir una mascota",
    common: {
      back: "Atrás",
      next: "Siguiente",
      skip: "Omitir",
      startOver: "Empezar de nuevo",
      stepOf: (step: number, total: number) => `Paso ${step} de ${total}`,
    },
    species: {
      title: "¿Qué tipo de mascota es?",
      dog: "Perro",
      cat: "Gato",
    },
    breed: {
      title: "¿Qué raza?",
      searchPlaceholder: "Buscar razas",
      skip: "Omitir — no lo sé",
      loading: "Buscando razas…",
      error: "No pudimos cargar las razas en este momento.",
      empty: "No hay razas coincidentes.",
    },
    details: {
      title: "Cuéntanos sobre ellos",
      nameLabel: "Nombre",
      namePlaceholder: "El nombre de tu mascota",
      nameRequired: "El nombre es obligatorio.",
      sexLabel: "Sexo",
      male: "Macho",
      female: "Hembra",
      unknown: "Desconocido",
      neuteredLabel: "Esterilizado / castrado",
      neuteredA11y: "Esterilizado o castrado",
      birthDateLabel: "Fecha de nacimiento (AAAA-MM-DD)",
      birthDatePlaceholder: "2022-05-01",
      ageEstimateLabel: "Edad estimada (meses)",
      weightLabel: "Peso (gramos)",
      xorError: "Ingresa una fecha de nacimiento o una edad estimada, no ambas.",
    },
    photo: {
      title: "Añadir una foto",
      rationale:
        "Añade una foto para poder reconocer a tu mascota de un vistazo. Esto es opcional.",
      choosePhoto: "Elegir foto",
      permissionError: "No pudimos acceder a tus fotos. Puedes omitir este paso.",
      finish: "Finalizar",
      previewA11y: "La foto de tu mascota",
    },
    done: {
      submitting: "Añadiendo tu mascota…",
      createError: "No pudimos añadir a tu mascota. Inténtalo de nuevo.",
      retry: "Reintentar",
    },
  },
} satisfies LocaleOverrides<StringsShape>;
