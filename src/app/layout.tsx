import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

/// The brand kit's pairing: Bricolage Grotesque for titles, Geist for
/// everything else. Both self-hosted by next/font, so no request leaves for
/// Google's servers at render time.
///
/// This replaces DM Serif Display and Inter. The serif is gone entirely — the
/// kit sets its display type in a heavy grotesque, so the "editorial serif
/// moment" the old guide asked for is now a weight, not a face.
const display = Bricolage_Grotesque({
  // Variable across the range; 800 is what the kit's titles are set in.
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Geist({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Roava — your travel map",
  description:
    "Save the places you want to go, plan trips day by day, and keep a map of everywhere you have been.",
  icons: {
    icon: "/brand/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
};

/// Deliberately bare. The signed-in chrome (the nav bar) lives in the (app)
/// group instead, so a shared itinerary at /s/<token> renders as a standalone
/// page rather than inside someone else's private navigation.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
