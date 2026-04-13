import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Klonstudio",
  description: "AI video generation dashboard for upload, scene refinement, queue orchestration, and Remotion subtitle rendering."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
