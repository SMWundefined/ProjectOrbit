// Content for the /retro static portfolio. Fill in your real details —
// every entry below is a placeholder marked with TODO. The page templates
// never hardcode content; they all read from this object.

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
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export interface SocialLink {
  label: string;
  url: string;
  /** icon key rendered by the contact page */
  icon: 'github' | 'linkedin' | 'email' | 'website' | 'threads';
}

export interface RetroContent {
  identity: {
    name: string;
    title: string;
    /** each string renders as one paragraph */
    bio: string[];
    /** optional path under public/, e.g. "/profile.jpg" */
    photo?: string;
  };
  education: TimelineEntry[];
  experience: ExperienceEntry[];
  projects: Project[];
  certifications: Certification[];
  contact: {
    heading: string;
    note: string;
    email: string;
    socials: SocialLink[];
  };
}

export const content: RetroContent = {
  identity: {
    // TODO: your name and title
    name: 'Alex Rivera',
    title: 'Site Reliability Engineer',
    bio: [
      // TODO: 2-3 sentences, first person, warm not resume-speak
      'I build platforms that make complex systems boring and predictable.',
      'Currently keeping mission-critical infrastructure honest at scale, with a soft spot for Kubernetes, clean automation, and teaching what I learn.',
    ],
    // TODO: drop a photo in public/ and set the path, or remove
    photo: undefined,
  },

  education: [
    // TODO: replace with your 3 schools (most recent first)
    {
      title: 'Ph.D. in Information Technology',
      institution: 'Lakeside State University',
      location: 'Portland, USA',
      period: '2023 — Present',
      details: ['Dissertation in AI and information infrastructure', '4.0 GPA, multiple paper presentations'],
    },
    {
      title: 'M.S. in Computer Science',
      institution: 'Bayview Institute of Technology',
      location: 'San Francisco, USA',
      period: '2018 — 2020',
      details: ['Distributed systems and cloud engineering focus', 'Graduate teaching assistant and developer club lead'],
    },
    {
      title: 'B.Tech in Computer Science',
      institution: 'Coastal University',
      location: 'Chennai, India',
      period: '2014 — 2018',
      details: ['Conference speaker and campus newspaper editor'],
    },
  ],

  experience: [
    // TODO: replace with your 4 roles (most recent first)
    {
      role: 'Site Reliability Engineer 2',
      company: 'Northwind Cloud',
      location: 'California, USA',
      period: 'Sept 2021 — Present',
      achievements: [
        'Subject matter expert for 4+ mission-critical applications with regular SLO reviews',
        'Lead cross-functional container and Kubernetes initiatives across teams',
        'Promoted by driving best practices and reliability improvements',
      ],
      skills: ['Kubernetes', 'Terraform', 'AWS', 'Chef', 'Docker'],
    },
    {
      role: 'Systems Engineer',
      company: 'Brightpath Labs',
      location: 'San Diego (Remote), USA',
      period: 'May 2021 — Aug 2021',
      achievements: [
        'Re-architected query pipeline, reducing querying time by 68%',
        'Built BI dashboards and monitoring across the data platform',
      ],
      skills: ['AWS Lambda', 'Snowflake', 'Splunk', 'Prometheus'],
    },
    {
      role: 'Technical Engineer',
      company: 'Cedar Analytics',
      location: 'Michigan (Remote), USA',
      period: 'Jan 2021 — May 2021',
      achievements: [
        'Reduced code complexity of tax workflow software by 40% via automation',
        'Diagnosed complex system issues across multiple regions',
      ],
      skills: ['AWS', 'Linux', 'PowerShell', 'CI/CD'],
    },
    {
      role: 'Software Engineer (Full-Stack)',
      company: 'Pinecrest Digital',
      location: 'New York (Remote), USA',
      period: 'Aug 2020 — Dec 2020',
      achievements: [
        'Built secure auth and FTP integration on a Java Spring stack',
        'Implemented monitoring and alerting with CloudWatch',
      ],
      skills: ['Java Spring', 'JavaScript', 'Selenium', 'CloudWatch'],
    },
  ],

  projects: [
    // TODO: replace with your 9 projects
    { name: 'Road Traffic Severity Prediction', description: 'Machine learning pipeline predicting accident severity from live data.', stack: ['Python', 'AWS', 'Docker', 'Flask'] },
    { name: 'Facial Expression Recognition', description: 'CNN-based recognition system, published as a research paper.', stack: ['Python', 'OpenCV', 'CNN'], link: 'https://example.com/paper' },
    { name: 'Image Filter Service', description: 'Cloud-based image processing API with full CI.', stack: ['NodeJS', 'TypeScript', 'AWS'] },
    { name: 'Web Code Editor', description: 'Browser IDE with live preview, deployed serverlessly.', stack: ['React', 'Terraform', 'Vercel'] },
    { name: 'Geotagging Platform', description: 'Three-tier web app with OAuth and geo data.', stack: ['React', 'GCP', 'MongoDB'] },
    { name: 'Desktop eCommerce App', description: 'Cross-platform desktop storefront.', stack: ['Electron', 'Materialize'] },
    { name: 'Kafka Data Streaming', description: 'Message streaming pipeline for big-data workloads.', stack: ['Python', 'Kafka', 'Zookeeper'] },
    { name: 'Serverless CI/CD Workflows', description: 'GitOps deployment flows on OpenShift.', stack: ['OpenShift', 'Argo CD', 'Knative'] },
    { name: 'Infant Monitor System', description: 'IoT monitoring with cloud alerts on a Raspberry Pi.', stack: ['AWS IoT', 'MQTT', 'Raspberry Pi'] },
  ],

  certifications: [
    // TODO: replace with your 10 certifications
    { name: 'Certified Kubernetes Administrator (CKA)', issuer: 'CNCF', year: '2023' },
    { name: 'AWS Solutions Architect — Associate', issuer: 'Amazon Web Services', year: '2022' },
    { name: 'OpenShift Container Platform Training', issuer: 'Red Hat', year: '2022' },
    { name: 'Cloud Engineering Professional', issuer: 'Coursera / Google', year: '2021' },
    { name: 'Apache Kafka Fundamentals', issuer: 'Confluent', year: '2021' },
    { name: 'DevNet Sandbox — Cloud Module', issuer: 'Cisco', year: '2021' },
    { name: 'Scala Professional', issuer: 'Example Org', year: '2020' },
    { name: 'Enterprise Java (J2EE) Development', issuer: 'Oracle Workforce Development', year: '2019' },
    { name: 'Python Certified', issuer: 'HackerRank', year: '2019' },
    { name: 'Customer Council Member', issuer: 'AWS', year: '2024' },
  ],

  contact: {
    heading: "Let's Connect",
    // TODO: one-line availability note
    note: 'Best reached by email — I reply within a day or two.',
    // TODO: your email
    email: 'alex@example.com',
    socials: [
      // TODO: your real links
      { label: 'GitHub', url: 'https://github.com/example', icon: 'github' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/example', icon: 'linkedin' },
      { label: 'Website', url: 'https://example.com', icon: 'website' },
    ],
  },
};
