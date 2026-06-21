export default function Footer() {
  return (
    <footer>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: 0 }}>
        <span>
          escrow + reputation on{" "}
          <a href="https://docs.arc.io" target="_blank" rel="noreferrer">
            Arc
          </a>{" "}
          · settled in USDC via Circle
        </span>
        <span>
          <a href="https://github.com/PhantomTee/vouch-arc">GitHub</a>
        </span>
      </div>
    </footer>
  );
}
