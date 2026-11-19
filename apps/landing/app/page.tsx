import { Features } from "../components/features";
import { Footer } from "../components/footer";
import { Hero } from "../components/hero";
import { Nav } from "../components/nav";
import { PackagesTable } from "../components/packages-table";
import { Pipeline } from "../components/pipeline";
import { Quickstart } from "../components/quickstart";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Pipeline />
        <Quickstart />
        <PackagesTable />
      </main>
      <Footer />
    </>
  );
}
