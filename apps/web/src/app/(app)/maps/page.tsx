"use client";

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import Box from "@cloudscape-design/components/box";
import { useI18n } from "@/lib/i18n";

export default function MapsPage() {
  const { t } = useI18n();

  return (
    <ContentLayout header={<Header variant="h1">{t("page.maps")}</Header>}>
      <Container header={<Header variant="h2">Device Map</Header>}>
        <Box textAlign="center" padding={{ vertical: "xxxl" }} color="text-body-secondary">
          <Box variant="h3" padding={{ bottom: "s" }}>{t("maps.placeholder")}</Box>
          <Box variant="p">
            This will use Leaflet for interactive maps.
          </Box>
        </Box>
      </Container>
    </ContentLayout>
  );
}
