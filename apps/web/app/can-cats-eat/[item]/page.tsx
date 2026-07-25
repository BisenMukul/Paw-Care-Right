import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { FoodPageView } from "../../../src/components/food/food-page-view";
import { buildFoodPageModel } from "../../../src/food/page-model";
import { staticParamsFor } from "../../../src/food/params";

// Unknown items 404 for real instead of an on-demand-rendered soft-404, and
// guarantees the prerender manifest is the complete page set (D3).
export const dynamicParams = false;

export function generateStaticParams() {
  return staticParamsFor("can-cats-eat");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ item: string }>;
}): Promise<Metadata> {
  const model = buildFoodPageModel("can-cats-eat", (await params).item);
  if (!model) {
    return {};
  }
  return {
    title: model.title,
    description: model.description,
    alternates: { canonical: model.canonicalUrl },
    openGraph: {
      title: model.title,
      description: model.description,
      url: model.canonicalUrl,
      siteName: APP_DISPLAY_NAME,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ item: string }> }) {
  const model = buildFoodPageModel("can-cats-eat", (await params).item);
  if (!model) {
    notFound();
  }
  return <FoodPageView model={model} />;
}
