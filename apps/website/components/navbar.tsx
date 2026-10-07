"use client";

import { Menu, Shield, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight"
          href="/"
        >
          <Shield className="h-5 w-5 text-emerald-400" />
          <span>envsec</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/#features"
            onClick={() => trackEvent("nav_click", { link: "features" })}
          >
            Features
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/#how-it-works"
            onClick={() => trackEvent("nav_click", { link: "how-it-works" })}
          >
            How it works
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/#use-cases"
            onClick={() => trackEvent("nav_click", { link: "use-cases" })}
          >
            Use Cases
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/#install"
            onClick={() => trackEvent("nav_click", { link: "install" })}
          >
            Install
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/compare"
            onClick={() => trackEvent("nav_click", { link: "compare" })}
          >
            Compare
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/docs"
            onClick={() => trackEvent("nav_click", { link: "docs" })}
          >
            Docs
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="/blog"
            onClick={() => trackEvent("nav_click", { link: "blog" })}
          >
            Blog
          </Link>
          <a
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-emerald-500 text-black hover:bg-emerald-400"
            )}
            href="https://github.com/davidnussio/envsec"
            onClick={() => trackEvent("nav_click", { link: "github" })}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>

        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          type="button"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-black/95 px-4 py-4 sm:px-6 md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              className="text-muted-foreground text-sm"
              href="/#features"
              onClick={() => {
                trackEvent("nav_click", { link: "features" });
                setMobileOpen(false);
              }}
            >
              Features
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/#how-it-works"
              onClick={() => {
                trackEvent("nav_click", { link: "how-it-works" });
                setMobileOpen(false);
              }}
            >
              How it works
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/#use-cases"
              onClick={() => {
                trackEvent("nav_click", { link: "use-cases" });
                setMobileOpen(false);
              }}
            >
              Use Cases
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/#install"
              onClick={() => {
                trackEvent("nav_click", { link: "install" });
                setMobileOpen(false);
              }}
            >
              Install
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/compare"
              onClick={() => {
                trackEvent("nav_click", { link: "compare" });
                setMobileOpen(false);
              }}
            >
              Compare
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/docs"
              onClick={() => {
                trackEvent("nav_click", { link: "docs" });
                setMobileOpen(false);
              }}
            >
              Docs
            </Link>
            <Link
              className="text-muted-foreground text-sm"
              href="/blog"
              onClick={() => {
                trackEvent("nav_click", { link: "blog" });
                setMobileOpen(false);
              }}
            >
              Blog
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
