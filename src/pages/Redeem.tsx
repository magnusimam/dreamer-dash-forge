import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Smartphone,
  Wifi,
  Banknote,
  Book,
  Users,
  GraduationCap,
  MoreHorizontal,
  Coins,
  CalendarIcon,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useSubmitRedemption } from "@/hooks/useSupabase";
import { hapticNotification } from "@/lib/telegram";

interface RedemptionCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  cost: number;
}

const airtimeSchema = z.object({
  phoneNumber: z.string().min(11, "Phone number must be 11 digits"),
  network: z.string().min(1, "Please select a network"),
});

const dataSchema = z.object({
  phoneNumber: z.string().min(11, "Phone number must be 11 digits"),
  network: z.string().min(1, "Please select a network"),
  dataAmount: z.string().min(1, "Please select data amount"),
});

const cashSchema = z.object({
  bankName: z.string().min(1, "Please select a bank"),
  accountNumber: z.string().length(10, "Account number must be 10 digits"),
  accountName: z.string().min(1, "Account name is required"),
});

const booksSchema = z.object({
  deliveryOption: z.string().min(1, "Please select delivery option"),
  address: z.string().optional(),
  bookCategory: z.string().min(1, "Please select a book category"),
});

const mentorshipSchema = z.object({
  mentorCategory: z.string().min(1, "Please select a mentor category"),
  preferredDate: z.date().optional(),
});

const courseSchema = z.object({
  courseName: z.string().min(1, "Course name is required"),
  courseLink: z.string().url("Please enter a valid URL"),
});

const otherSchema = z.object({
  description: z.string().min(10, "Please provide more details (minimum 10 characters)"),
});

const categoryRequirements: Record<string, string> = {
  airtime: "Phone + Network",
  data: "Phone + Network + Amount",
  cash: "Bank + Account details",
  books: "Delivery option + Category",
  mentorship: "Category + Date",
  courses: "Course name + Link",
  other: "Description",
};

const redemptionCategories: RedemptionCategory[] = [
  { id: "airtime", title: "Airtime", description: "Recharge your phone with airtime", icon: Smartphone, color: "from-blue-500 to-cyan-500", cost: 500 },
  { id: "data", title: "Data", description: "Purchase mobile data bundles", icon: Wifi, color: "from-green-500 to-emerald-500", cost: 800 },
  { id: "cash", title: "Cash", description: "Transfer cash to your bank account", icon: Banknote, color: "from-primary to-yellow-500", cost: 1000 },
  { id: "books", title: "Books", description: "Get physical or digital books", icon: Book, color: "from-purple-500 to-pink-500", cost: 600 },
  { id: "mentorship", title: "Mentorship", description: "Book a session with our mentors", icon: Users, color: "from-orange-500 to-red-500", cost: 1500 },
  { id: "courses", title: "Pay for Courses", description: "Fund your online learning", icon: GraduationCap, color: "from-indigo-500 to-purple-500", cost: 2000 },
  { id: "other", title: "Other", description: "Custom redemption request", icon: MoreHorizontal, color: "from-gray-500 to-slate-500", cost: 100 },
];

interface RedeemProps {
  onTabChange?: (tab: string) => void;
}

export default function Redeem({ onTabChange }: RedeemProps) {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const submitRedemption = useSubmitRedemption();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const balance = dbUser?.balance ?? 0;

  const airtimeForm = useForm({ resolver: zodResolver(airtimeSchema), defaultValues: { phoneNumber: "", network: "" } });
  const dataForm = useForm({ resolver: zodResolver(dataSchema), defaultValues: { phoneNumber: "", network: "", dataAmount: "" } });
  const cashForm = useForm({ resolver: zodResolver(cashSchema), defaultValues: { bankName: "", accountNumber: "", accountName: "" } });
  const booksForm = useForm({ resolver: zodResolver(booksSchema), defaultValues: { deliveryOption: "", address: "", bookCategory: "" } });
  const mentorshipForm = useForm({ resolver: zodResolver(mentorshipSchema) });
  const courseForm = useForm({ resolver: zodResolver(courseSchema), defaultValues: { courseName: "", courseLink: "" } });
  const otherForm = useForm({ resolver: zodResolver(otherSchema), defaultValues: { description: "" } });

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: any, type: string) => {
    const category = redemptionCategories.find(c => c.id === type);
    if (!category) return;

    if (balance < category.cost) {
      hapticNotification("error");
      toast({ title: "Insufficient Balance", description: `You need ${category.cost} DR.`, variant: "destructive" });
      return;
    }

    try {
      const result = await submitRedemption.mutateAsync({
        category: type,
        amount: category.cost,
        details: data,
      });

      if (result?.success) {
        hapticNotification("success");
        setIsDialogOpen(false);
        setSelectedCategory(null);

        // Reset forms
        const forms: Record<string, any> = { airtime: airtimeForm, data: dataForm, cash: cashForm, books: booksForm, mentorship: mentorshipForm, courses: courseForm, other: otherForm };
        forms[type]?.reset();

        toast({
          title: "Redemption Request Submitted! 🎉",
          description: `${category.cost} DR deducted. You'll receive confirmation shortly.`,
        });
      } else {
        toast({ title: "Failed", description: result?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Submission failed.", variant: "destructive" });
    }
  };

  const renderForm = () => {
    if (!selectedCategory) return null;

    switch (selectedCategory) {
      case "airtime":
        return (
          <Form {...airtimeForm}>
            <form onSubmit={airtimeForm.handleSubmit((data) => handleSubmit(data, "airtime"))} className="space-y-4">
              <FormField control={airtimeForm.control} name="phoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="080 1234 5678" maxLength={11} inputMode="tel" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={airtimeForm.control} name="network" render={({ field }) => (
                <FormItem><FormLabel>Network</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="mtn">MTN</SelectItem><SelectItem value="airtel">Airtel</SelectItem>
                      <SelectItem value="glo">Glo</SelectItem><SelectItem value="9mobile">9Mobile</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (500 DR)
              </Button>
            </form>
          </Form>
        );
      case "data":
        return (
          <Form {...dataForm}>
            <form onSubmit={dataForm.handleSubmit((data) => handleSubmit(data, "data"))} className="space-y-4">
              <FormField control={dataForm.control} name="phoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="080 1234 5678" maxLength={11} inputMode="tel" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={dataForm.control} name="network" render={({ field }) => (
                <FormItem><FormLabel>Network</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="mtn">MTN</SelectItem><SelectItem value="airtel">Airtel</SelectItem>
                      <SelectItem value="glo">Glo</SelectItem><SelectItem value="9mobile">9Mobile</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={dataForm.control} name="dataAmount" render={({ field }) => (
                <FormItem><FormLabel>Data Amount</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select data amount" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="500mb">500MB</SelectItem><SelectItem value="1gb">1GB</SelectItem>
                      <SelectItem value="2gb">2GB</SelectItem><SelectItem value="5gb">5GB</SelectItem>
                      <SelectItem value="10gb">10GB</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (800 DR)
              </Button>
            </form>
          </Form>
        );
      case "cash":
        return (
          <Form {...cashForm}>
            <form onSubmit={cashForm.handleSubmit((data) => handleSubmit(data, "cash"))} className="space-y-4">
              <FormField control={cashForm.control} name="bankName" render={({ field }) => (
                <FormItem><FormLabel>Bank Name</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="access">Access Bank</SelectItem><SelectItem value="gtb">GTBank</SelectItem>
                      <SelectItem value="first">First Bank</SelectItem><SelectItem value="uba">UBA</SelectItem>
                      <SelectItem value="zenith">Zenith Bank</SelectItem><SelectItem value="fidelity">Fidelity Bank</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={cashForm.control} name="accountNumber" render={({ field }) => (
                <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="1234567890" maxLength={10} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={cashForm.control} name="accountName" render={({ field }) => (
                <FormItem><FormLabel>Account Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (1,000 DR)
              </Button>
            </form>
          </Form>
        );
      case "books":
        return (
          <Form {...booksForm}>
            <form onSubmit={booksForm.handleSubmit((data) => handleSubmit(data, "books"))} className="space-y-4">
              <FormField control={booksForm.control} name="deliveryOption" render={({ field }) => (
                <FormItem><FormLabel>Delivery Option</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select delivery option" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="physical">Physical</SelectItem><SelectItem value="ebook">eBook</SelectItem></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              {booksForm.watch("deliveryOption") === "physical" && (
                <FormField control={booksForm.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Delivery Address</FormLabel><FormControl><Textarea placeholder="Enter your full address" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              <FormField control={booksForm.control} name="bookCategory" render={({ field }) => (
                <FormItem><FormLabel>Preferred Book Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem><SelectItem value="tech">Technology</SelectItem>
                      <SelectItem value="personal">Personal Development</SelectItem><SelectItem value="fiction">Fiction</SelectItem>
                      <SelectItem value="education">Educational</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (600 DR)
              </Button>
            </form>
          </Form>
        );
      case "mentorship":
        return (
          <Form {...mentorshipForm}>
            <form onSubmit={mentorshipForm.handleSubmit((data) => handleSubmit(data, "mentorship"))} className="space-y-4">
              <FormField control={mentorshipForm.control} name="mentorCategory" render={({ field }) => (
                <FormItem><FormLabel>Mentor Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select mentor category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem><SelectItem value="career">Career</SelectItem>
                      <SelectItem value="tech">Technology</SelectItem><SelectItem value="personal">Personal Growth</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={mentorshipForm.control} name="preferredDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Preferred Date & Time</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (1,500 DR)
              </Button>
            </form>
          </Form>
        );
      case "courses":
        return (
          <Form {...courseForm}>
            <form onSubmit={courseForm.handleSubmit((data) => handleSubmit(data, "courses"))} className="space-y-4">
              <FormField control={courseForm.control} name="courseName" render={({ field }) => (
                <FormItem><FormLabel>Course Name</FormLabel><FormControl><Input placeholder="Enter course name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={courseForm.control} name="courseLink" render={({ field }) => (
                <FormItem><FormLabel>Course Link</FormLabel><FormControl><Input placeholder="https://example.com/course" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (2,000 DR)
              </Button>
            </form>
          </Form>
        );
      case "other":
        return (
          <Form {...otherForm}>
            <form onSubmit={otherForm.handleSubmit((data) => handleSubmit(data, "other"))} className="space-y-4">
              <FormField control={otherForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl>
                  <Textarea placeholder="Please describe what you would like to redeem for..." className="min-h-[100px]" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitRedemption.isPending}>
                {submitRedemption.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request (100 DR)
              </Button>
            </form>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-28 px-4 pt-6"
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Redeem Dreams</h1>
        <p className="text-muted-foreground">Choose what you'd like to redeem your Dreams for</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="gradient-card border-border/50 p-4 mb-4">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              Available Balance: {balance.toLocaleString()} DR
            </span>
          </div>
        </Card>
        <p className="text-xs text-center text-muted-foreground mb-2">1 DR = 2 NGN based on redemption value</p>
        {onTabChange && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mb-6 border-border text-muted-foreground hover:text-foreground"
            onClick={() => onTabChange("redemption-history")}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            View My Redemptions
          </Button>
        )}
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {redemptionCategories.map((category, index) => {
          const IconComponent = category.icon;
          return (
            <motion.div key={category.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.1 }}>
              <Card
                className="gradient-card border-border/50 p-4 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => handleCategoryClick(category.id)}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`p-3 rounded-full bg-gradient-to-r ${category.color} shadow-lg`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{category.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                    <p className="text-xs text-primary font-semibold mt-1">{category.cost} DR</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Needs: {categoryRequirements[category.id]}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory && redemptionCategories.find(c => c.id === selectedCategory)?.title} Redemption
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">{renderForm()}</div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
