import type { Metadata } from "next";
import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { strings } from "../src/strings";
import "./globals.css";

export const metadata: Metadata = {
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
