import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { api } from '../lib/api.js';
import IdeaCard from '../components/IdeaCard.jsx';
import { Page, Loading, EmptyState } from '../components/Bits.jsx';

export default function Landing() {
  const [ideas, setIdeas] = useState(null);

  const load = () =>
    api
      .ideas({ status: 'open', limit: 48 })
      .then((d) => {
        // Sort by funds + number of users (NOT by date or time left).
        const sorted = [...d.ideas].sort(
          (a, b) => b.total + b.backers * 50 - (a.total + a.backers * 50)
        );
        setIdeas(sorted);
      })
      .catch(() => setIdeas([]));

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // keep it live
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      {/* Hero — just the sentence */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 hero-grid h-[420px]" />
        <Page className="relative pb-8 pt-16 text-center sm:pt-24">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-4xl font-display text-5xl font-extrabold leading-[1.05] text-white sm:text-7xl"
          >
            One idea is all it
            <br />
            <span className="gradient-text">takes to win.</span>
          </motion.h1>
        </Page>
      </section>

      {/* Live ideas */}
      <Page className="pb-20">
        <h2 className="mb-5 flex items-center gap-2 text-2xl font-extrabold">
          <Flame className="h-6 w-6 text-ember-400" /> Live ideas
        </h2>
        {ideas === null ? (
          <Loading label="Loading live ideas…" />
        ) : ideas.length === 0 ? (
          <EmptyState icon={Flame} title="No live ideas yet">
            Check back soon — or create the first one.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </Page>
    </div>
  );
}
