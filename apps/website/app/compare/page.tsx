import type { Metadata } from "next";
import { Comparison } from "@/components/comparison";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "envsec vs dotenv vs 1Password CLI — Comparison",
  description:
    "Compare envsec, dotenv, and 1Password CLI for managing secrets. OS-native encryption vs plaintext files vs cloud vault — features, trade-offs, and migration guide.",
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
