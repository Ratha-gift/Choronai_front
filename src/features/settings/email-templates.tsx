"use client";
import { useState } from "react";
import { Box } from "@/components/ui/box";
import { Tabs } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n";
import { useStored } from "@/lib/store";
import { notify } from "@/lib/toast";

type Template = "addUser" | "activation" | "forgotPassword" | "payment";

const DEFAULTS: Record<Template, string> = {
  addUser:
    "<h2>{logo}</h2>\n<h3>Login Details</h3>\n<p>Hello {client_name},</p>\n<p>We have created a new account for you.</p>\n<pre>Site Link: {site_link}\nUsername: {email}\nPassword: {password}</pre>\n<p>Best regards,<br>{site_name}</p>",
  activation:
    "<p>Hello {user_name},</p>\n<p>Please activate your account: {activation_link}</p>\n<p>{site_name}</p>",
  forgotPassword:
    "<p>Hello {user_name},</p>\n<p>Reset your password here: {reset_password_link}</p>\n<p>{site_name}</p>",
  payment:
    "<p>Dear {contact_person},</p>\n<p>Thank you for your payment for {reference_number}.</p>\n<p>{site_name}</p>",
};

const TAGS: [string, string][] = [
  ["Short tags", "{logo} {site_name} {site_link}"],
  ["Add User", "{client_name} {email} {password}"],
  ["Forgot Password", "{user_name} {email} {reset_password_link}"],
  ["Activation Email", "{user_name} {email} {activation_link}"],
  ["Orders & Payments", "{company} {contact_person} {reference_number}"],
];

export function EmailTemplates() {
  const { l, t } = useLanguage();
  const [saved, setSaved] = useStored("choronai-email-templates-v1", DEFAULTS);
  const [tab, setTab] = useState<Template>("addUser");
  const [drafts, setDrafts] = useState(saved);
  return (
    <Box icon="mail" title={l(["Email Templates", "គំរូអ៊ីមែល"])}>
      <div className="email-layout">
        <div>
          <Tabs<Template>
            value={tab}
            onChange={setTab}
            tabs={[
              ["addUser", l(["Add User", "បន្ថែមអ្នកប្រើ"])],
              ["activation", l(["Activation Email", "អ៊ីមែលបើកគណនី"])],
              ["forgotPassword", l(["Forgot Password", "ភ្លេចពាក្យសម្ងាត់"])],
              ["payment", l(["Payment Received", "បានទទួលការទូទាត់"])],
            ]}
          >
            <textarea
              className="form-control code-editor"
              rows={14}
              aria-label={l(["Template HTML", "HTML គំរូ"])}
              value={drafts[tab]}
              onChange={(event) =>
                setDrafts((old) => ({ ...old, [tab]: event.target.value }))
              }
            />
            <div className="button-row form-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSaved(drafts);
                  notify(t.settingsSaved);
                }}
              >
                {t.save}
              </button>
              <button
                className="btn btn-default"
                onClick={() =>
                  setDrafts((old) => ({ ...old, [tab]: DEFAULTS[tab] }))
                }
              >
                {t.reset}
              </button>
            </div>
          </Tabs>
        </div>
        <aside className="short-tags">
          {TAGS.map(([title, tags]) => (
            <div key={title}>
              <b>{title}</b>
              <code>{tags}</code>
            </div>
          ))}
        </aside>
      </div>
    </Box>
  );
}
