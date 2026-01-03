import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-md group-hover:shadow-glow transition-shadow duration-300">
            <span className="text-xl">🐱</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold text-gradient">
              Locums One
            </span>
            <span className="text-xs text-muted-foreground -mt-0.5">
              Campaign Builder
            </span>
          </div>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            to="/" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link 
            to="/campaigns" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Campaigns
          </Link>
          <Link 
            to="/candidates" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Candidates
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
