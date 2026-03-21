import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MissionCard from "@/components/MissionCard";
import { useMissions, useUserMissionCompletions, useCompleteMission } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";

export default function Missions() {
  const { data: missions = [], isLoading } = useMissions();
  const { data: completedIds = [] } = useUserMissionCompletions();
  const completeMission = useCompleteMission();

  const handleCompleteMission = async (missionId: string) => {
    await completeMission.mutateAsync(missionId);
  };

  const missionsWithStatus = missions.map((m: any) => ({
    ...m,
    completed: completedIds.includes(m.id),
  }));

  const availableMissions = missionsWithStatus.filter((m: any) => !m.completed);
  const completedMissions = missionsWithStatus.filter((m: any) => m.completed);
  const dailyMissions = missionsWithStatus.filter((m: any) => m.category === "daily");
  const socialMissions = missionsWithStatus.filter((m: any) => m.category === "social");

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
          Missions 🎯
        </h1>
        <p className="text-muted-foreground">
          Complete tasks to earn Dreamers Coins
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : missions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No missions available right now.
        </p>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {availableMissions.map((mission: any, index: number) => (
                <motion.div key={mission.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <MissionCard mission={mission} onComplete={handleCompleteMission} />
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          <TabsContent value="daily">
            {dailyMissions.map((mission: any, index: number) => (
              <motion.div key={mission.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <MissionCard mission={mission} onComplete={handleCompleteMission} />
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="social">
            {socialMissions.map((mission: any, index: number) => (
              <motion.div key={mission.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <MissionCard mission={mission} onComplete={handleCompleteMission} />
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="completed">
            {completedMissions.length > 0 ? (
              completedMissions.map((mission: any, index: number) => (
                <motion.div key={mission.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <MissionCard mission={mission} onComplete={handleCompleteMission} />
                </motion.div>
              ))
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                <p className="text-muted-foreground">No completed missions yet. Start earning!</p>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  );
}
