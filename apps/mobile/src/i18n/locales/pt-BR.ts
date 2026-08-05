// T110: MACHINE TRANSLATION — produced by an LLM, not reviewed by a human
// translator or a veterinarian. `reviewed: false` in the locale registry
// (`@bombaypetcompany/config`); this dictionary is NEVER served. Covers
// exactly the sections declared in `TRANSLATED_SECTIONS` (locale-registry.ts)
// -- every §5/§7 safety surface stays English by construction (never
// imported here). Read docs/I18N.md before editing.
import type { LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../../strings";

export const ptBR = {
  tabs: {
    home: "Início",
    care: "Cuidados",
    timeline: "Linha do tempo",
    settings: "Configurações",
  },
  nav: {
    back: "Voltar",
  },
  home: {
    greetingMorning: "Bom dia",
    greetingAfternoon: "Boa tarde",
    greetingEvening: "Boa noite",
    settingsA11y: "Configurações",
    quickActionsTitle: "Ações rápidas",
    quickActions: {
      symptomCheck: "Verificação de sintomas",
      askChat: "Fazer uma pergunta",
    },
    todayTitle: "Hoje",
    todayEmpty: "Nada pendente para hoje.",
    todayError: "Não foi possível carregar a agenda de hoje.",
    todayRetry: "Tentar novamente",
    todayOffline: "Você está offline. Reconecte-se para ver a agenda de hoje.",
    todayOfflineBanner: "Você está offline — mostrando sua última agenda salva.",
    seeAll: "Ver tudo",
    welcomeTitle: "Vamos começar",
    welcomeBody:
      "Tranquilidade entre as visitas ao veterinário — os cuidados do seu pet, tudo em um só lugar.",
  },
  switcher: {
    heading: "Seus pets",
    switchA11y: "Trocar pet ativo",
  },
  care: {
    body: "Os lembretes e modelos de cuidados ficarão aqui.",
    setupCta: "Configurar um plano de cuidados",
    noPet: "Adicione um pet para configurar um plano de cuidados.",
  },
  addPet: {
    homeCta: "Adicionar um pet",
    common: {
      back: "Voltar",
      next: "Próximo",
      skip: "Pular",
      startOver: "Começar de novo",
      stepOf: (step: number, total: number) => `Etapa ${step} de ${total}`,
    },
    species: {
      title: "Que tipo de pet é este?",
      dog: "Cachorro",
      cat: "Gato",
    },
    breed: {
      title: "Qual raça?",
      searchPlaceholder: "Buscar raças",
      skip: "Pular — não sei",
      loading: "Buscando raças…",
      error: "Não foi possível carregar as raças agora.",
      empty: "Nenhuma raça encontrada.",
    },
    details: {
      title: "Conte-nos sobre ele(a)",
      nameLabel: "Nome",
      namePlaceholder: "O nome do seu pet",
      nameRequired: "O nome é obrigatório.",
      sexLabel: "Sexo",
      male: "Macho",
      female: "Fêmea",
      unknown: "Desconhecido",
      neuteredLabel: "Castrado(a)",
      neuteredA11y: "Castrado ou castrada",
      birthDateLabel: "Data de nascimento (AAAA-MM-DD)",
      birthDatePlaceholder: "2022-05-01",
      ageEstimateLabel: "Idade estimada (meses)",
      weightLabel: "Peso (gramas)",
      xorError: "Informe a data de nascimento ou a idade estimada, não ambos.",
    },
    photo: {
      title: "Adicionar uma foto",
      rationale: "Adicione uma foto para reconhecer seu pet rapidamente. Isso é opcional.",
      choosePhoto: "Escolher foto",
      permissionError: "Não conseguimos acessar suas fotos. Você pode pular esta etapa.",
      finish: "Concluir",
      previewA11y: "A foto do seu pet",
    },
    done: {
      submitting: "Adicionando seu pet…",
      createError: "Não foi possível adicionar seu pet. Tente novamente.",
      retry: "Tentar novamente",
    },
  },
} satisfies LocaleOverrides<StringsShape>;
