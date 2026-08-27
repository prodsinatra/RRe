import { Link } from "react-router-dom";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link 
      to="/" 
      aria-label="808 SZN Engine Home" 
      className={`inline-flex items-center group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hover rounded-sm ${className}`}
    >
      <div className="wordmark-display text-xl font-bold font-display tracking-tight text-foreground select-none" aria-hidden="true">
        <span className="accent-num transition-colors group-hover:text-primary-glow">808</span>
        <span className="szn opacity-90 tracking-tighter ml-0.5">SZN</span>
      </div>
    </Link>
  );
}

