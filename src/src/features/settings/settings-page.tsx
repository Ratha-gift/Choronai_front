"use client";
import { useState } from "react";
import type { IconName } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { Fieldset, FormGrid } from "@/components/ui/fields";
import { useLanguage, type Label } from "@/i18n";
import { notify } from "@/lib/toast";
import { FieldControl } from "@/features/resources/resource-form";
import type { SettingSection } from "./definitions";
import { saveSettings, useSettings, type SettingsName } from "./store";

export function SettingsPage({
  name,
  sections,
  title,
  icon,
}: {
  name: SettingsName;
  sections: SettingSection[];
  title: Label;
  icon: IconName;
}) {
  const { l, t, setLanguage } = useLanguage();
  const [saved] = useSettings(name);
  const [values, setValues] = useState(saved);
  return (
    <Box icon={icon} title={l(title)} intro={t.formIntro}>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveSettings(name, values);
          if (
            name === "system" &&
            (values.language === "en" || values.language === "km")
          )
            setLanguage(values.language);
          notify(t.settingsSaved);
        }}
      >
        {sections.map((section) => (
          <Fieldset key={section.id} legend={l(section.legend)}>
            {section.note && <p className="help-note">{l(section.note)}</p>}
            <FormGrid columns={3}>
              {section.fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={{ ...field, required: field.required }}
                  value={values[field.key]}
                  onChange={(value) =>
                    setValues((old) => ({ ...old, [field.key]: value }))
                  }
                />
              ))}
            </FormGrid>
          </Fieldset>
        ))}
        <button className="btn btn-primary" type="submit">
          {t.updateSettings}
        </button>
      </form>
    </Box>
  );
}
