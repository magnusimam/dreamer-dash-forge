import { motion } from "framer-motion";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MissionCard from "@/components/MissionCard";
import { mockMissions } from "@/data/mockData";

interface MissionsProps {
  onUpdateBalance: (amount: number) => void;
}

export default function Missions({ onUpdateBalance }: MissionsProps) {
  const [missions, setMissions] = useState(mockMissions);

  const handleCompleteMission = (missionId: string) => {
    setMissions(prev => 
      prev.map(mission => 
        mission.id === missionId 
          ? { ...mission, completed: true }
          : mission
      )
    );
    
    const mission = missions.find(m => m.id === missionId);
    if (mission && !mission.completed) {
      onUpdateBalance(mission.reward);
    }
  };

  const availableMissions = missions.filter(m => !m.completed);
  const completedMissions = missions.filter(m => m.completed);
  const dailyMissions = missions.filter(m => m.category === "Daily");
  const socialMissions = missions.filter(m => m.category === "Social");

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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {availableMissions.map((mission, index) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MissionCard
                  mission={mission}
                  onComplete={handleCompleteMission}
                />
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="daily">
          {dailyMissions.map((mission, index) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <MissionCard
                mission={mission}
                onComplete={handleCompleteMission}
              />
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="social">
          {socialMissions.map((mission, index) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <MissionCard
                mission={mission}
                onComplete={handleCompleteMission}
              />
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="completed">
          {completedMissions.length > 0 ? (
            completedMissions.map((mission, index) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MissionCard
                  mission={mission}
                  onComplete={handleCompleteMission}
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">
                No completed missions yet. Start earning!
              </p>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}