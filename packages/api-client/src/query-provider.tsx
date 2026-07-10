import type { ReactNode, JSX } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export interface ApiQueryProviderProps {
  client: QueryClient;
  children: ReactNode;
}

/** Thin wrapper around TanStack Query's `QueryClientProvider`, usable by web and mobile. */
export function ApiQueryProvider(props: ApiQueryProviderProps): JSX.Element {
  return <QueryClientProvider client={props.client}>{props.children}</QueryClientProvider>;
}
