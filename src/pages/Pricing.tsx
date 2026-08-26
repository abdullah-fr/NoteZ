import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Check,
  Sparkles,
  ArrowRight,
  Zap,
  HelpCircle,
  ShieldCheck,
  Layers,
  MessageSquare,
  GraduationCap,
  FileText,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { PLANS, CREDIT_COSTS, ACTION_METADATA, METERED_ACTIONS, type MeteredAction } from '@/lib/credits';

const ACTION_ICONS: Record<MeteredAction, any> = {
  ai_chat: MessageSquare,
  generate_exam: GraduationCap,
  generate_flashcards: Layers,
  editor_ai_assist: FileText,
  activities_breakdown: ListChecks,
};

const FAQS = [
  {
    q: 'What are AI Credits and how do they work?',
    a: 'Credits power the AI features in NoteZ (such as generating practice exams, study chat explanations, and flashcard creation). Every time you run an AI action, a fixed number of credits is deducted from your balance.',
  },
  {
    q: 'When do my credits reset?',
    a: 'Free accounts receive 150 credits every week (refilling every 7 days), so you never have to wait a whole month if you run low. Pro Student receives 5,000 credits every month, and Pro Scholar receives 15,000 credits every month.',
  },
  {
    q: 'What happens if an AI request fails or encounters an error?',
    a: 'NoteZ includes an automatic refund guarantee. If any generation or operation fails, your credits are immediately refunded back to your balance automatically.',
  },
  {
    q: 'Can I use all major NoteZ features on the Free tier?',
    a: 'Yes. Free tier users have access to exams, AI chat, flashcards, focus timer, notes, and syllabus breakdown with 150 credits refilled every single week.',
  },
  {
    q: 'Can I cancel or switch my plan anytime?',
    a: 'Absolutely. You can upgrade, downgrade, or cancel your subscription at any time directly from your Account Settings with zero cancellation fees.',
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);

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
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                yearly ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
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
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-4xl font-bold tracking-tight text-foreground">
                          ${price}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {price === 0 ? 'forever' : yearly ? '/month (billed yearly)' : '/month'}
                        </span>
                      </div>

                      {/* Credits Pill */}
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 border border-border text-xs font-mono font-bold text-foreground">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {tier.creditAllowance.toLocaleString()} AI Credits / {isFree ? 'week' : 'mo'}
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

      {/* Credit Cost Reference Guide Table */}
      <section className="py-12 md:py-16 border-t border-border/40 bg-secondary/20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-mono font-semibold text-muted-foreground mb-3">
              <Zap className="h-3.5 w-3.5 text-primary" /> Transparent Pricing
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              What Does Each Action Cost?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xl mx-auto">
              Every metered AI feature has a fixed credit rate. No hidden multipliers or complicated calculations.
            </p>
          </div>

          {/* Cost Table Card */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/50 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4 font-bold">Feature / Action</th>
                    <th className="py-3 px-4 font-bold">Category</th>
                    <th className="py-3 px-4 font-bold text-center">Credit Cost</th>
                    <th className="py-3 px-4 font-bold">Free Plan Capacity (Weekly)</th>
                    <th className="py-3 px-4 font-bold">Pro Student Capacity (Monthly)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {METERED_ACTIONS.map(actionKey => {
                    const meta = ACTION_METADATA[actionKey];
                    const cost = CREDIT_COSTS[actionKey];
                    const Icon = ACTION_ICONS[actionKey] || Sparkles;
                    const freeCapacity = Math.floor(150 / cost);
                    const proCapacity = Math.floor(5000 / cost);

                    return (
                      <tr key={actionKey} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-secondary border border-border/60 flex items-center justify-center shrink-0">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{meta.shortDesc}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {meta.category}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-mono font-bold text-primary">
                            {cost} credits
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">
                          ~{freeCapacity} / week
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground font-semibold">
                          ~{proCapacity} / month
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Guarantee Banner */}
            <div className="p-4 bg-secondary/40 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Zero-Risk Guarantee:</strong> If an AI call fails or encounters an error, your credits are refunded automatically.
                </span>
              </div>
              <Link
                to="/signup"
                className="text-primary hover:underline font-bold text-xs shrink-0 flex items-center gap-1"
              >
                Try Free Now <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
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
              Everything you need to know about NoteZ plans, credit refills, and subscriptions.
            </p>
          </div>

          <div className="space-y-3.5">
            {FAQS.map(faq => (
              <div
                key={faq.q}
                className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 space-y-1.5 shadow-2xs"
              >
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
