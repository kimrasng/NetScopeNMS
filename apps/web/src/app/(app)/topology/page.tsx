"use client";

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import Box from "@cloudscape-design/components/box";
import { useI18n } from "@/lib/i18n";

export default function TopologyPage() {
  const { t } = useI18n();

  return (
    <ContentLayout header={<Header variant="h1">{t("page.topology")}</Header>}>
      <Container header={<Header variant="h2">Topology Viewer</Header>}>
        <Box textAlign="center" padding={{ vertical: "xxxl" }} color="text-body-secondary">
          <Box variant="h3" padding={{ bottom: "s" }}>{t("topology.placeholder")}</Box>
          <Box variant="p">
            This will use ReactFlow for interactive network diagrams.
          </Box>
        </Box>
      </Container>
    </ContentLayout>
  );
}
