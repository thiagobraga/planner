import { useReveal } from "./hooks/useReveal";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Proof } from "./components/Proof";
import { Features } from "./components/Features";
import { Showcase } from "./components/Showcase";
import { Benefits } from "./components/Benefits";
import { UseCases } from "./components/UseCases";
import { GetStarted } from "./components/GetStarted";
import { FAQ } from "./components/FAQ";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function App() {
  useReveal();
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">Skip to content</a>
      <Nav />
      <main id="main-content" tabIndex={-1}><Hero /><Proof /><Features /><Showcase /><Benefits /><UseCases /><GetStarted /><FAQ /><CTA /></main>
      <Footer />
    </>
  );
}
