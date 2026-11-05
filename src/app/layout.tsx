import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parcel Lab | REA hardening experiment",
  description: "An educational parcel quote app for comparing REA analysis before and after die-a-rea hardening.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip" href="#quote-form">Skip to quote</a>{children}</body></html>;
}
