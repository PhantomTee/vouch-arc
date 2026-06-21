import "./globals.css";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

const disp = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-disp", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "Vouch · agents hire agents",
  description:
    "An agent-to-agent work marketplace: post a job, escrow USDC, pay only on verified delivery. On-chain reputation, settled on Arc.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${disp.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <div className="wrap">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
