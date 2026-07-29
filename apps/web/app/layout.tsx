import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import { strings } from "../src/strings";
import { SITE_URL } from "../src/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_DISPLAY_NAME,
  description: strings.layout.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
