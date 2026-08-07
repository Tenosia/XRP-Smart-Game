import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Lightbulb, TrendingUp } from 'lucide-react';
import { api } from '../lib/api.js';
import IdeaCard from '../components/IdeaCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Page, Loading, EmptyState, Stat } from '../components/Bits.jsx';
import { fmtXLM } from '../lib/format.js';

export default function Portfolio() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.myIdeas().then(setData).catch(() => setData({ created: [], positions: [] }));
  }, []);

  if (!data) return <Loading label="Loading your portfolio…" />;

  const { created, positions } = data;
  const totalStaked = positions.reduce((s, p) => s + p.staked, 0);
  const settled = positions.filter((p) => ['resolved', 'refunded'].includes(p.idea?.status));
  const totalReturned = settled.reduce((s, p) => s + p.payout, 0);
  const live = positions.filter((p) => p.idea?.status === 'open' || p.idea?.status === 'closed');

  return (
    <Page>
      <h1 className="mb-6 text-3xl font-bold">Portfolio</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total selected" value={`${fmtXLM(totalStaked)} XLM`} />
        <Stat label="Open positions" value={live.length} accent="text-cyanx" />
        <Stat label="Settled returns" value={`${fmtXLM(totalReturned)} XLM`} accent="text-yes" />
      </div>

      {/* Positions */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <TrendingUp className="h-5 w-5 text-brand-400" /> My positions
        </h2>
        {positions.length === 0 ? (
          <EmptyState icon={Briefcase} title="No positions yet">
            Browse the ideas and select an outcome to see it here.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-white/5 overflow-hidden">
            {positions.map((p, i) => {
              const idea = p.idea;
              const won = idea?.winningOption === p.option;
              const isSettled = ['resolved', 'refunded'].includes(idea?.status);
              return (
                <Link
                  key={i}
                  to={`/ideas/${p.ideaId}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{idea?.title || `Idea #${p.ideaId}`}</p>
                    <p className="mt-0.5 text-sm">
                      <span className={p.option === 'A' ? 'text-cyanx' : 'text-no'}>
                        {p.option === 'A' ? idea?.optionA : idea?.optionB}
                      </span>
                      <span className="text-slate-500"> · {fmtXLM(p.staked)} XLM selected</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {isSettled ? (
                      <span className={`font-mono font-semibold ${p.payout > 0 ? 'text-yes' : 'text-slate-500'}`}>
                        {p.payout > 0 ? `+${fmtXLM(p.payout)}` : '—'}
                        {p.payout > 0 && <span className="text-xs"> XLM</span>}
                      </span>
                    ) : (
                      <StatusBadge status={idea?.status} />
                    )}
                    {isSettled && idea?.status === 'resolved' && (
                      <span className={`chip ${won ? 'bg-yes/15 text-yes' : 'bg-no/15 text-no'}`}>
                        {won ? 'Won' : 'Lost'}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Created markets */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Lightbulb className="h-5 w-5 text-brand-400" /> Ideas I created
          </h2>
          <Link to="/create" className="btn-ghost px-3 py-1.5 text-sm">Create new</Link>
        </div>
        {created.length === 0 ? (
          <EmptyState icon={Lightbulb} title="You haven't created any ideas">
            Float an idea and earn a share of every pool it generates.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {created.map((idea) => (
              <div key={idea.id} className="relative">
                {idea.status === 'pending' || idea.status === 'rejected' ? (
                  <div className="card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="chip bg-white/5 text-slate-300">{idea.category}</span>
                      <StatusBadge status={idea.status} />
                    </div>
                    <h3 className="line-clamp-2 font-semibold text-white">{idea.title}</h3>
                    {idea.status === 'rejected' && idea.rejectReason && (
                      <p className="mt-2 text-sm text-no">Reason: {idea.rejectReason}</p>
                    )}
                    {idea.status === 'pending' && (
                      <p className="mt-2 text-sm text-slate-400">Awaiting admin review.</p>
                    )}
                  </div>
                ) : (
                  <IdeaCard idea={idea} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
