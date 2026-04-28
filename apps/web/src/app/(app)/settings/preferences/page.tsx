"use client";

import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Select from "@cloudscape-design/components/select";
import { useI18n, type Locale } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useNotifications } from "@/hooks/use-notifications";

const LANGUAGE_OPTIONS = [
  { label: "한국어", value: "ko" },
  { label: "English", value: "en" },
];

const THEME_OPTIONS_KO = [
  { label: "시스템 설정", value: "system" },
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
];

const THEME_OPTIONS_EN = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export default function PreferencesPage() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { addNotification } = useNotifications();

  const themeOptions = locale === "ko" ? THEME_OPTIONS_KO : THEME_OPTIONS_EN;

  return (
    <ContentLayout header={<Header variant="h1">{t("page.preferences")}</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">{t("preferences.language")}</Header>}>
          <FormField description={t("preferences.language.desc")}>
            <Select
              selectedOption={LANGUAGE_OPTIONS.find((o) => o.value === locale) ?? LANGUAGE_OPTIONS[0]}
              options={LANGUAGE_OPTIONS}
              onChange={({ detail }) => {
                setLocale(detail.selectedOption.value as Locale);
                addNotification({ type: "success", content: detail.selectedOption.value === "ko" ? "언어가 변경되었습니다" : "Language changed" });
              }}
            />
          </FormField>
        </Container>

        <Container header={<Header variant="h2">{t("preferences.theme")}</Header>}>
          <FormField description={t("preferences.theme.desc")}>
            <Select
              selectedOption={themeOptions.find((o) => o.value === theme) ?? themeOptions[0]}
              options={themeOptions}
              onChange={({ detail }) => {
                setTheme(detail.selectedOption.value as ThemeMode);
                addNotification({ type: "success", content: t("preferences.saved") });
              }}
            />
          </FormField>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
