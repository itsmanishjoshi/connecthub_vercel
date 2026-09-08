export const REPOSITORY_INDUSTRY_IDS = ['healthcare', 'engineering', 'bfsi'] as const;
export type RepositoryIndustryId = (typeof REPOSITORY_INDUSTRY_IDS)[number];

export type RepositoryFileKind = 'pdf' | 'pptx' | 'ppt' | 'slide' | 'other';

export interface RepositoryCaseStudy {
  title: string;
  client: string;
  challenge: string;
  whatWeDid: string;
  outcome: string;
}

export interface RepositoryIndustry {
  id: RepositoryIndustryId;
  name: string;
  shortName: string;
  eyebrow: string;
  headline: string;
  pitch: string;
  accent: string;
  stats: Array<{ value: string; label: string }>;
  expertise: Array<{ title: string; detail: string }>;
  services: string[];
  caseStudies: RepositoryCaseStudy[];
  talkingPoints: string[];
}

export const REPOSITORY_INDUSTRIES: Record<RepositoryIndustryId, RepositoryIndustry> = {
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    shortName: 'Health',
    eyebrow: 'Providers, payers, life sciences',
    headline: 'Clinical operations, with the noise removed',
    pitch:
      'We help hospitals, diagnostic networks, and health-tech teams ship systems clinicians will actually use: patient flow, interoperability, revenue cycle, and AI that stays inside clinical governance.',
    accent: 'teal',
    stats: [
      { value: 'HL7 / FHIR', label: 'Interoperability we implement' },
      { value: '24×7', label: 'Care operations we design for' },
      { value: 'Audit-ready', label: 'Privacy and access built in' },
    ],
    expertise: [
      {
        title: 'Care delivery platforms',
        detail: 'OPD, IPD, lab, pharmacy, and discharge journeys on one operational backbone.',
      },
      {
        title: 'Clinical data & interoperability',
        detail: 'FHIR APIs, HL7 feeds, imaging, and device data that other systems can trust.',
      },
      {
        title: 'Revenue and payor operations',
        detail: 'Claims, coding assistance, denial patterns, and settlement visibility.',
      },
      {
        title: 'Responsible clinical AI',
        detail: 'Triage, documentation, and imaging assist with human review, not black-box decisions.',
      },
    ],
    services: [
      'EHR / HIS modernization and integration',
      'Patient engagement and care-coordination apps',
      'Lab, radiology, and diagnostics workflow',
      'Population health and analytics dashboards',
      'Cloud, security, and DPDP / HIPAA-aligned controls',
      'Managed product engineering for health-tech scale-ups',
    ],
    caseStudies: [
      {
        title: 'One patient record across a multi-city hospital group',
        client: 'Multi-specialty hospital network',
        challenge: 'Each site ran a different stack. Transfer patients arrived without meds, labs, or imaging history.',
        whatWeDid:
          'A shared FHIR layer, identity matching, and a clinician workspace that pulls the last 90 days of encounters in under two seconds.',
        outcome: 'Handoffs stopped depending on printed files. Duplicate lab orders dropped. Night-shift doctors finally had a single chart.',
      },
      {
        title: 'Faster claims without fighting the coding team',
        client: 'Regional diagnostic chain',
        challenge: 'Coders were drowning in unstructured reports. Denials were late and unexplained.',
        whatWeDid:
          'Assisted coding from report text, a denial workbench, and payor-wise playbooks the ops team owns.',
        outcome: 'Turnaround on first-pass claims improved. Coders spent time on exceptions, not copy-paste.',
      },
      {
        title: 'Imaging assist that radiologists would keep on',
        client: 'High-volume radiology practice',
        challenge: 'A previous AI pilot was ignored because it slowed the viewer and could not explain itself.',
        whatWeDid:
          'In-viewer overlays, confidence scores, and an audit trail. The model never auto-signed a report.',
        outcome: 'Adoption held after the pilot. Peer review became searchable instead of anecdotal.',
      },
    ],
    talkingPoints: [
      'Ask what system is the source of truth for the patient — HIS, EMR, or a side spreadsheet.',
      'Ask how a transfer, night shift, or second opinion actually gets the chart today.',
      'Offer a 30-minute walkthrough of one case study that matches their setting (hospital, payer, or diagnostics).',
    ],
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    shortName: 'Engineering',
    eyebrow: 'Manufacturing, automotive, industrial, energy',
    headline: 'Plants, products, and platforms that stay in sync',
    pitch:
      'We connect design, shop floor, and aftermarket so engineering leaders can see what is being built, what is failing in the field, and which change should ship next.',
    accent: 'amber',
    stats: [
      { value: 'PLM → ERP', label: 'The handoff we close' },
      { value: 'OT + IT', label: 'Shop-floor data we join' },
      { value: 'Digital thread', label: 'From CAD to service' },
    ],
    expertise: [
      {
        title: 'Product lifecycle & change',
        detail: 'BOM, ECO, and variant logic that manufacturing and suppliers can actually follow.',
      },
      {
        title: 'Smart operations',
        detail: 'MES, quality, and IoT signals tied to the work order — not a separate dashboard nobody opens.',
      },
      {
        title: 'Aftermarket and service',
        detail: 'Installed-base history, spare parts, and field issues feeding back into engineering.',
      },
      {
        title: 'Industrial AI',
        detail: 'Vision QC, predictive maintenance, and planning assist with plant-floor constraints.',
      },
    ],
    services: [
      'PLM / CAD / ERP integration programmes',
      'MES and quality system modernization',
      'Connected product and IoT platforms',
      'Supplier portals and manufacturing visibility',
      'Digital twin and simulation data pipelines',
      'SAP and cloud engineering for industrial estates',
    ],
    caseStudies: [
      {
        title: 'A single BOM the plant and the OEM could both trust',
        client: 'Tier-1 automotive supplier',
        challenge: 'Engineering released in PLM. The plant built from a spreadsheet. Warranty claims blamed the wrong revision.',
        whatWeDid:
          'Revision-aware BOMs, plant-specific views, and a change packet that purchasing and quality signed in the same flow.',
        outcome: 'Wrong-revision builds stopped being a monthly incident. Warranty analysis finally pointed at a real part number.',
      },
      {
        title: 'Quality holds that explain themselves',
        client: 'Discrete manufacturer',
        challenge: 'Holds were tribal knowledge. A line could sit idle while someone hunted the last similar defect.',
        whatWeDid:
          'A quality workbench on the work order, photo evidence, and search across historical NCRs.',
        outcome: 'Supervisors cleared or escalated holds with context. Repeat defects became a list, not a rumour.',
      },
      {
        title: 'Service history that engineering can read',
        client: 'Industrial equipment OEM',
        challenge: 'Field tickets lived in a CRM. Design never saw which subsystem failed after 18 months.',
        whatWeDid:
          'Serialised installed base, ticket-to-BOM mapping, and a weekly failure digest for product managers.',
        outcome: 'The next hardware spin targeted the actual failing assembly. Service stopped being a black hole.',
      },
    ],
    talkingPoints: [
      'Ask where the manufacturing BOM lives the morning a line starts — PLM, ERP, or Excel.',
      'Ask who owns a quality hold after 6 p.m. on the shop floor.',
      'Walk the digital-thread case study if they care about warranty or variants.',
    ],
  },
  bfsi: {
    id: 'bfsi',
    name: 'BFSI',
    shortName: 'BFSI',
    eyebrow: 'Banking, markets, insurance, payments',
    headline: 'Core change, without the operational scare',
    pitch:
      'We modernise channels, credit, payments, and risk around cores that cannot go down. The work is integration, control, and products your operations team can run on Monday morning.',
    accent: 'indigo',
    stats: [
      { value: 'Core-safe', label: 'Change we design around' },
      { value: 'Audit trail', label: 'On every sensitive action' },
      { value: 'Real-time', label: 'Payments and risk views' },
    ],
    expertise: [
      {
        title: 'Channels and onboarding',
        detail: 'Retail, SME, and wealth journeys that still honour KYC, maker-checker, and branch exceptions.',
      },
      {
        title: 'Payments and settlement',
        detail: 'Rails, reconciliation, and exception queues that ops can clear without a war room.',
      },
      {
        title: 'Credit, policy, and risk',
        detail: 'Origination, limit, fraud, and reporting that risk, not just IT, will sign off.',
      },
      {
        title: 'Core and data modernisation',
        detail: 'APIs, event streams, and warehouses around the core — not a reckless rip-and-replace.',
      },
    ],
    services: [
      'Digital banking and customer-facing platforms',
      'Payments, UPI-class rails, and reconciliation',
      'Lending origination and collections workbenches',
      'Insurance policy admin and claims assist',
      'Risk, AML, and regulatory reporting pipelines',
      'Core integration, APIs, and cloud landing zones',
    ],
    caseStudies: [
      {
        title: 'Onboarding that branch and digital could share',
        client: 'Universal bank',
        challenge: 'The app collected KYC. The branch re-keyed it. Operations had two queues and no owner.',
        whatWeDid:
          'One case file, maker-checker, and a branch desk that saw the same documents as the app.',
        outcome: 'Duplicate KYC work collapsed. Exceptions had a named queue instead of email threads.',
      },
      {
        title: 'Payments exceptions that ops could finish',
        client: 'Payments business of a large bank',
        challenge: 'Unmatched transactions sat in files. Only two people knew the folklore to clear them.',
        whatWeDid:
          'A reconciliation workbench, suggested matches, and an audit log risk could replay.',
        outcome: 'Clearing time dropped. The “two people” bottleneck stopped being a single point of failure.',
      },
      {
        title: 'Credit memos risk would actually open',
        client: 'NBFC lending book',
        challenge: 'Models scored. Credit still wrote memos in Word from six screenshots.',
        whatWeDid:
          'A memo assembled from bureau, bank statement, and policy rules, with every override timestamped.',
        outcome: 'Credit time went into judgement, not assembly. Audit could see why a limit was stretched.',
      },
    ],
    talkingPoints: [
      'Ask which queue still depends on two named people in operations.',
      'Ask whether branch and digital share one case file or two.',
      'Offer the payments or onboarding study first — they travel well in a first meeting.',
    ],
  },
};

export function isRepositoryIndustryId(value: string): value is RepositoryIndustryId {
  return (REPOSITORY_INDUSTRY_IDS as readonly string[]).includes(value);
}

export function fileKindFromName(name: string): RepositoryFileKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'pptx' || ext === 'pptm') return 'pptx';
  if (ext === 'ppt') return 'ppt';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'slide';
  return 'other';
}
