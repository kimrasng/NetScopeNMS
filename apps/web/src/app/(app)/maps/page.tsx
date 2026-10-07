"use client";
import dynamic from "next/dynamic";
import Spinner from "@cloudscape-design/components/spinner";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { useI18n } from "@/lib/i18n";
const GeographicMap = dynamic(() => import("@/components/network/geographic-map").then(module => module.GeographicMap), { ssr: false, loading: () => <Spinner /> });
export default function MapsPage() {
  const { t } = useI18n();
  return <ContentLayout header={<Header variant="h1">{t("page.maps")}</Header>}><GeographicMap /></ContentLayout>;
}
