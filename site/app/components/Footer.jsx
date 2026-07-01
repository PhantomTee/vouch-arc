import Ticker from "./Ticker";
import { GITHUB } from "../lib/constants";

export default function Footer() {
  return (
    <footer>
      <Ticker />
      <div className="footer-in">
        <span>
          escrow + reputation on{" "}
          <a href="https://docs.arc.io" target="_blank" rel="noreferrer">
            Arc
          </a>{" "}
          · settled in USDC via Circle
        </span>
        <span>
          <a href={GITHUB}>GitHub</a>
        </span>
      </div>
    </footer>
  );
}
