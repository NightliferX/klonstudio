import Link from "next/link";
import { cn } from "@/lib/utils";

type HeaderAction = {
  href: string;
  label: string;
  accent?: boolean;
};

type AppHeaderProps = {
  crumb: string;
  actions: HeaderAction[];
};

export function AppHeader({ crumb, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1660px] items-center justify-between px-4 py-5 md:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-4">
          <span className="font-display text-[2rem] uppercase tracking-[-0.08em] text-white">
            <span className="bg-[linear-gradient(180deg,#ffffff_0%,#d8c0ff_48%,#8d5cff_100%)] bg-clip-text text-transparent">
              HERR TECH.
            </span>
          </span>
          <span className="hidden text-lg text-white/28 md:inline">{crumb}</span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-3">
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition md:px-5",
                action.accent
                  ? "border-violet-300/40 bg-[linear-gradient(180deg,rgba(224,198,255,0.96),rgba(172,117,255,0.94))] text-black shadow-[0_0_24px_rgba(176,38,255,0.24)]"
                  : "border-white/10 bg-black/45 text-white/74 hover:border-violet-300/30 hover:text-white"
              )}
            >
              {action.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
