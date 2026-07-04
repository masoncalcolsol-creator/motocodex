import type { Metadata } from "next";
import { SportsBeta } from "../../components/SportsBeta";
export const revalidate = 300;
export const metadata: Metadata = { title: "NASCAR Sports Intelligence Beta", manifest: "/nascar/manifest.webmanifest" };
export default function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <SportsBeta sport="nascar" searchParams={searchParams} />;
}
