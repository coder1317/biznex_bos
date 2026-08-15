import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Circle, Quote, Square, Triangle, Mail, Phone } from 'lucide-react';

// ── Reveal-on-scroll ─────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ── Data (content from BIZNEX BOS) ───────────────────────────────────────────
const FEATURES = [
  { shape: 'circle', color: '#D02020', title: 'POS Billing System', desc: 'Fraud-proof billing with automatic stock deduction, transaction history, and comprehensive tax management.' },
  { shape: 'square', color: '#1040C0', title: 'Inventory Intelligence', desc: 'Real-time stock tracking, low-stock alerts, SKU management, and complete audit trails to prevent shrinkage.' },
  { shape: 'triangle', color: '#F0C020', title: 'Employee Management', desc: 'Role-based permissions, shift tracking, activity monitoring, and complete accountability systems.' },
  { shape: 'square', color: '#D02020', title: 'Complaints Workflow', desc: 'Staff issue submission, admin/manager resolution system, status tracking with timestamps.' },
  { shape: 'circle', color: '#1040C0', title: 'Analytics Dashboard', desc: 'Real-time sales data, store-by-store comparison, performance metrics, and growth insights.' },
  { shape: 'triangle', color: '#D02020', title: 'Multi-Store Control', desc: 'Admin sees all stores, managers see only their store, combined analytics with store selector.' },
  { shape: 'triangle', color: '#1040C0', title: 'Offline-First Architecture', desc: 'Local Mini PC deployment ensures operations continue even without internet connectivity.' },
  { shape: 'circle', color: '#F0C020', title: 'Hardware Integration', desc: 'Custom Mini PC/PCB deployment, printer/scanner support, and industrial-grade reliability.' },
  { shape: 'square', color: '#1040C0', title: 'Hybrid Cloud System', desc: 'Local store cloud + central cloud sync, data privacy, and automatic backup systems.' },
];

const BENEFITS = [
  { title: 'Modular & Scalable', desc: 'Affordable entry point with expansion-ready infrastructure. Start with one counter, grow to a chain.' },
  { title: 'Insight-Driven Design', desc: 'Transforms transaction data into actionable business intelligence for every store, every rupee, every employee.' },
  { title: 'Simple Yet Powerful', desc: 'Designed for non-technical business owners without sacrificing advanced capabilities.' },
];

const TARGETS = [
  { icon: '🛒', title: 'Retailers', desc: 'Reduce queues. Increase margins. Ring up faster with billing that just works.' },
  { icon: '🍽️', title: 'Food Outlets', desc: 'Built for high-turnover businesses — kitchens and counters that never stop moving.' },
  { icon: '🏭', title: 'Small Scale Manufacturers', desc: 'From warehouse to revenue — streamlined production, dispatch and settlement.' },
];

const FAQS = [
  { q: 'Does it work without internet?', a: 'Yes. The Offline-First Architecture keeps every store running on a local Mini PC deployment — billing, inventory and reporting continue even when the connection drops, and everything syncs automatically when it returns.' },
  { q: 'How many stores can I manage?', a: 'BIZNEX BOS is built for multi-store and franchise chains. The admin dashboard gives you combined analytics across every location, with per-store selectors and store-by-store comparison.' },
  { q: 'Is my data safe?', a: 'Your data lives in a hybrid cloud — a local store cloud plus central cloud sync with automatic backups. Data privacy is built in, and you always have a local copy of everything.' },
  { q: 'What hardware do I need?', a: 'We support custom Mini PC/PCB deployment with printer and scanner support. The system is designed for industrial-grade reliability at an affordable price.' },
  { q: 'Can I switch from my current POS?', a: 'Yes. BIZNEX BOS replaces 6-8 scattered tools — POS apps, spreadsheets, WhatsApp reporting and manual registers — with one unified platform, so you consolidate everything in one dashboard.' },
];

// Geometric brand mark: circle + rotated square + triangle
function Shape({ kind, className = '' }) {
  if (kind === 'circle') return <div className={`rounded-full ${className}`} />;
  if (kind === 'triangle') return <div className={`shape-triangle ${className}`} />;
  return <div className={`${className}`} />;
}

function CornerShape({ kind, color }) {
  return <Shape kind={kind} className={`corner-shape ${color}`} />;
}

export default function App() {
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  const nav = [
    ['Features', '#features'],
    ['Businesses', '#businesses'],
    ['Why us', '#why'],
    ['FAQ', '#faq'],
  ];

  return (
    <div className="min-h-screen bg-canvas overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-canvas border-b-4 border-ink">
        <div className="container-x flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="Biznex" className="h-9 w-auto" />
            <span className="text-lg font-black uppercase tracking-tighter">Biznex<span className="text-red"> BOS</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-7">
            {nav.map(([label, href]) => (
              <a key={href} href={href} className="label-bh text-ink/70 hover:text-ink transition-colors">{label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <a href="#cta" className="btn-yellow !px-4 !py-2 !text-xs">Contact us</a>
          </div>
          <button className="md:hidden text-ink" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" strokeWidth={2}><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t-2 border-ink bg-canvas px-5 py-4 space-y-3">
            {nav.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="block label-bh text-ink/80">{label}</a>
            ))}
            <a href="#cta" onClick={() => setMenuOpen(false)} className="btn-yellow block text-center !py-2">Contact us</a>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section id="top" className="relative pt-28 lg:pt-32 section-divider bg-dots">
        <div className="container-x grid gap-10 lg:grid-cols-2 lg:items-stretch">
          {/* Left — copy */}
          <div className="reveal flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 w-fit border-2 border-ink bg-yellow px-3 py-1.5 shadow-hard-sm">
              <Circle className="w-3 h-3 fill-ink" />
              <span className="label-bh !text-[10px] sm:!text-xs">Multi-store · Franchise chains · India</span>
            </div>
            <h1 className="h-display mt-6">
              Build the future of <span className="text-blue">business</span> operating <span className="bg-yellow px-1 inline-block">systems</span>
            </h1>
            <p className="body-bh mt-6 text-ink/80 max-w-xl">
              BIZNEX BOS is a complete Business Operating System for multi-store and franchise chains in India.
              We replace fragmented tools — POS apps, spreadsheets, WhatsApp reporting, manual registers —
              with one unified platform that gives founders complete control over every store, every rupee, and
              every employee from a single dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#cta" className="btn-red">Get started <ArrowRight className="w-4 h-4" /></a>
              <a href="#features" className="btn-outline">Learn more</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {['Fraud-proof billing', 'Inventory intelligence', 'Employee accountability'].map((t) => (
                <span key={t} className="flex items-center gap-2 label-bh !text-xs text-ink/80">
                  <span className="w-4 h-4 rounded-full bg-blue text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — blue panel with geometric dashboard composition */}
          <div className="reveal relative">
            <div className="bg-blue border-2 sm:border-4 border-ink shadow-hard-lg p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-yellow border-4 border-ink opacity-90" />
              <div className="absolute bottom-10 -left-8 w-20 h-20 bg-red border-4 border-ink rotate-45 opacity-90" />
              <div className="bg-dots-light absolute inset-0 opacity-30 pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="label-bh !text-[10px] text-white/80 uppercase">Biznex BOS · Live</span>
                  <span className="flex items-center gap-1.5 label-bh !text-[10px] text-yellow">
                    <Circle className="w-2.5 h-2.5 fill-yellow" /> All systems online
                  </span>
                </div>

                {/* KPI row */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ['₹2.4L', "Today's sales"],
                    ['47', 'Active stores'],
                    ['98%', 'Uptime'],
                  ].map(([v, l]) => (
                    <div key={l} className="bg-white border-2 border-ink p-3 shadow-hard-sm">
                      <div className="text-xl sm:text-2xl font-black tracking-tighter">{v}</div>
                      <div className="label-bh !text-[9px] text-ink/70 mt-0.5">{l}</div>
                    </div>
                  ))}
                </div>

                {/* Store rows */}
                <div className="mt-5 bg-white border-2 border-ink shadow-hard-sm p-4">
                  <div className="label-bh !text-[10px] text-ink/60 mb-3">Store performance</div>
                  <div className="space-y-2.5">
                    {[
                      ['Store Alpha', '₹45,230', 'red'],
                      ['Store Beta', '₹38,950', 'blue'],
                      ['Store Gamma', '₹12,340', 'yellow'],
                    ].map(([name, val, c]) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <Shape kind={c === 'red' ? 'circle' : c === 'blue' ? 'square' : 'triangle'} className={`w-2.5 h-2.5 ${c === 'red' ? 'bg-red' : c === 'blue' ? 'bg-blue' : 'bg-yellow'}`} />
                        <span className="text-xs font-bold flex-1">{name}</span>
                        <span className="text-xs font-black font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between bg-ink text-white border-2 border-ink p-3">
                  <span className="label-bh !text-[10px]">47 stores connected</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip (yellow) ── */}
      <section className="section-divider bg-yellow">
        <div className="container-x py-6 sm:py-8">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              ['100%', 'Offline capable'],
              ['1 day', 'Store onboarding'],
              ['6-8', 'Tools replaced'],
              ['₹0', 'Lock-in hardware'],
            ].map(([v, l], i) => (
              <div key={l} className={`reveal py-4 px-2 text-center ${i % 3 === 1 ? 'md:rotate-1' : i % 3 === 2 ? 'md:-rotate-1' : ''}`}>
                <div className="text-3xl sm:text-4xl font-black tracking-tighter">{v}</div>
                <div className="label-bh !text-[10px] sm:!text-xs text-ink/70 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission & Vision ── */}
      <section className="section section-divider">
        <div className="container-x">
          <div className="text-center reveal">
            <span className="label-bh text-ink/60">Mission &amp; Vision</span>
            <h2 className="h-section mt-3">Built for every Indian business</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { color: 'bg-red', shape: 'circle', title: 'The Problem', desc: "Millions of small businesses in India struggle with fragmented tools, no real-time visibility, and expensive POS systems that don't work offline." },
              { color: 'bg-blue', shape: 'square', title: 'Our Solution', desc: 'BIZNEX BOS — a complete Business Operating System that gives founders complete control with affordable pricing and offline-first reliability.' },
              { color: 'bg-yellow', shape: 'triangle', title: 'The Vision', desc: 'Become the operating system for every franchise chain in India, starting with 100 stores in our first year.' },
            ].map((c) => (
              <div key={c.title} className="card-bh reveal p-6 sm:p-7">
                <CornerShape kind={c.shape} color={c.color} />
                <div className="w-10 h-10 flex items-center justify-center border-2 border-ink shadow-hard-sm">
                  <Shape kind={c.shape} className={`w-3.5 h-3.5 ${c.color}`} />
                </div>
                <h3 className="h-sub mt-5">{c.title}</h3>
                <p className="body-bh !text-[15px] mt-3 text-ink/75">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (complete BOS feature set) ── */}
      <section id="features" className="section section-divider bg-blue text-white">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6 reveal">
            <div>
              <span className="label-bh text-yellow">Complete BOS feature set</span>
              <h2 className="h-section mt-3">Reasons you will love us</h2>
            </div>
            <p className="body-bh !text-base text-white/80 max-w-md">
              BIZNEX BOS replaces 6–8 scattered tools with one unified platform. Here's everything we're building.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="bg-white text-ink border-2 sm:border-4 border-ink shadow-hard sm:shadow-hard-lg hover:-translate-y-1.5 transition-transform duration-200 reveal p-5 sm:p-6 relative">
                <CornerShape kind={f.shape} color={f.color} />
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center border-2 border-ink shadow-hard-sm">
                    <Shape kind={f.shape} className={`w-3 h-3 ${f.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-tight text-base sm:text-lg">{f.title}</h3>
                    <p className="text-sm sm:text-[15px] font-medium text-ink/70 leading-relaxed mt-2">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Target businesses ── */}
      <section id="businesses" className="section section-divider">
        <div className="container-x">
          <div className="text-center reveal">
            <span className="label-bh text-ink/60">The businesses we empower</span>
            <h2 className="h-section mt-3">Digitizing the backbone of India's economy</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TARGETS.map((t, i) => (
              <div key={t.title} className="card-bh reveal p-6 sm:p-7">
                <CornerShape kind={['circle', 'square', 'triangle'][i]} color={['bg-red', 'bg-blue', 'bg-yellow'][i]} />
                <div className="text-4xl">{t.icon}</div>
                <h3 className="h-sub mt-4">{t.title}</h3>
                <p className="body-bh !text-[15px] mt-3 text-ink/75">{t.desc}</p>
                <a href="#cta" className="inline-flex items-center gap-2 mt-5 label-bh !text-xs text-blue hover:text-ink transition-colors">
                  Contact us <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Biznex (benefits, red block) ── */}
      <section id="why" className="section section-divider bg-red text-white">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6 reveal">
            <div>
              <span className="label-bh text-yellow">Why Biznex?</span>
              <h2 className="h-section mt-3">Not just another billing machine</h2>
            </div>
            <p className="body-bh !text-base text-white/85 max-w-lg">
              Biznex is not just another billing machine — it is a unified ecosystem designed to simplify operations,
              unlock insights, and scale with growing businesses.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <div key={b.title} className="bg-white text-ink border-2 sm:border-4 border-ink shadow-hard sm:shadow-hard-lg hover:-translate-y-1.5 transition-transform duration-200 reveal p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 flex items-center justify-center rounded-full bg-yellow border-2 border-ink shadow-hard-sm">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                  <span className="font-black text-4xl tracking-tighter text-ink/10">0{i + 1}</span>
                </div>
                <h3 className="h-sub mt-5">{b.title}</h3>
                <p className="body-bh !text-[15px] mt-3 text-ink/75">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="section section-divider">
        <div className="container-x max-w-4xl">
          <div className="card-bh reveal p-7 sm:p-10 relative">
            <Quote className="w-10 h-10 text-blue" strokeWidth={2.5} />
            <p className="text-xl sm:text-2xl font-bold uppercase tracking-tight leading-snug mt-4">
              "We're on a mission to empower every business in India with technology that doesn't just work —
              it actively engages with you."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-blue border-2 border-ink flex items-center justify-center text-white font-black">V</div>
              <div>
                <div className="font-bold uppercase tracking-wide text-sm">Viktra · Founder</div>
                <div className="label-bh !text-[10px] text-ink/60">BIZNEX BOS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="section section-divider bg-dots">
        <div className="container-x max-w-3xl">
          <div className="text-center reveal">
            <span className="label-bh text-ink/60">FAQ</span>
            <h2 className="h-section mt-3">Frequently asked questions</h2>
          </div>
          <div className="mt-10 space-y-4">
            {FAQS.map((f, i) => {
              const open = faqOpen === i;
              return (
                <div key={f.q} className={`acc-item reveal ${open ? 'open' : ''}`}>
                  <button
                    className="flex w-full items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left"
                    onClick={() => setFaqOpen(open ? -1 : i)}
                  >
                    <span className="font-bold uppercase tracking-tight text-sm sm:text-base">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-white' : ''}`} strokeWidth={3} />
                  </button>
                  {open && (
                    <div className="acc-content px-5 sm:px-6 py-5 animate-fadeUp">
                      <p className="body-bh !text-[15px]">{f.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* ── CTA / Get in touch (yellow) ── */}
      <section id="cta" className="section section-divider bg-yellow relative overflow-hidden">
        <div className="absolute top-8 left-8 w-16 h-16 rounded-full bg-red border-4 border-ink opacity-25" />
        <div className="absolute bottom-8 right-10 w-20 h-20 bg-blue border-4 border-ink rotate-45 opacity-25" />
        <div className="container-x relative text-center max-w-3xl">
          <span className="label-bh reveal">Get in touch</span>
          <h2 className="h-section mt-3 reveal">Have questions? We'd love to hear from you.</h2>
          <p className="body-bh mt-5 text-ink/75 reveal">
            We're excited to help you bring every store under one dashboard.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 reveal">
            <a href="mailto:helloviktra@gmail.com" className="bg-white border-2 sm:border-4 border-ink shadow-hard sm:shadow-hard-lg hover:-translate-y-1 transition-transform duration-200 p-6 text-left">
              <Mail className="w-7 h-7 text-red" />
              <div className="label-bh !text-[10px] text-ink/60 mt-3">Email us</div>
              <div className="font-black uppercase tracking-tight text-base sm:text-lg mt-1 break-all">helloviktra@gmail.com</div>
            </a>
            <div className="bg-white border-2 sm:border-4 border-ink shadow-hard sm:shadow-hard-lg hover:-translate-y-1 transition-transform duration-200 p-6 text-left">
              <Phone className="w-7 h-7 text-blue" />
              <div className="label-bh !text-[10px] text-ink/60 mt-3">Call us</div>
              <div className="font-black uppercase tracking-tight text-base sm:text-lg mt-1">+91 8125652700</div>
              <div className="font-black uppercase tracking-tight text-base sm:text-lg">+91 8885397778</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink text-white">
        <div className="container-x py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white border-2 border-ink shadow-hard-sm flex items-center justify-center">
                  <img src="/logo-mark.png" alt="Biznex" className="h-7 w-auto" />
                </div>
                <span className="font-black uppercase tracking-tighter">Biznex<span className="text-yellow"> BOS</span></span>
              </div>
              <p className="text-sm font-medium text-white/60 leading-relaxed mt-4">
                The Business Operating System for multi-store and franchise chains in India. Built offline-first, powered by one dashboard.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {[
                ['Product', [['Features', '#features'], ['Businesses', '#businesses'], ['Why us', '#why']]],
                ['Company', [['Mission', '#top'], ['Businesses', '#businesses'], ['FAQ', '#faq']]],
                ['Contact', [['Email', '#cta'], ['Call', '#cta'], ['Get started', '#cta']]],
              ].map(([head, links]) => (
                <div key={head}>
                  <div className="label-bh !text-[10px] text-yellow">{head}</div>
                  <ul className="mt-3 space-y-2">
                    {links.map(([label, href]) => (
                      <li key={label}><a href={href} className="text-sm font-medium text-white/60 hover:text-white transition-colors">{label}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t-2 border-white/20 pt-6">
            <div className="text-xs font-medium text-white/50">© 2026 Biznex BOS. Made in India 🇮🇳</div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/50">
              <Circle className="w-2.5 h-2.5 fill-red" />
              <Square className="w-2.5 h-2.5 fill-blue" />
              <Triangle className="w-2.5 h-2.5 fill-yellow" />
              <span>Constructivist · Functional · Geometric</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
