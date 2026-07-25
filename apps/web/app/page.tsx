import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { LandingView } from "../src/components/marketing/landing-view";
import { buildLandingModel } from "../src/marketing/landing-content";
import { strings } from "../src/strings";
import { SITE_URL } from "../src/site";

export const metadata: Metadata = {
  title: APP_DISPLAY_NAME,
  description: strings.layout.description,
  alternates: { canonical: SITE_URL },
};

export default function HomePage() {
  const model = buildLandingModel(APP_DISPLAY_NAME);
  return <LandingView model={model} />;
}
