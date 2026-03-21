import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#FFD700", "#FFA500", "#FF6347", "#00CED1", "#7B68EE", "#32CD32"];
const PARTICLE_COUNT = 30;

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number; rotation: number }>>([]);

  useEffect(() => {
    if (active) {
      setParticles(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          delay: Math.random() * 0.5,
          rotation: Math.random() * 360,
        }))
      );
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [active]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ y: "110vh", opacity: 0, rotate: p.rotation + 720, scale: 0.5 }}
              transition={{ duration: 2 + Math.random(), delay: p.delay, ease: "easeIn" }}
              className="absolute w-3 h-3 rounded-sm"
              style={{ backgroundColor: p.color, left: 0 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
