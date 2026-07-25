import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { LegalDocumentView } from "../../src/components/legal/legal-document-view";
import { buildTermsDocument } from "../../src/legal/terms-document";
import { SITE_URL } from "../../src/site";
import { MARKETING_ROUTES } from "../../src/routes";

const termsDocument = buildTermsDocument(APP_DISPLAY_NAME);

export const metadata: Metadata = {
  title: termsDocument.title,
  description: `${termsDocument.title} for ${APP_DISPLAY_NAME}.`,
  alternates: { canonical: `${SITE_URL}${MARKETING_ROUTES.terms}` },
};

export default function TermsPage() {
  return <LegalDocumentView document={termsDocument} />;
}
