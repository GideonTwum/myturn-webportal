import { type ReactNode } from "react";
import { View } from "react-native";
import { IS_MOCK_UI } from "@/constants/app-mode";
import { DemoBanner } from "@/components/DemoBanner";
import { AuthProvider } from "@/providers/AuthProvider";
import { DemoProvider } from "@/providers/DemoProvider";
import { QueryProvider } from "@/providers/QueryProvider";

export function RootProviders({ children }: { children: ReactNode }) {
  const app = IS_MOCK_UI ? <DemoProvider>{children}</DemoProvider> : children;

  return (
    <QueryProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <DemoBanner />
          {app}
        </View>
      </AuthProvider>
    </QueryProvider>
  );
}
