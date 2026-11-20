"use client";

import { useParams, usePathname } from "next/navigation";
import { TeamPageHeader } from "@/components/issues/team-page-header";

const PAGES = [
  { path: "", label: "General" },
  { path: "/members", label: "Members" },
  { path: "/teams", label: "Teams" },
  { path: "/labels", label: "Labels" },
  { path: "/billing", label: "Billing" },
  { path: "/roles", label: "Roles" },
  { path: "/audit-log", label: "Audit log" },
];

/** Settings pages share one header whose tabs switch between them. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const pathname = usePathname();
  const base = `/${orgSlug}/settings`;
  const nav = PAGES.map(({ path, label }) => {
    const href = `${base}${path}`;
    return {
      href,
      label,
      active: path === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`),
    };
  });
  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader title="Settings" nav={nav} />
      <div className="flex flex-1 flex-col px-3 pt-6 pb-12 md:px-6">{children}</div>
    </div>
  );
}
