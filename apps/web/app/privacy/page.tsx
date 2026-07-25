import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { LegalDocumentView } from "../../src/components/legal/legal-document-view";
import { buildPrivacyDocument } from "../../src/legal/privacy-document";
import { SITE_URL } from "../../src/site";
import { MARKETING_ROUTES } from "../../src/routes";

const document = buildPrivacyDocument(APP_DISPLAY_NAME);

export const metadata: Metadata = {
  title: document.title,
  description: `${document.title} for ${APP_DISPLAY_NAME}.`,
  alternates: { canonical: `${SITE_URL}${MARKETING_ROUTES.privacy}` },
};

export default function PrivacyPage() {
  return <LegalDocumentView document={document} />;
}
