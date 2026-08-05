import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { LegalDocumentView } from "../../src/components/legal/legal-document-view";
import { buildPrivacyDocument } from "../../src/legal/privacy-document";
import { SITE_URL } from "../../src/site";
import { MARKETING_ROUTES } from "../../src/routes";

const privacyDocument = buildPrivacyDocument(APP_DISPLAY_NAME);

export const metadata: Metadata = {
  title: privacyDocument.title,
  description: `${privacyDocument.title} for ${APP_DISPLAY_NAME}.`,
  alternates: { canonical: `${SITE_URL}${MARKETING_ROUTES.privacy}` },
};

export default function PrivacyPage() {
  return <LegalDocumentView document={privacyDocument} />;
}
