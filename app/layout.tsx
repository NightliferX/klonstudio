import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "HERR TECH. Social Video Creator",
  description: "AI video generation workflow for upload, scene refinement, queue orchestration and vertical social video export."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
