import { useEffect } from "react";
import { NavBar } from "./NavBar";
import { useThemeStore } from "../store/theme";

export function Layout({ children }: { children: React.ReactNode }) {
  const apply = useThemeStore((s) => s.apply);
  useEffect(() => {
    apply();
  }, [apply]);
  return (
    <div className="app-container">
      <NavBar />
      <main className="app-main compact">
        {children}
      </main>
    </div>
  );
}
