import type { Metadata } from "next";
import { Comparison } from "@/components/comparison";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "envsec vs dotenv — Comparison",
  description:
    "envsec vs dotenv: store Node.js secrets in your OS keychain instead of plaintext .env files. No git leak risk, no cloud, MIT licensed.",
  alternates: {
    canonical: "/compare",
  },
};

export default function ComparePage() {
  return (
    <>
      <Navbar />
      <main className="pt-14">
        <Comparison />
      </main>
      <Footer />
    </>
  );
}
