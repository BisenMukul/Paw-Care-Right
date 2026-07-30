// T110: MACHINE TRANSLATION — produced by an LLM, not reviewed by a human
// translator or a veterinarian. `reviewed: false` in the locale registry
// (`@bombaypetcompany/config`); this dictionary is NEVER served. Covers
// exactly the sections declared in `TRANSLATED_SECTIONS` (locale-registry.ts)
// -- every §5/§7 safety surface stays English by construction (never
// imported here). Read docs/I18N.md before editing.
import type { LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../../strings";

export const hi = {
  tabs: {
    home: "होम",
    care: "देखभाल",
    timeline: "समयरेखा",
    settings: "सेटिंग्स",
  },
  nav: {
    back: "वापस",
  },
  home: {
    greetingMorning: "सुप्रभात",
    greetingAfternoon: "नमस्कार",
    greetingEvening: "शुभ संध्या",
    settingsA11y: "सेटिंग्स",
    quickActionsTitle: "त्वरित कार्य",
    quickActions: {
      symptomCheck: "लक्षण जांच",
      askChat: "एक सवाल पूछें",
    },
    todayTitle: "आज",
    todayEmpty: "आज के लिए कुछ भी बाकी नहीं है।",
    todayError: "हम आज का एजेंडा लोड नहीं कर सके।",
    todayRetry: "पुनः प्रयास करें",
    todayOffline: "आप ऑफ़लाइन हैं। आज का एजेंडा देखने के लिए फिर से जुड़ें।",
    todayOfflineBanner: "आप ऑफ़लाइन हैं — आपका अंतिम सहेजा गया एजेंडा दिखाया जा रहा है।",
    seeAll: "सभी देखें",
    welcomeTitle: "चलिए शुरू करते हैं",
    welcomeBody:
      "पशु चिकित्सक की यात्राओं के बीच मन की शांति — आपके पालतू जानवर की देखभाल, सब एक ही जगह।",
  },
  switcher: {
    heading: "आपके पालतू जानवर",
    switchA11y: "सक्रिय पालतू जानवर बदलें",
  },
  care: {
    body: "देखभाल अनुस्मारक और टेम्पलेट यहाँ दिखाई देंगे।",
    setupCta: "एक देखभाल योजना सेट करें",
    noPet: "देखभाल योजना सेट करने के लिए एक पालतू जानवर जोड़ें।",
  },
  addPet: {
    homeCta: "एक पालतू जानवर जोड़ें",
    common: {
      back: "वापस",
      next: "अगला",
      skip: "छोड़ें",
      startOver: "फिर से शुरू करें",
      stepOf: (step: number, total: number) => `चरण ${step} में से ${total}`,
    },
    species: {
      title: "यह किस प्रकार का पालतू जानवर है?",
      dog: "कुत्ता",
      cat: "बिल्ली",
    },
    breed: {
      title: "कौन सी नस्ल?",
      searchPlaceholder: "नस्लें खोजें",
      skip: "छोड़ें — मुझे नहीं पता",
      loading: "नस्लें खोजी जा रही हैं…",
      error: "अभी हम नस्लें लोड नहीं कर सके।",
      empty: "कोई मिलती-जुलती नस्ल नहीं मिली।",
    },
    details: {
      title: "हमें उनके बारे में बताएं",
      nameLabel: "नाम",
      namePlaceholder: "आपके पालतू जानवर का नाम",
      nameRequired: "नाम आवश्यक है।",
      sexLabel: "लिंग",
      male: "नर",
      female: "मादा",
      unknown: "अज्ञात",
      neuteredLabel: "नसबंदी की गई",
      neuteredA11y: "नसबंदी की गई",
      birthDateLabel: "जन्म तिथि (YYYY-MM-DD)",
      birthDatePlaceholder: "2022-05-01",
      ageEstimateLabel: "अनुमानित आयु (महीने)",
      weightLabel: "वजन (ग्राम)",
      xorError: "जन्म तिथि या अनुमानित आयु में से कोई एक दर्ज करें, दोनों नहीं।",
    },
    photo: {
      title: "एक फ़ोटो जोड़ें",
      rationale: "एक नज़र में अपने पालतू जानवर को पहचानने के लिए फ़ोटो जोड़ें। यह वैकल्पिक है।",
      choosePhoto: "फ़ोटो चुनें",
      permissionError: "हम आपकी फ़ोटो तक नहीं पहुँच सके। आप इस चरण को छोड़ सकते हैं।",
      finish: "समाप्त करें",
      previewA11y: "आपके पालतू जानवर की फ़ोटो",
    },
    done: {
      submitting: "आपका पालतू जानवर जोड़ा जा रहा है…",
      createError: "हम आपके पालतू जानवर को जोड़ नहीं सके। कृपया फिर से प्रयास करें।",
      retry: "पुनः प्रयास करें",
    },
  },
} satisfies LocaleOverrides<StringsShape>;
