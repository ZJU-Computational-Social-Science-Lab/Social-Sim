import { useEffect } from "react";

import { NavBar } from "./NavBar";
import { useThemeStore } from "../store/theme";

export function Layout({ children }: { children: React.ReactNode }) {
  const apply = useThemeStore((state) => state.apply);

  useEffect(() => {
    apply();
  }, [apply]);

  return (
    <div className="app-container">
      <NavBar />
      <main className="app-main compact">
        <div className="product-shell">{children}</div>
      </main>
    </div>
  );
}
