import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-context";
import { useTheme } from "@/components/theme-context";

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function SiteHeader({ active }: { active: "status" | "gatherings" | "notice" | "gallery" | "contacts" }) {
  const { verified, empId, requireLogin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const linkBase = "font-ui-button text-ui-button transition-colors";
  const cls = (k: typeof active) =>
    active === k
      ? `${linkBase} text-primary border-b-2 border-primary pb-1`
      : `${linkBase} text-on-surface-variant hover:text-primary`;
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 bg-background/90 backdrop-blur-sm border-b-2 border-primary">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-display text-[32px] md:text-display-lg font-extrabold text-primary tracking-tighter">
          Executives Club
        </Link>
        <nav className="hidden lg:flex items-center gap-gutter">
          <Link to="/" className={cls("status")}>Hall Status</Link>
          <Link to="/hall" className={cls("gatherings")}>Book Hall</Link>
          <Link to="/#notices" className={cls("notice")}>Notice Board</Link>
          <Link to="/#gallery" className={cls("gallery")}>Gallery</Link>
          <Link to="/#contacts" className={cls("contacts")}>Contacts</Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center bg-secondary/20 px-4 py-1.5 rounded-full border border-secondary">
          <span className="w-2 h-2 bg-secondary rounded-full mr-2 animate-pulse"></span>
          <span className="text-[12px] font-bold text-secondary uppercase tracking-wider">
            Hall free until 6 pm
          </span>
        </div>
        <button className="p-2 hover:bg-surface-container transition-colors text-primary" aria-label="Search">
          <Icon name="search" />
        </button>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-full hover:bg-surface-container transition-colors text-primary"
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
        </button>
        {verified ? (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5">
            <Icon name="account_circle" className="text-primary text-xl" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-on-surface">
              Employee {empId}
            </span>
            <button
              onClick={logout}
              aria-label="Log out"
              className="ml-1 text-on-surface-variant hover:text-error transition-colors"
            >
              <Icon name="logout" className="text-base" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => requireLogin()}
            className="hidden sm:flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-1.5 font-ui-button text-[12px] font-bold uppercase tracking-wider text-on-primary hover:bg-primary-container transition-all duration-[220ms] ease-club hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-8px_rgba(201,162,75,0.5)]"
          >
            <Icon name="account_circle" className="text-base" />
            Login
          </button>
        )}
        <button className="lg:hidden p-2 text-primary" aria-label="Menu">
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-primary text-on-primary py-s-xl px-margin-mobile md:px-margin-desktop w-full overflow-hidden relative">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-s-xl relative z-10">
        <div className="col-span-1 md:col-span-2">
          <div className="font-headline text-headline-lg mb-6">Executives Club Community</div>
          <p className="font-body text-body-md opacity-80 max-w-sm mb-8">
            Fostering a vibrant, safe, and connected living environment through
            modern technology and collective action.
          </p>
          <div className="flex gap-4">
            <a href="#" className="w-10 h-10 border border-on-primary flex items-center justify-center hover:bg-on-primary hover:text-primary transition-colors">
              <Icon name="share" />
            </a>
            <a href="#" className="w-10 h-10 border border-on-primary flex items-center justify-center hover:bg-on-primary hover:text-primary transition-colors">
              <Icon name="mail" />
            </a>
          </div>
        </div>
        <div>
          <h4 className="font-ui-button text-ui-button mb-6 uppercase tracking-widest">Sitemap</h4>
          <ul className="flex flex-col gap-4 font-body text-body-md opacity-80">
            <li><Link to="/hall" className="hover:opacity-100">Facility Booking</Link></li>
            <li><Link to="/" className="hover:opacity-100">Gathering List</Link></li>
            <li><Link to="/#gallery" className="hover:opacity-100">Photo Gallery</Link></li>
            <li><Link to="/#notices" className="hover:opacity-100">Notice Board</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-ui-button text-ui-button mb-6 uppercase tracking-widest">Support</h4>
          <ul className="flex flex-col gap-4 font-body text-body-md opacity-80">
            <li><a href="#" className="hover:opacity-100">Privacy Policy</a></li>
            <li><a href="#" className="hover:opacity-100">Terms of Service</a></li>
            <li><a href="#" className="hover:opacity-100">Committee Portal</a></li>
            <li><a href="/#contacts" className="hover:opacity-100">Emergency Contacts</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-on-primary/20 pt-s-lg relative z-10">
        <p className="font-body text-body-md opacity-60">© 2026 Executives Club Kudigi, NTPC Karnataka. All rights reserved.</p>
      </div>
      <div className="absolute -bottom-12 md:-bottom-24 -right-12 pointer-events-none select-none opacity-20">
        <span className="font-display text-[120px] md:text-[280px] font-extrabold tracking-tighter leading-none">Executives Club</span>
      </div>
    </footer>
  );
}
