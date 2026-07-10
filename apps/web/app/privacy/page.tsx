import { strings } from "../../src/strings";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">{strings.privacy.title}</h1>
      <p className="mt-4 text-base">{strings.privacy.body}</p>
    </main>
  );
}
