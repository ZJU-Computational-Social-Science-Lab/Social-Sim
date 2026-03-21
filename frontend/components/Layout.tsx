import { NavBar, type NavBarVariant } from "./NavBar";

export function Layout({
  children,
  navVariant = "default",
}: {
  children: React.ReactNode;
  navVariant?: NavBarVariant;
}) {
  const isProduct = navVariant === "product";

  return (
    <div className={`app-container ${isProduct ? "app-container--product-shell" : ""}`}>
      <NavBar variant={navVariant} />
      <main className={`app-main ${isProduct ? "app-main--product-shell" : "compact ss-workbench"}`}>
        {children}
      </main>
    </div>
  );
}
