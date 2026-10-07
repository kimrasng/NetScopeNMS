"use client";
import { useState } from "react";
import CollectionPreferences, { type CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";
import { useI18n } from "@/lib/i18n";

export function useTablePreferences(columns: { id: string; label: string; visible?: boolean; alwaysVisible?: boolean }[]) {
  const { t } = useI18n();
  const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({ contentDensity: "comfortable", wrapLines: false, stripedRows: false, contentDisplay: columns.map(column => ({ id: column.id, visible: column.visible !== false })) });
  return {
    columnDisplay: preferences.contentDisplay,
    contentDensity: preferences.contentDensity,
    wrapLines: preferences.wrapLines,
    stripedRows: preferences.stripedRows,
    preferences: <CollectionPreferences preferences={preferences} onConfirm={({ detail }) => setPreferences(detail)} contentDensityPreference={{}} wrapLinesPreference={{}} stripedRowsPreference={{}} contentDisplayPreference={{ options: columns.map(column => ({ id: column.id, label: t(column.label), alwaysVisible: column.alwaysVisible })), title: t("Visible columns"), description: t("Choose and reorder the columns shown in this table.") }} />,
  };
}
