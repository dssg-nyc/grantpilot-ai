import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Stats from "@/components/landing/Stats";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Stats />
      <Footer />
    </main>
  );
}
