import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin } from 'lucide-react';

const links = {
  Product: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Security', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/20">
      <div className="container mx-auto px-4 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12 mb-12">
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/NoteZ%20logo2.png" alt="NoteZ" className="h-8 w-8 rounded-lg object-cover shrink-0" />
              <span className="font-display text-xl font-bold tracking-tight">NoteZ</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
              The calm, fast workspace for serious learners. Built by students, for students.
            </p>
            <div className="flex items-center gap-2">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-display text-sm font-semibold mb-4 tracking-tight">{group}</h4>
              <ul className="space-y-2.5">
                {items.map(l => (
                  <li key={l.label}>
                    <Link to={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NoteZ. Crafted for curious minds.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with ☕ and active recall.
          </p>
        </div>
      </div>
    </footer>
  );
}
