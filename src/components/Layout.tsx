import { Link, Outlet } from "react-router-dom";
import { SearchBar } from "./SearchBar";

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden>
              ▶
            </span>
            <span>PeekTok</span>
          </Link>
          <SearchBar compact />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        Anonymous viewer — no login. GitHub Pages · no backend (v8).
      </footer>
    </div>
  );
}