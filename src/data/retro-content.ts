// Content for the /retro static portfolio, populated from answers.txt. A few
// fields remain TODO where answers.txt didn't provide the data (see comments).
// The page templates never hardcode content; they all read from this object.

export interface TimelineEntry {
  /** Degree or program name */
  title: string;
  institution: string;
  location: string;
  /** e.g. "2014 — 2018" */
  period: string;
  details: string[];
}

export interface ExperienceEntry {
  role: string;
  company: string;
  location: string;
  period: string;
  /** 2-3 bullet achievements */
  achievements: string[];
  /** shown as tiffany-green pills */
  skills: string[];
}

export interface Project {
  name: string;
  description: string;
  stack: string[];
  /** optional external link (repo, demo, paper) */
  link?: string;
  /** hover preview image under public/ — template placeholder until you add real shots */
  image?: string;
}

export interface ThreadPost {
  text: string;
  date: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface SocialLink {
  label: string;
  url: string;
  /** icon key rendered by the contact page */
  icon: 'github' | 'linkedin' | 'email' | 'website' | 'threads';
}

export interface Highlight {
  /** the big line, e.g. "8+ yrs" */
  value: string;
  /** what it measures, e.g. "Reliability engineering" */
  label: string;
  /** optional supporting line */
  detail?: string;
}

export interface RetroContent {
  identity: {
    name: string;
    title: string;
    /** each string renders as one paragraph */
    bio: string[];
    /** cockpit status line, bottom of the hero — keep it short and SRE-flavored */
    status: string;
  };
  /** three quick-glance stats inlined in the About hero */
  highlights: Highlight[];
  education: TimelineEntry[];
  experience: ExperienceEntry[];
  projects: Project[];
  skills: SkillCategory[];
  certifications: Certification[];
  contact: {
    heading: string;
    note: string;
    /** email is sourced from import.meta.env.PUBLIC_CONTACT_EMAIL, not stored here */
    socials: SocialLink[];
    /** recent Threads posts — template data until the live feed is wired */
    threads: {
      url: string;
      /** e.g. "@wadoodphotos" — shown on the Forum placard */
      handle: string;
      posts: ThreadPost[];
    };
    /** the blog teaser line */
    blog: {
      label: string;
      note: string;
    };
    /** the Forum's smaller banners — each sworn to a house; url optional until live */
    outposts: { label: string; sub: string; house: string; url?: string }[];
  };
}

export const content: RetroContent = {
  identity: {
    // name drives the retro site's browser tab title
    name: 'Wadood Sultan',
    title: 'Senior Site Reliability Engineer',
    bio: [
      'I build platforms that make complex systems boring and predictable.',
      'Currently keeping mission-critical infrastructure honest at scale, with a soft spot for Kubernetes, clean automation, and teaching what I learn.',
      'An engineer driven by the oxymoron of minimalist complexity — and I believe the potential of the future is AI.',
    ],
    // TODO: telemetry one-liner not provided in answers.txt — placeholder below
    status: 'ALL SYSTEMS NOMINAL · SLO 99.99 · us-east-1',
  },

  highlights: [
    // NOTE: answers.txt Section 10 did not pick the 3 stats, so these are DERIVED
    // counts of your real data (9 projects, 9 certs, 3 degrees) — swap freely.
    { value: '9', label: 'Projects shipped', detail: 'ML, cloud, IoT, and serverless' },
    { value: '9', label: 'Certifications', detail: 'AWS, Kubernetes, Kafka, and more' },
    { value: '3', label: 'Degrees', detail: 'B.Tech · M.S. · Ph.D. (in progress)' },
  ],

  education: [
    {
      title: 'Ph.D. in Information Technology',
      institution: 'University of the Cumberlands',
      location: 'Kentucky, USA',
      period: '2023 — Present',
      details: [
        '4.0 GPA',
        'Pursuing dissertation in Artificial Intelligence',
        'Working on an MCP-focused dissertation paper',
        'Conducted multiple paper presentations',
      ],
    },
    {
      title: 'Master of Science in Computer Science',
      institution: 'California State University, East Bay',
      location: 'Bay Area, California',
      period: '2018 — 2020',
      details: [
        '3.4 GPA',
        'Graduate Teaching Assistant and Graduate Computer Science Tutor',
        'Google Developer Student Club Lead',
      ],
    },
    {
      title: 'Bachelor of Technology in Computer Science',
      institution: 'SRM Institute of Science and Technology',
      location: 'Chennai, India',
      period: '2014 — 2018',
      details: [
        'IET Conclave Speaker · MSB Guest Lecturer',
        'Campus Ambassador — VH1',
        'Editor — Official Newspaper',
        'Director — SRMV Model UN',
      ],
    },
  ],

  experience: [
    {
      role: 'Senior Site Reliability Engineer 3',
      company: 'Crystal Equation (Meta)',
      location: 'California, USA',
      period: 'January 2025 — Present',
      achievements: [
        'Architected GenAI + MCP integration — 40% efficiency gain',
        'SME for 4+ mission-critical apps and SLO/SLI reviews',
        'Led RAG/GenAI/MCP training; drive third-party AI initiatives',
      ],
      skills: ['GenAI', 'MCP', 'RAG', 'Chef', 'SLO/SLI'],
    },
    {
      role: 'Site Reliability Engineer 2',
      company: 'Crystal Equation (Meta)',
      location: 'California, USA',
      period: 'September 2021 — December 2024',
      achievements: [
        'Built HA platforms and automation for third-party apps',
        'Orchestrated Kubernetes and Docker workloads with Terraform',
        'Led all cross-functional container and Kubernetes initiatives',
      ],
      skills: ['Kubernetes', 'Terraform', 'Docker', 'AWS'],
    },
    {
      role: 'Systems Engineer',
      company: 'GoSite',
      location: 'San Diego (Remote), USA',
      period: 'May 2021 — August 2021',
      achievements: [
        'Migrated BigQuery to AWS Lambda — cut query time 68%',
        'Built Mode BI dashboards on AWS for stakeholders',
        'Ran monitoring with Snowflake, DBT, Splunk, and Prometheus',
      ],
      skills: ['AWS Lambda', 'Snowflake', 'DBT', 'Splunk', 'Prometheus'],
    },
    {
      role: 'Technical Engineer',
      company: 'TalentNet Inc',
      location: 'Michigan (Remote), USA',
      period: 'January 2021 — May 2021',
      achievements: [
        'Managed GoSystem Tax RS on AWS for millions',
        'Cut software complexity 40% via automation; earned promotion',
        'Built CI/CD pipeline in PowerShell via REST API',
      ],
      skills: ['AWS', 'Linux', 'PowerShell', 'CI/CD'],
    },
  ],

  projects: [
    // From answers.txt Section 6. No repo/demo links or screenshots were provided,
    // so `link`/`image` are omitted. Descriptions are the subtitles you gave.
    { name: 'US Road Traffic Severity Prediction', description: 'Machine Learning', stack: ['Python', 'AWS', 'API', 'Docker', 'Jenkins', 'Flask', 'S3'] },
    { name: 'Facial Expression Recognition System', description: 'Machine Learning · Research Paper', stack: ['Python', 'HAAR Filters', 'CNN Algorithm', 'OpenCV', 'FisherFaceRecognizer'] },
    { name: 'Udagram Image Filter', description: 'Node.js Cloud-Based', stack: ['NodeJS', 'API', 'TypeScript', 'AWS', 'RESTful', 'Git', 'SQL', 'Jenkins'] },
    { name: 'Code Editor', description: 'Web React JS', stack: ['React JS', 'HTML/CSS', 'JavaScript', 'API', 'Git', 'Terraform', 'Vercel'] },
    { name: 'Geotagging Website', description: 'Three-tier React JS Web Application', stack: ['React JS', 'OAuth', 'Google Cloud Platform', 'Ansible', 'MongoDB'] },
    { name: 'eCommerce Desktop Application', description: 'Electron JS', stack: ['ElectronJS', 'HTML', 'Materialize CSS', 'Linux', 'Desktop App'] },
    { name: 'Message Data Streaming', description: 'Apache Kafka', stack: ['Python', 'Zookeeper', 'Git', 'Kafka', 'Big Data'] },
    { name: 'CI/CD Workflow Serverless Applications', description: 'Red Hat OpenShift', stack: ['GitOps', 'OpenShift', 'Knative', 'Argo CD', 'Serverless'] },
    { name: 'Infant Monitor System', description: 'Internet of Things', stack: ['AWS IoT', 'Git', 'MQTT', 'IFTTT', 'Raspberry Pi', 'Debian OS'] },
  ],

  skills: [
    // From answers.txt Section 8 (this view shows names only; ratings live in the
    // terminal `skills` command). NOTE: your updated Section 8 no longer lists a
    // Frontend group or TypeScript/Java/C++ — tell me if you want those kept.
    { category: 'Languages', items: ['Python', 'JavaScript', 'Shell / Bash', 'Ruby'] },
    { category: 'Backend / Cloud', items: ['AWS', 'Docker', 'Kubernetes'] },
    { category: 'AI / ML', items: ['RAG / LLM', 'ML basics'] },
    { category: 'Tools', items: ['Git / GitHub', 'Linux / WSL', 'CI/CD'] },
  ],

  certifications: [
    // From answers.txt Section 7. Issuers derived from the names you gave.
    // TODO: years NOT PROVIDED in answers.txt — left blank (don't render a year).
    // TODO: CKA issuer not stated in answers.txt — left blank.
    { name: 'Python Certified', issuer: 'HackerRank', year: '' },
    { name: 'Solutions Architect – Associate', issuer: 'Amazon Web Services', year: '' },
    { name: 'Customer Council Member', issuer: 'AWS', year: '' },
    { name: 'Certified Kubernetes Administrator (CKA)', issuer: '', year: '' },
    { name: 'OpenShift Container Platform Training', issuer: 'Red Hat', year: '' },
    { name: 'Cloud Engineering with Google (Professional)', issuer: 'Coursera', year: '' },
    { name: 'Fundamentals for Apache Kafka', issuer: 'Confluent', year: '' },
    { name: 'DevNet Sandbox – Cloud Module', issuer: 'Cisco', year: '' },
    { name: 'Advanced JVM / J2EE Java Enterprise Servlets', issuer: 'Oracle Workforce Development', year: '' },
  ],

  contact: {
    heading: "Let's Connect",
    // TODO: availability note NOT PROVIDED in answers.txt — generic placeholder
    note: 'Best reached by email — I reply within a day or two.',
    socials: [
      { label: 'GitHub', url: 'https://github.com/SMWundefined/', icon: 'github' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/smw147', icon: 'linkedin' },
      { label: 'Threads', url: 'https://www.threads.com/@wadoodphotos', icon: 'threads' },
      { label: 'Website', url: 'https://wadoodsultan.com', icon: 'website' },
    ],
    threads: {
      url: 'https://www.threads.com/@wadoodphotos',
      handle: '@wadoodphotos',
      // Post 1 below is the verbatim text of the post you linked (threads.com/share/Dk1YZJNm9).
      // TODO: your 2nd linked post (threads.com/share/MIDEN4MRi, a Google I/O 2024 image
      // post dated 05/14/24) has no extractable caption — paste its text and I'll add it.
      posts: [
        {
          text: 'TIL, Geoffrey Hinton, the great-great-grandson of George Boole, who invented the Boolean Algebra, was the PhD advisor of Ilya Sutskever and Alex Krizhevsky, and co-authored the paper on AlexNet which kicked started the new generation of GenAI and GPTs!',
          date: 'Jul 2025',
        },
      ],
    },
    blog: {
      // confirmed in answers.txt Section 10: "Blogsphere (or something Red Rising coded)"
      label: 'Blogsphere',
      // a Red Rising nod — the Society's motto
      note: 'per aspera ad astra — coming soon',
    },
    outposts: [
      // from answers.txt Section 3 ("any other socials"), each sworn to a house
      { label: 'Chess.com', sub: 'bullet 1650', house: 'house mars — the war game', url: 'https://www.chess.com/member/wadoodsm' },
      { label: 'arXiv', sub: 'wadood_sm', house: 'house minerva — the scholar' },
      { label: 'IEEE', sub: 'Wadood Sultan Mohammed', house: 'house vulcan — the forge' },
    ],
  },
};
