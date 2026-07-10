import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { strings } from "../src/strings";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold text-brand-700">
        {APP_DISPLAY_NAME}
      </h1>
      <p className="text-lg text-brand-500">{strings.landing.tagline}</p>
      <p className="max-w-xl text-base text-brand-900">
        {strings.landing.body}
      </p>
      <span className="rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-700">
        {strings.landing.cta}
      </span>
    </main>
  );
}
