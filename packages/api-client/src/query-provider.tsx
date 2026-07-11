import type { ReactNode, JSX } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { Persister } from "@tanstack/react-query-persist-client";

export interface ApiQueryProviderProps {
  client: QueryClient;
  children: ReactNode;
}

/** Thin wrapper around TanStack Query's `QueryClientProvider`, usable by web and mobile. */
export function ApiQueryProvider(props: ApiQueryProviderProps): JSX.Element {
  return <QueryClientProvider client={props.client}>{props.children}</QueryClientProvider>;
}

export interface PersistedApiQueryProviderProps {
  client: QueryClient;
  persister: Persister;
  children: ReactNode;
}

/**
 * Persisted variant of `ApiQueryProvider`, wrapping TanStack Query's
 * `PersistQueryClientProvider`. `@tanstack/react-query-persist-client` is
 * platform-agnostic JS (no native binary), so it is safe to depend on
 * directly from this core, shared entry point; the `persister` itself is
 * supplied by the caller (e.g. mobile's MMKV-backed persister from the
 * `./mmkv-persister` subpath, which IS native and stays out of this chunk).
 */
export function PersistedApiQueryProvider(props: PersistedApiQueryProviderProps): JSX.Element {
  return (
    <PersistQueryClientProvider
      client={props.client}
      persistOptions={{ persister: props.persister }}
    >
      {props.children}
    </PersistQueryClientProvider>
  );
}
