import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Zap, 
  FileText, 
  ExternalLink,
  Settings
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";

export function AccountDialog() {
  const { 
    plan, 
    planStatus,
    aiCredits, 
    aiCreditsLimit, 
    aiCreditsResetDate,
    pdfUsageCount,
    pdfUsageResetDate,
    isLoading 
  } = useSubscription();
  const { toast } = useToast();

  const handlePortal = async () => {
    // 1. Open new tab immediately to bypass popup blockers
    const newTab = window.open('', '_blank');

    if (newTab) {
      newTab.document.title = "Redirecting to Billing...";
      // Optional: Add a simple loader/text in the new tab while it loads
      newTab.document.body.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;">
          Redirecting to Stripe...
        </div>
      `;
    }

    try {
      const res = await fetch("/api/customer-portal", { method: "POST" });
      const data = await res.json();

      if (data.url && newTab) {
        newTab.location.href = data.url;
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      newTab?.close();
      toast({
        title: "Error",
        description: "Could not open billing portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatPlanName = (rawPlan: string) => {
    if (rawPlan === 'free') return "Starter Plan";
    const name = rawPlan.replace('prod_', '').replace('_', ' ');
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // --- Date Logic ---
  const getBillingRenewalDate = () => {
    if (!aiCreditsResetDate) return 'N/A';
    const date = new Date(aiCreditsResetDate);

    if (plan.includes('annual')) {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getUsageResetDate = () => {
    const baseDate = aiCreditsResetDate ? new Date(aiCreditsResetDate) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 1);
    return baseDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const billingDate = getBillingRenewalDate();
  const usageDate = getUsageResetDate();
  // ------------------

  const displayCredits = Math.floor(aiCredits / 100);
  const displayLimit = Math.floor(aiCreditsLimit / 100);
  const creditPercent = displayLimit > 0 ? (displayCredits / displayLimit) * 100 : 0;

  const isPaid = plan !== 'free';
  const pdfLimit = isPaid ? 'Unlimited' : 50;
  const pdfPercent = isPaid ? 100 : Math.min((pdfUsageCount / 50) * 100, 100);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Account & Usage">
          <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Subscription & Usage
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">

          {/* Plan Section - Cleaner Layout */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold text-xl leading-none tracking-tight text-foreground">
                {formatPlanName(plan)}
              </h4>
              <div className="text-sm text-muted-foreground">
                <span className={`inline-flex items-center capitalize font-medium ${planStatus === 'active' ? 'text-green-600 dark:text-green-400' : ''}`}>
                  {planStatus}
                </span>
                {isPaid && (
                  <>
                    <span className="mx-2 text-muted-foreground/50">•</span>
                    <span>{planStatus === 'canceled' ? 'Expires' : 'Renews'} {billingDate}</span>
                  </>
                )}
              </div>
            </div>
            {isPaid && (
              <Button variant="outline" size="sm" onClick={handlePortal} className="h-8 gap-2">
                Manage
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>

          <Separator />

          {/* Usage Stats */}
          <div className="space-y-6">

            {/* AI Credits */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  AI Credits
                </div>
                <div className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium text-sm">{displayCredits.toLocaleString()}</span>
                  <span className="mx-1">/</span>
                  {displayLimit.toLocaleString()}
                </div>
              </div>
              <Progress value={creditPercent} className="h-2" indicatorClassName="bg-amber-500" />
              <p className="text-[11px] text-muted-foreground text-right">
                Monthly reset on {usageDate}
              </p>
            </div>

            {/* PDF Usage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <FileText className="h-4 w-4 text-blue-500" />
                  PDF Exports
                </div>
                <div className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium text-sm">{pdfUsageCount}</span>
                  <span className="mx-1">/</span>
                  {pdfLimit}
                </div>
              </div>
              <Progress value={pdfPercent} className="h-2" indicatorClassName={isPaid ? "bg-green-500" : "bg-blue-500"} />
              {!isPaid && (
                <p className="text-[11px] text-muted-foreground text-right">
                  Upgrade for unlimited exports
                </p>
              )}
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}