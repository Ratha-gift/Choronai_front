import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePath } from "@/config/modules";
import { ModuleView } from "@/features/registry";

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug = [] } = await params;
  const module = resolvePath(slug)?.module;
  return { title: module ? `${module.label[0]} | Choronai` : "Choronai" };
}

export default async function Page({ params }: Props) {
  const { slug = [] } = await params;
  if (!resolvePath(slug)) notFound();
  return <ModuleView segments={slug} />;
}
