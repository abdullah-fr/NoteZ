import { Navbar } from '@/components/landing/Navbar';
import { ChalkboardIntro } from '@/components/landing/ChalkboardIntro';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';

const Index = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Navbar pinned to top */}
      <Navbar />

      <main>
        {/* 1. Chalkboard Handwritten Animation Intro */}
        <ChalkboardIntro />

        {/* 2. Main Hero Section */}
        <Hero />

        {/* 3. Sticky Features Showcase ("One app. One solution.") */}
        <Features />

        {/* 4. Creative How It Works Onboarding */}
        <div id="how-it-works">
          <HowItWorks />
        </div>
      </main>
    </div>
  );
};

export default Index;
