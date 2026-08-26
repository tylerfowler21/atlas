import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";

/// The brand guide's pairing: a display serif for headings — its "editorial
/// serif moments" — and Inter for everything else. Self-hosted by next/font,
/// so no request leaves for Google's servers at render time.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Inter({
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
