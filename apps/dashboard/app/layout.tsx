import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AI Job Search Agent",
  description: "Human-in-the-loop control plane",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
