import Layout from "@/components/layout/Layout";
import { SignatureSettings } from "@/components/settings/SignatureSettings";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Configure your account preferences and outreach settings
            </p>
          </div>
        </div>

        <div className="max-w-3xl">
          <SignatureSettings />
        </div>
      </div>
    </Layout>
  );
}
