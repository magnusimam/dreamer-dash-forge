export const mockMissions = [
  {
    id: "1",
    title: "Daily Check-in",
    description: "Open the app and claim your daily reward",
    reward: 50,
    completed: false,
    category: "Daily",
  },
  {
    id: "2",
    title: "Follow on Twitter",
    description: "Follow @DreamersCoin on Twitter for updates",
    reward: 100,
    completed: false,
    category: "Social",
  },
  {
    id: "3",
    title: "Join Telegram",
    description: "Join our official Telegram community",
    reward: 150,
    completed: false,
    category: "Social",
  },
  {
    id: "4",
    title: "Complete Profile",
    description: "Add a profile picture and bio",
    reward: 200,
    completed: false,
    category: "Daily",
  },
  {
    id: "5",
    title: "Share with Friends",
    description: "Invite 3 friends to join Dreamers Coin",
    reward: 500,
    completed: false,
    category: "Social",
  },
  {
    id: "6",
    title: "Watch Tutorial",
    description: "Watch the complete app tutorial video",
    reward: 75,
    completed: true,
    category: "Daily",
  },
];

export const mockTransactions = [
  {
    id: "1",
    type: "mission" as const,
    amount: 200,
    description: "Completed: Complete Profile",
    timestamp: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    type: "mission" as const,
    amount: 100,
    description: "Completed: Follow on Twitter",
    timestamp: "2024-01-15T09:15:00Z",
  },
  {
    id: "3",
    type: "redeem" as const,
    amount: 1000,
    description: "Redeemed: Amazon Gift Card $10",
    timestamp: "2024-01-14T16:45:00Z",
  },
  {
    id: "4",
    type: "bonus" as const,
    amount: 150,
    description: "Daily streak bonus",
    timestamp: "2024-01-14T08:00:00Z",
  },
  {
    id: "5",
    type: "mission" as const,
    amount: 50,
    description: "Completed: Daily Check-in",
    timestamp: "2024-01-14T07:30:00Z",
  },
  {
    id: "6",
    type: "mission" as const,
    amount: 500,
    description: "Completed: Invite Friends",
    timestamp: "2024-01-13T14:20:00Z",
  },
  {
    id: "7",
    type: "earn" as const,
    amount: 300,
    description: "Weekly challenge reward",
    timestamp: "2024-01-13T12:00:00Z",
  },
];

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  reward: number;
  code: string;
  maxParticipants: number;
  currentParticipants: number;
  category: "meeting" | "workshop" | "event" | "outreach";
}

export const mockActivities: Activity[] = [
  {
    id: "a1",
    title: "Dream Circle Meeting — Q1",
    description: "First quarter community gathering to align vision and goals for the year ahead.",
    date: "2024-03-15",
    reward: 200,
    code: "DREAM-Q1-2024",
    maxParticipants: 50,
    currentParticipants: 32,
    category: "meeting",
  },
  {
    id: "a2",
    title: "Vision Board Workshop",
    description: "Hands-on session crafting personal and community vision boards together.",
    date: "2024-03-22",
    reward: 150,
    code: "VISION-WS-03",
    maxParticipants: 30,
    currentParticipants: 18,
    category: "workshop",
  },
  {
    id: "a3",
    title: "Community Outreach — Lagos",
    description: "On-ground outreach and onboarding drive in Lagos communities.",
    date: "2024-04-05",
    reward: 300,
    code: "OUTREACH-LG-04",
    maxParticipants: 100,
    currentParticipants: 67,
    category: "outreach",
  },
  {
    id: "a4",
    title: "Dream Circle Meeting — Q2",
    description: "Second quarter check-in. Review progress, celebrate wins, plan next steps.",
    date: "2024-06-10",
    reward: 200,
    code: "DREAM-Q2-2024",
    maxParticipants: 50,
    currentParticipants: 0,
    category: "meeting",
  },
];

export interface Hackathon {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  entryFee: number;
  prize: string;
  maxTeams: number;
  registeredTeams: number;
  tags: string[];
  status: "upcoming" | "active" | "completed";
}

export const mockHackathons: Hackathon[] = [
  {
    id: "h1",
    title: "DreamBuild Hackathon 2024",
    description: "Build solutions that empower dreamers in African communities. 48 hours of hacking, mentorship, and prizes.",
    startDate: "2024-04-20",
    endDate: "2024-04-22",
    entryFee: 500,
    prize: "₦500,000 + Mentorship",
    maxTeams: 20,
    registeredTeams: 12,
    tags: ["Web3", "Community", "Impact"],
    status: "upcoming",
  },
  {
    id: "h2",
    title: "AI for Good Challenge",
    description: "Leverage AI to solve real problems in education, health, and agriculture across Africa.",
    startDate: "2024-05-10",
    endDate: "2024-05-12",
    entryFee: 300,
    prize: "₦300,000 + Incubation",
    maxTeams: 30,
    registeredTeams: 8,
    tags: ["AI", "EdTech", "Health"],
    status: "upcoming",
  },
  {
    id: "h3",
    title: "Fintech Dreamers Sprint",
    description: "Design financial tools that give dreamers access to savings, lending, and investment products.",
    startDate: "2024-02-01",
    endDate: "2024-02-03",
    entryFee: 400,
    prize: "₦400,000",
    maxTeams: 15,
    registeredTeams: 15,
    tags: ["Fintech", "Payments", "Savings"],
    status: "completed",
  },
];
