import { Navbar } from '@/components/landing/Navbar';
import { ChalkboardIntro } from '@/components/landing/ChalkboardIntro';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { CTA } from '@/components/landing/CTA';
import { Testimonials } from '@/components/landing/Testimonials';
import { Footer } from '@/components/landing/Footer';

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

        {/* 3. Interactive core-section showcase */}
        <Features />

        {/* 4. Two independently pausing testimonial rails */}
        <Testimonials />

        {/* 5. NoteZ onboarding call to action */}
        <CTA />

        {/* 6. Landing page footer */}
        <Footer />
      </main>
    </div>
  );
};

export default Index;
