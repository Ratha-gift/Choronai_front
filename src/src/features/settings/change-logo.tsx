"use client";
import { useState } from "react";
import { Box } from "@/components/ui/box";
import { Field } from "@/components/ui/fields";
import { useLanguage } from "@/i18n";
import { useStored } from "@/lib/store";
import { notify } from "@/lib/toast";

export const LOGO_KEY = "choronai-logo-v1";
export const NO_LOGO = "";

export function ChangeLogo() {
  const { l, t } = useLanguage();
  const [logo, setLogo] = useStored(LOGO_KEY, NO_LOGO);
  const [preview, setPreview] = useState(logo);
  return (
    <Box
      icon="upload"
      title={l(["Change Logo", "ប្ដូរឡូហ្គោ"])}
      intro={t.formIntro}
    >
      <div className="logo-page">
        <div className="logo-preview">
          {preview ? <img src={preview} alt="" /> : <span>CHORONAI</span>}
        </div>
        <Field
          label={l(["Site Logo", "ឡូហ្គោហាង"])}
          hint={l([
            "PNG or SVG with a transparent background, max 300 KB. Shown in the header and on receipts.",
            "PNG ឬ SVG ផ្ទៃថ្លា អតិបរមា 300 KB។ បង្ហាញលើក្បាលទំព័រ និងវិក្កយបត្រ។",
          ])}
        >
          <input
            className="form-control"
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 300 * 1024) {
                notify(
                  l([
                    "Choose an image smaller than 300 KB",
                    "សូមជ្រើសរូបភាពតូចជាង 300 KB",
                  ]),
                );
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPreview(String(reader.result ?? ""));
              reader.readAsDataURL(file);
            }}
          />
        </Field>
        <div className="button-row">
          <button
            className="btn btn-primary"
            onClick={() => {
              setLogo(preview);
              notify(t.settingsSaved);
            }}
          >
            {l(["Upload Logo", "បញ្ចូលឡូហ្គោ"])}
          </button>
          <button
            className="btn btn-default"
            onClick={() => {
              setPreview(NO_LOGO);
              setLogo(NO_LOGO);
            }}
          >
            {l(["Use text logo", "ប្រើឈ្មោះជាអក្សរ"])}
          </button>
        </div>
      </div>
    </Box>
  );
}
