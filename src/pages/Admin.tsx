import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Copy,
  CalendarDays,
  Users,
  Coins,
  KeyRound,
  Rocket,
  Trophy,
} from "lucide-react";

interface CreatedActivity {
  id: string;
  title: string;
  date: string;
  reward: number;
  code: string;
  category: string;
}

interface CreatedHackathon {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  entryFee: number;
  prize: string;
  maxTeams: number;
}

export default function Admin() {
  const { toast } = useToast();

  // Activity form
  const [actTitle, setActTitle] = useState("");
  const [actDate, setActDate] = useState("");
  const [actReward, setActReward] = useState("");
  const [actCategory, setActCategory] = useState("meeting");
  const [createdActivities, setCreatedActivities] = useState<CreatedActivity[]>([]);

  // Hackathon form
  const [hackTitle, setHackTitle] = useState("");
  const [hackStart, setHackStart] = useState("");
  const [hackEnd, setHackEnd] = useState("");
  const [hackFee, setHackFee] = useState("");
  const [hackPrize, setHackPrize] = useState("");
  const [hackTeams, setHackTeams] = useState("");
  const [createdHackathons, setCreatedHackathons] = useState<CreatedHackathon[]>([]);

  const generateCode = (title: string) => {
    const slug = title
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .split(" ")
      .slice(0, 2)
      .join("-");
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${slug}-${suffix}`;
  };

  const handleCreateActivity = () => {
    if (!actTitle || !actDate || !actReward) {
      toast({
        title: "Missing fields",
        description: "Please fill in title, date, and reward.",
        variant: "destructive",
      });
      return;
    }

    const code = generateCode(actTitle);
    const newActivity: CreatedActivity = {
      id: Date.now().toString(),
      title: actTitle,
      date: actDate,
      reward: parseInt(actReward),
      code,
      category: actCategory,
    };

    setCreatedActivities((prev) => [newActivity, ...prev]);
    toast({
      title: "Activity Created! ✅",
      description: `Code: ${code}`,
    });

    setActTitle("");
    setActDate("");
    setActReward("");
  };

  const handleCreateHackathon = () => {
    if (!hackTitle || !hackStart || !hackEnd || !hackFee || !hackPrize || !hackTeams) {
      toast({
        title: "Missing fields",
        description: "Please fill in all hackathon details.",
        variant: "destructive",
      });
      return;
    }

    const newHackathon: CreatedHackathon = {
      id: Date.now().toString(),
      title: hackTitle,
      startDate: hackStart,
      endDate: hackEnd,
      entryFee: parseInt(hackFee),
      prize: hackPrize,
      maxTeams: parseInt(hackTeams),
    };

    setCreatedHackathons((prev) => [newHackathon, ...prev]);
    toast({
      title: "Hackathon Posted! 🚀",
      description: `"${hackTitle}" is now live.`,
    });

    setHackTitle("");
    setHackStart("");
    setHackEnd("");
    setHackFee("");
    setHackPrize("");
    setHackTeams("");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Admin Panel 🔧
        </h1>
        <p className="text-muted-foreground">
          Create activities, generate codes, and post hackathons
        </p>
      </motion.div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
        </TabsList>

        {/* Create Activity */}
        <TabsContent value="activities">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                New Activity
              </h3>

              <div className="space-y-3">
                <Input
                  placeholder="Activity title (e.g. Dream Circle Q3)"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  className="bg-secondary border-border"
                />
                <Input
                  type="date"
                  value={actDate}
                  onChange={(e) => setActDate(e.target.value)}
                  className="bg-secondary border-border"
                />
                <Input
                  type="number"
                  placeholder="DR reward amount"
                  value={actReward}
                  onChange={(e) => setActReward(e.target.value)}
                  className="bg-secondary border-border"
                />
                <select
                  value={actCategory}
                  onChange={(e) => setActCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm"
                >
                  <option value="meeting">Meeting</option>
                  <option value="workshop">Workshop</option>
                  <option value="event">Event</option>
                  <option value="outreach">Outreach</option>
                </select>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                  onClick={handleCreateActivity}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create & Generate Code
                </Button>
              </div>
            </Card>

            {/* Created activities list */}
            {createdActivities.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">
                  Created Activities
                </h3>
                <div className="space-y-3">
                  {createdActivities.map((act) => (
                    <Card
                      key={act.id}
                      className="gradient-card border-border/50 p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-foreground">
                            {act.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(act.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Coins className="w-3 h-3 text-primary" />
                              {act.reward} DR
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {act.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-3 p-2 bg-secondary rounded-lg">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <code className="text-sm text-primary font-mono flex-1">
                          {act.code}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copyCode(act.code)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* Create Hackathon */}
        <TabsContent value="hackathons">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                Post Hackathon
              </h3>

              <div className="space-y-3">
                <Input
                  placeholder="Hackathon title"
                  value={hackTitle}
                  onChange={(e) => setHackTitle(e.target.value)}
                  className="bg-secondary border-border"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={hackStart}
                      onChange={(e) => setHackStart(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={hackEnd}
                      onChange={(e) => setHackEnd(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder="Entry fee in DR"
                  value={hackFee}
                  onChange={(e) => setHackFee(e.target.value)}
                  className="bg-secondary border-border"
                />
                <Input
                  placeholder="Prize (e.g. ₦500,000 + Mentorship)"
                  value={hackPrize}
                  onChange={(e) => setHackPrize(e.target.value)}
                  className="bg-secondary border-border"
                />
                <Input
                  type="number"
                  placeholder="Max teams"
                  value={hackTeams}
                  onChange={(e) => setHackTeams(e.target.value)}
                  className="bg-secondary border-border"
                />

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                  onClick={handleCreateHackathon}
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  Post Hackathon
                </Button>
              </div>
            </Card>

            {/* Created hackathons list */}
            {createdHackathons.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">
                  Posted Hackathons
                </h3>
                <div className="space-y-3">
                  {createdHackathons.map((hack) => (
                    <Card
                      key={hack.id}
                      className="gradient-card border-border/50 p-4"
                    >
                      <h4 className="font-medium text-foreground mb-2">
                        {hack.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(hack.startDate).toLocaleDateString()} –{" "}
                          {new Date(hack.endDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-primary" />
                          {hack.entryFee} DR
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {hack.maxTeams} teams
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-primary" />
                          {hack.prize}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
