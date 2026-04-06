import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { InstallSection } from "@/components/install-section";
import { Navbar } from "@/components/navbar";
import { UseCases } from "@/components/use-cases";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "envsec",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  description:
    "Cross-platform CLI for managing environment secrets using native OS credential stores. Secrets never touch disk.",
  url: "https://envsec.dev",
  downloadUrl: "https://www.npmjs.com/package/envsec",
  license: "https://opensource.org/licenses/MIT",
  author: {
    "@type": "Person",
    name: "David Nussio",
    url: "https://github.com/davidnussio",
  },
  codeRepository: "https://github.com/davidnussio/envsec",
  programmingLanguage: "TypeScript",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I clean up .env files scattered across old projects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Import them into envsec with 'envsec -c context load --input path/.env', delete the original files, and regenerate them on-demand with 'envsec -c context env-file --output .env'. Secrets are stored in your OS native credential store instead of plaintext files.",
      },
    },
    {
      "@type": "Question",
      name: "How do I manage different secrets for dev, staging, and production?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use envsec contexts to organize secrets by environment. Store dev secrets with 'envsec -c myapp.dev add key -v value' and production secrets with 'envsec -c myapp.prod add key -v value'. Search across contexts with 'envsec search myapp.*'.",
      },
    },
    {
      "@type": "Question",
      name: "How do I run my app with secrets without exposing them in shell history?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use 'envsec -c context run' with {key} placeholders. Secrets are injected as environment variables of the child process, never appearing in ps output or shell history. Switch contexts with -c to run the same command against different secret sets.",
      },
    },
    {
      "@type": "Question",
      name: "How do I generate a .env file for tools that require one?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Run 'envsec -c context env-file --output .env.local' to generate a .env file on-demand from your credential store. Useful for Docker Compose, frameworks, and other tools that require a physical .env file.",
      },
    },
    {
      "@type": "Question",
      name: "How do I check for expired or expiring secrets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Run 'envsec audit' to check all contexts, or 'envsec -c context audit --within 7d' for a specific context and time window. envsec tracks expiry metadata and flags expired or soon-to-expire credentials.",
      },
    },
    {
      "@type": "Question",
      name: "How do I securely share secrets with a teammate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use 'envsec -c context share --encrypt-to recipient@email -o secrets.enc' to GPG-encrypt secrets. The recipient decrypts with 'gpg --decrypt secrets.enc' and imports with 'envsec load'. No Slack or email needed.",
      },
    },
    {
      "@type": "Question",
      name: "How do I use Next.js without keeping secrets in .env.local?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pull env vars with 'vercel env pull', import them with 'envsec -c my-nextjs-app load -i .env.local', delete the file, then run 'envsec -c my-nextjs-app shell' to start a shell with secrets injected as environment variables. Run 'pnpm run dev' inside that shell — Next.js picks them up automatically, no .env.local on disk.",
      },
    },
    {
      "@type": "Question",
      name: "How do I export secrets as environment variables in my current shell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Run 'eval $(envsec -c context env)' for bash/zsh. envsec also supports fish ('envsec env --shell fish') and PowerShell ('envsec env --shell powershell'). Keys are converted to UPPER_SNAKE_CASE automatically.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        id="json-ld"
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        id="faq-json-ld"
        type="application/ld+json"
      />
      <Navbar />
      <main className="py-12">
        <Hero />
        <Features />
        <HowItWorks />
        <UseCases />
        <InstallSection />
      </main>
      <Footer />
    </>
  );
}
