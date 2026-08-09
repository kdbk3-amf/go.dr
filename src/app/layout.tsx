import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Go Dr — Healthcare for Bangladesh",
    template: "%s | Go Dr",
  },
  description:
    "Go Dr connects patients across Bangladesh with verified doctors, hospitals and easy appointment booking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
