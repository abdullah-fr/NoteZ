import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Sparkles, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === 'midnight' ? 'warm-paper' : 'midnight');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/60 transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">NoteZ</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-1">
            <a href="/#features" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg">Features</a>
            <Link to="/pricing" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg">Pricing</Link>
            <div className="w-px h-5 bg-border/60 mx-2" />
            <button
              type="button"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'midnight' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/signup"><Button size="sm" className="ml-1">Get started</Button></Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-t border-border/60"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
              <a href="/#features" className="py-3 px-2 text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>Features</a>
              <Link to="/pricing" className="py-3 px-2 text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(false)}>Pricing</Link>
              <div className="h-px bg-border/60 my-2" />
              <button
                type="button"
                onClick={toggleTheme}
                className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {theme === 'midnight' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/login" onClick={() => setIsOpen(false)}><Button variant="ghost" className="w-full justify-start">Log in</Button></Link>
              <Link to="/signup" onClick={() => setIsOpen(false)}><Button className="w-full">Get started</Button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
