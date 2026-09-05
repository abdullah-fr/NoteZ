import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { PLANS } from '@/lib/credits';

const FAQS = [
  {
    q: 'What is included in each plan?',
    a: 'Every plan includes notes, folders, AI chat, flashcards, practice exams, activities, the calendar, and Focus Timer. Paid plans give you more monthly AI-powered study actions so you can use those workflows more often.',
  },
  {
    q: 'When can I change my plan?',
    a: 'You can upgrade, downgrade, or cancel your subscription at any time from Account Settings. Your workspace and notes remain available while your plan changes take effect.',
  },
  {
    q: 'What happens if an AI request fails?',
    a: 'Failed AI requests are handled safely so you can retry without being charged for an unsuccessful generation.',
  },
  {
    q: 'Can I use all major NoteZ features on the Free tier?',
    a: 'Yes. Free users can work with notes, folders, exams, AI chat, flashcards, focus sessions, and syllabus breakdown within the Free plan allowance.',
  },
  {
    q: 'Do plans renew automatically?',
    a: 'Paid subscriptions renew according to the billing interval you choose. You can manage or cancel renewal from Account Settings at any time.',
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const tierList = [PLANS.free, PLANS.pro_student, PLANS.pro_scholar];

  return (
    <div className="min-h-screen bg-background animated-bg overflow-x-hidden text-foreground">
      <Navbar />

      {/* Billing Interval Toggle Section */}
      <section className="pt-24 pb-6 md:pt-28 md:pb-8">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          {/* Billing Interval Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border/80 bg-card/60 backdrop-blur-sm shadow-xs">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                !yearly ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all flex items-center gap-2 cursor-pointer ${
                yearly ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly billing
              <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-mono font-bold tracking-wide shadow-sm ${
                yearly
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
                  : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              }`}>
                Save 25%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="pb-16 md:pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {tierList.map((tier, i) => {
              const price = yearly ? tier.yearlyPrice : tier.monthlyPrice;
              const isPopular = tier.highlighted;
              const isFree = tier.id === 'free';

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className={`relative rounded-2xl p-6 sm:p-7 border flex flex-col justify-between transition-all ${
                    isPopular
                      ? 'border-primary bg-card/90 shadow-xl ring-1 ring-primary/40'
                      : 'border-border/80 bg-card/50 hover:border-border'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.8 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tracking-wider uppercase shadow-sm">
                      {tier.badge || 'Most Popular'}
                    </span>
                  )}

                  <div>
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="font-serif text-xl font-bold tracking-tight text-foreground mb-1">
                        {tier.name}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed min-h-[2.5em]">
                        {tier.tagline}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-5 pb-5 border-b border-border/50">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-serif text-5xl sm:text-6xl leading-none font-bold tracking-tight text-foreground">
                          ${price}
                        </span>
                        {yearly && !isFree && (
                          <span className="text-base font-mono text-muted-foreground/70 line-through sm:text-lg" aria-label={`Regular monthly price $${tier.monthlyPrice}`}>
                            ${tier.monthlyPrice}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground font-mono">
                          {price === 0 ? 'forever' : '/month'}
                        </span>
                      </div>

                    </div>

                    {/* CTA Button */}
                    <Button
                      asChild
                      variant={isPopular ? 'default' : 'outline'}
                      className={`w-full mb-6 font-bold text-xs h-10 ${
                        isPopular ? 'bg-primary text-primary-foreground shadow-md' : 'border-border'
                      }`}
                    >
                      <Link to="/signup">
                        {tier.id === 'free' ? 'Get Started Free' : `Upgrade to ${tier.name}`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>

                    {/* Features list */}
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                        What's included:
                      </p>
                      <ul className="space-y-2">
                        {tier.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-xs">
                            <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                            <span className="text-foreground/90 leading-snug">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Everything you need to know about NoteZ plans and subscriptions.
            </p>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === faq.q;
              const faqId = `faq-${index}`;

              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 space-y-1.5 shadow-2xs"
                >
                  <button
                    type="button"
                    id={`${faqId}-trigger`}
                    aria-expanded={isOpen}
                    aria-controls={`${faqId}-panel`}
                    onClick={() => setOpenFaq(isOpen ? null : faq.q)}
                    className="w-full text-left text-sm font-bold text-foreground flex items-center gap-2"
                  >
                    <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p id={`${faqId}-panel`} role="region" aria-labelledby={`${faqId}-trigger`} className="text-xs text-muted-foreground leading-relaxed pl-6">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
