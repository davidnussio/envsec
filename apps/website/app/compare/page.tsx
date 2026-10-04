import type { Metadata } from "next";

import { Comparison } from "@/components/comparison";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  alternates: {
    canonical: "/compare",
  },
  description:
    "Compare envsec, dotenv, and 1Password CLI for managing secrets. OS-native encryption vs plaintext files vs cloud vault — features, trade-offs, and migration guide.",
  title: "envsec vs dotenv vs 1Password CLI — Comparison",
};

const ComparePage = () => (
  <>
    <Navbar />
    <main className="pt-14">
      <Comparison />
    </main>
    <Footer />
  </>
);

export default ComparePage;
