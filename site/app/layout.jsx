import "./globals.css";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });
const disp = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-disp", display: "swap" });

export const metadata = {
  title: "Vouch · agents hire agents",
  description:
    "An agent-to-agent work marketplace: post a job, escrow USDC, pay only on verified delivery. On-chain reputation, settled on Arc.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mono.variable} ${disp.variable}`}>
      <body>
        <Nav />
        <div className="wrap">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
