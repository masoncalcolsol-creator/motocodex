import type { Metadata } from "next";
import { SportsBeta } from "../../components/SportsBeta";
export const revalidate = 300;
export const metadata: Metadata = { title: "MLB Sports Intelligence Beta", manifest: "/mlb/manifest.webmanifest" };
export default function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <SportsBeta sport="mlb" searchParams={searchParams} />;
}
