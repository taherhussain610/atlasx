import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AtlasProvider } from "@/context/atlas-context";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AtlasX — Cross-chain sandbox",
    template: "%s | AtlasX",
  },
  description:
    "Practice swaps, liquidity provision, and staking across four networks without risking mainnet capital.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AtlasProvider>
          <AppShell>{children}</AppShell>
        </AtlasProvider>
      </body>
    </html>
  );
}
