import type { EmergencyPayload } from "./schema";

/**
 * PINNED (T049 plan "The 22 rows") — transcribed verbatim. `key` equals a
 * `RED_FLAG_RULES` `emergencyPayloadKey` (packages/ai/src/rules/rules-table.ts).
 * §7-clean: no dosing, no drug names as recommendations, no "diagnosis"/
 * "diagnose", always urgent, never "wait and see".
 */
export const EMERGENCY_PAYLOAD_ROWS: readonly EmergencyPayload[] = [
  {
    key: "toxin-ingestion",
    title: "Possible poisoning — act now",
    detected: "You told us your pet may have eaten or been exposed to something poisonous.",
    guidance:
      "Go to a vet or emergency clinic straight away. If you can, bring the packaging, plant, or a photo of what they got into. Do not try to make your pet vomit unless a vet or poison line tells you to.",
  },
  {
    key: "gdv-suspected",
    title: "Possible bloat — get to a vet now",
    detected:
      "You described repeated retching with a swollen, hard belly — signs that can mean a twisted, bloated stomach in dogs.",
    guidance:
      "This can become life-threatening within hours. Go to the nearest open vet or emergency clinic right now, and call ahead so they can prepare.",
  },
  {
    key: "urinary-blockage-cat",
    title: "Possible urinary blockage — go now",
    detected: "You described a cat straining to urinate. In cats this can mean a blocked bladder.",
    guidance:
      "A blocked cat needs urgent care and this can become fatal within hours. Go to the nearest open vet or emergency clinic now.",
  },
  {
    key: "seizure-prolonged-or-repeated",
    title: "Seizure — get help now",
    detected: "You described a seizure that is long-lasting or happening again and again.",
    guidance:
      "Keep your pet away from stairs, water, and furniture edges, and keep your hands away from their mouth. Go to the nearest vet or emergency clinic right away; call ahead if you can.",
  },
  {
    key: "collapse-unresponsive",
    title: "Collapse — go now",
    detected: "You told us your pet has collapsed or won't respond.",
    guidance:
      "Go to the nearest open vet or emergency clinic immediately. Keep your pet warm and handle them gently on the way, and call ahead so they can be ready.",
  },
  {
    key: "abnormal-gum-color",
    title: "Abnormal gum colour — go now",
    detected:
      "You described pale, white, blue, or grey gums, which can mean your pet is not getting enough oxygen or is in shock.",
    guidance: "This is an emergency. Go to the nearest open vet or emergency clinic straight away and call ahead.",
  },
  {
    key: "breathing-difficulty",
    title: "Trouble breathing — go now",
    detected: "You told us your pet is struggling to breathe.",
    guidance:
      "Keep your pet calm and cool and avoid any handling that adds stress. Go to the nearest open vet or emergency clinic right now and call ahead.",
  },
  {
    key: "uncontrolled-bleeding",
    title: "Heavy bleeding — go now",
    detected: "You described bleeding that won't stop.",
    guidance:
      "Press a clean cloth firmly on the wound and keep the pressure on while you travel. Go to the nearest open vet or emergency clinic immediately.",
  },
  {
    key: "heatstroke",
    title: "Possible heatstroke — act now",
    detected: "You described signs of overheating or heatstroke.",
    guidance:
      "Move your pet to a cool, shaded place and offer small sips of water. Get to the nearest open vet or emergency clinic right away — heatstroke worsens fast.",
  },
  {
    key: "envenomation",
    title: "Bite or sting — go now",
    detected:
      "You told us your pet may have been bitten or stung by a snake, scorpion, or other venomous animal.",
    guidance:
      "Keep your pet as still and calm as possible and go to the nearest open vet or emergency clinic straight away. Never try to catch the animal that bit them.",
  },
  {
    key: "major-trauma",
    title: "Serious injury — go now",
    detected: "You described a major injury, such as being hit by a vehicle or a fall from height.",
    guidance:
      "Even if your pet seems okay, internal injuries are possible. Move them gently, supporting the whole body, and go to the nearest open vet or emergency clinic now.",
  },
  {
    key: "ocular-emergency",
    title: "Eye emergency — go now",
    detected: "You described a bulging eye or a sudden loss of vision.",
    guidance:
      "Stop your pet from rubbing or pawing the eye, and keep it moist if you can. Go to the nearest open vet or emergency clinic straight away — eyes can be lost quickly.",
  },
  {
    key: "sudden-inability-to-stand",
    title: "Sudden weakness — go now",
    detected: "You told us your pet suddenly can't stand or walk.",
    guidance:
      "Keep your pet still and support their body when you move them. Go to the nearest open vet or emergency clinic right away.",
  },
  {
    key: "chocolate-ingestion-dog",
    title: "Chocolate eaten — act now",
    detected: "You told us your dog ate chocolate, which can be poisonous to dogs.",
    guidance:
      "Contact a vet or a pet poison line straight away and bring the wrapper or packaging so they know how much and what kind. Don't wait for symptoms to appear.",
  },
  {
    key: "xylitol-ingestion-dog",
    title: "Sugar-free product eaten — act now",
    detected:
      "You told us your dog ate gum, sweets, or another product that may contain xylitol, which is very dangerous for dogs.",
    guidance:
      "Contact a vet or a pet poison line right away and bring the packaging. This can affect your dog quickly, so don't wait for symptoms.",
  },
  {
    key: "rodenticide-exposure",
    title: "Rat poison exposure — act now",
    detected: "You told us your pet may have been exposed to rat or mouse poison.",
    guidance:
      "Go to a vet or contact a pet poison line straight away and bring the product packaging if you have it. Signs can be delayed, so act now rather than waiting.",
  },
  {
    key: "linear-foreign-body-cat",
    title: "Swallowed string — go now",
    detected: "You described your cat swallowing string, thread, or something similar.",
    guidance:
      "Never pull on any string you can see — this can cause serious internal injury. Go to the nearest open vet or emergency clinic straight away.",
  },
  {
    key: "distended-abdomen",
    title: "Swollen belly — go now",
    detected: "You described a bloated, swollen, or hard belly.",
    guidance:
      "A suddenly swollen abdomen can be an emergency. Go to the nearest open vet or emergency clinic now and call ahead.",
  },
  {
    key: "urinary-obstruction-signs-cat",
    title: "Urinary emergency — go now",
    detected:
      "You described a cat straining to urinate together with blood — signs of a possible urinary blockage.",
    guidance: "This can become life-threatening quickly. Go to the nearest open vet or emergency clinic right away.",
  },
  {
    key: "open-fracture-or-deep-wound",
    title: "Serious wound — go now",
    detected: "You described an open fracture or a deep wound.",
    guidance:
      "Cover the area with a clean cloth and press gently to slow any bleeding. Go to the nearest open vet or emergency clinic immediately.",
  },
  {
    key: "birthing-distress",
    title: "Birthing trouble — go now",
    detected: "You described difficulty or a long delay during labour.",
    guidance:
      "A stuck newborn or prolonged labour is an emergency for the mother and the babies. Go to the nearest open vet or emergency clinic right away.",
  },
  {
    key: "neonatal-collapse",
    title: "Newborn in danger — go now",
    detected: "You described a newborn puppy or kitten that is limp, cold, or not feeding.",
    guidance:
      "Keep the newborn gently warm against your body and go to the nearest open vet or emergency clinic straight away. Newborns can fade very quickly.",
  },
];

/** NOT counted in the 22 — used only as the fail-upward generic fallback. */
export const GENERIC_EMERGENCY_PAYLOAD_ROW: EmergencyPayload = {
  key: "generic-emergency",
  title: "This may be an emergency",
  detected: "Based on what you shared, your pet may need urgent care.",
  guidance:
    "Go to the nearest open vet or emergency clinic right away. If you're not sure where to go, use the button below to find an emergency vet near you.",
};
