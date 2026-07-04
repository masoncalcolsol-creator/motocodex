import type { Metadata } from "next";
import { SportsBeta } from "../../components/SportsBeta";
export const revalidate = 300;
export const metadata: Metadata = { title: "NFL Sports Intelligence Beta", manifest: "/nfl/manifest.webmanifest" };
export default function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <SportsBeta sport="nfl" searchParams={searchParams} />;
}
