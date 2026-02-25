import type { ReactNode } from "react";
import { Fraunces, Source_Sans_3, Space_Grotesk } from "next/font/google";

import "./login.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-login-space",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-login-source",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-login-fraunces",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${sourceSans.variable} ${fraunces.variable}`}>
      {children}
    </div>
  );
}

