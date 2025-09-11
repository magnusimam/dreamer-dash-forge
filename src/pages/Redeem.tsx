import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Coins, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  category: "digital" | "physical" | "premium";
  popular?: boolean;
}

interface RedeemProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
}

const rewardItems: RewardItem[] = [
  {
    id: "1",
    title: "Amazon Gift Card $10",
    description: "Delivered via email within 24 hours",
    cost: 1000,
    category: "digital",
    popular: true,
  },
  {
    id: "2",
    title: "Netflix Premium 1 Month",
    description: "Stream unlimited movies and shows",
    cost: 1500,
    category: "digital",
  },
  {
    id: "3",
    title: "Spotify Premium 3 Months",
    description: "Ad-free music streaming",
    cost: 2000,
    category: "digital",
  },
  {
    id: "4",
    title: "Gaming Mouse",
    description: "High-precision wireless gaming mouse",
    cost: 5000,
    category: "physical",
  },
  {
    id: "5",
    title: "VIP Status Badge",
    description: "Exclusive perks and early access",
    cost: 10000,
    category: "premium",
  },
];

export default function Redeem({ balance, onUpdateBalance }: RedeemProps) {
  const { toast } = useToast();

  const handleRedeem = (item: RewardItem) => {
    if (balance < item.cost) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${item.cost - balance} more DR to redeem this item.`,
        variant: "destructive",
      });
      return;
    }

    onUpdateBalance(-item.cost);
    toast({
      title: "Redeemed Successfully! 🎉",
      description: `${item.title} has been added to your account.`,
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "premium":
        return "bg-gradient-to-r from-purple-500 to-pink-500";
      case "physical":
        return "bg-gradient-to-r from-blue-500 to-cyan-500";
      default:
        return "bg-gradient-to-r from-primary to-yellow-500";
    }
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
          Rewards Store 🎁
        </h1>
        <p className="text-muted-foreground">
          Redeem your Dreamers Coins for amazing rewards
        </p>
      </motion.div>

      {/* Balance Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="gradient-card border-border/50 p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              Available Balance: {balance.toLocaleString()} DR
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Reward Items */}
      <div className="space-y-4">
        {rewardItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.1 }}
          >
            <Card className="gradient-card border-border/50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      className={`${getCategoryColor(item.category)} text-white border-0`}
                    >
                      {item.category}
                    </Badge>
                    {item.popular && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Star className="w-3 h-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-primary font-semibold">
                    {item.cost.toLocaleString()} DR
                  </span>
                </div>

                <Button
                  onClick={() => handleRedeem(item)}
                  disabled={balance < item.cost}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow disabled:shadow-none disabled:opacity-50"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Redeem
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}