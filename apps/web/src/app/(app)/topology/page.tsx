"use client";
import dynamic from "next/dynamic";
import Spinner from "@cloudscape-design/components/spinner";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { useI18n } from "@/lib/i18n";
const TopologyViewer = dynamic(() => import("@/components/network/topology-viewer").then(module => module.TopologyViewer), { ssr: false, loading: () => <Spinner /> });
export default function TopologyPage() {
  const { t } = useI18n();
  return <ContentLayout header={<Header variant="h1">{t("page.topology")}</Header>}><TopologyViewer /></ContentLayout>;
}
