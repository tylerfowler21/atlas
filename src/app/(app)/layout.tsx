import NavBar from "@/components/NavBar";

/// Everything the trip owner sees: the nav bar plus the scrolling main area.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <NavBar />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </>
  );
}
