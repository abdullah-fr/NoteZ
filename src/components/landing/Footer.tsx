import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Instagram } from 'lucide-react';

const links = {
  Product: [
    { label: 'Features', href: '/#features', hash: true },
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About', href: '/about', newTab: true },
    { label: 'Blog', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy', newTab: true },
    { label: 'Terms', href: '/terms', newTab: true },
    { label: 'Security', href: '/security', newTab: true },
  ],
};

const socialLinks = [
  { label: 'Twitter', Icon: Twitter, href: '#' },
  { label: 'GitHub', Icon: Github, href: '#' },
  { label: 'LinkedIn', Icon: Linkedin, href: '#' },
  { label: 'Instagram', Icon: Instagram, href: 'https://www.instagram.com/notez_official_/' },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/20">
      <div className="container mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-12 mb-8">
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/NoteZ%20logo2.png?v=20260831" alt="NoteZ" className="brand-logo h-8 w-8 object-contain shrink-0" />
              <span className="font-display text-xl font-bold tracking-tight">NoteZ</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
              The calm, fast workspace for serious learners. Built by students, for students.
            </p>
            <div className="flex items-center gap-2">
              {socialLinks.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
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
                    {l.newTab ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {l.label}
                      </a>
                    ) : l.hash ? (
                      <a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NoteZ. Crafted for curious minds.
          </p>
        </div>
      </div>
    </footer>
  );
}
