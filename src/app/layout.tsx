import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roava — your travel map",
  description:
    "Save the places you want to go, plan trips day by day, and keep a map of everywhere you have been.",
};

/// Deliberately bare. The signed-in chrome (the nav bar) lives in the (app)
/// group instead, so a shared itinerary at /s/<token> renders as a standalone
/// page rather than inside someone else's private navigation.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
