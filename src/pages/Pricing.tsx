import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { useState } from 'react';

type Tier = {
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  cta: string;
  href: string;
  highlighted?: boolean;
  features: string[];
};

const tiers: Tier[] = [
  {
    name: 'Free',
    tagline: 'Everything you need to get started.',
    monthly: 0,
    yearly: 0,
    cta: 'Start free',
    href: '/signup',
    features: [
      'Unlimited notes & flashcards',
      'Daily quiz & focus timer',
      '1 active subject',
      'Streaks, XP & basic progress',
    ],
  },
  {
    name: 'Pro Student',
    tagline: 'For students who want to win the semester.',
    monthly: 8,
    yearly: 6,
    cta: 'Start 7-day trial',
    href: '/signup',
    highlighted: true,
    features: [
      'Unlimited subjects & specializations',
      'AI-generated exams & explanations',
      'Spaced repetition flashcards',
      'Smart study planner',
      'Full progress analytics',
      'Priority AI responses',
    ],
  },
  {
    name: 'Pro Scholar',
    tagline: 'For researchers and grad students.',
    monthly: 18,
    yearly: 14,
    cta: 'Upgrade to Scholar',
    href: '/signup',
    features: [
      'Everything in Pro Student',
      'Document upload & summarization',
      'Multi-source research mode',
      'Citation export (BibTeX, APA)',
      'Long-context AI conversations',
    ],
  },
  {
    name: 'Team',
    tagline: 'For study groups and small teams.',
    monthly: 12,
    yearly: 10,
    cta: 'Talk to us',
    href: '/signup',
    features: [
      'Everything in Pro Scholar, per seat',
      'Shared notebooks & flashcard decks',
      'Group chat & live sessions',
      'Admin controls & roles',
      'Centralized billing',
    ],
  },
];

const faqs = [
  { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade, downgrade or cancel from your account in two clicks. We prorate every change.' },
  { q: 'Is there a student discount?', a: 'The Free tier covers most students. Pro Student is already priced for student budgets — no extra paperwork.' },
  { q: 'What payment methods do you accept?', a: 'All major credit cards, Apple Pay, Google Pay, and SEPA in supported regions.' },
  { q: 'Do you offer refunds?', a: 'If you’re unhappy in the first 14 days of a paid plan, email us — full refund, no questions.' },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="min-h-screen bg-background animated-bg">
      <Navbar />

      <section className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-muted-foreground mb-5"
          >
            <Sparkles className="h-3 w-3 text-primary" /> Simple, honest pricing
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5"
          >
            Pricing that <span className="gradient-text">scales with you.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8"
          >
            Start free. Upgrade when NoteZ starts saving you real hours. Cancel anytime.
          </motion.p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-1.5 text-sm rounded-full transition-all ${
                !yearly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-1.5 text-sm rounded-full transition-all flex items-center gap-2 ${
                yearly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                yearly ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary'
              }`}>−25%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing grid */}
      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto">
            {tiers.map((tier, i) => {
              const price = yearly ? tier.yearly : tier.monthly;
              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`relative rounded-2xl p-6 md:p-7 border backdrop-blur-sm transition-all ${
                    tier.highlighted
                      ? 'border-primary/40 bg-card/60 shadow-glow-lg'
                      : 'border-border/60 bg-card/30 hover:border-border'
                  }`}
                >
                  {tier.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      Most popular
                    </span>
                  )}
                  <div className="mb-5">
                    <h3 className="font-display text-lg font-semibold tracking-tight mb-1">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed min-h-[2.5em]">{tier.tagline}</p>
                  </div>
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold tracking-tight">${price}</span>
                    <span className="text-sm text-muted-foreground">{price === 0 ? 'forever' : '/mo'}</span>
                  </div>
                  <Button
                    asChild
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className={`w-full mb-6 ${tier.highlighted ? 'glow-purple' : 'border-border/60'}`}
                  >
                    <Link to={tier.href}>
                      {tier.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <ul className="space-y-2.5">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tier.highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-foreground/90 leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 md:pb-32">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            Questions, answered.
          </h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <motion.div
                key={f.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl border border-border/60 bg-card/30 p-5 md:p-6"
              >
                <h4 className="font-display font-semibold mb-1.5 tracking-tight">{f.q}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}