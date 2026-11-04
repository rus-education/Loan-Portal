"use client";

import * as React from "react";
import {
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  X,
  Phone,
  User,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import {
  generateWhatsAppMessage,
  getWhatsAppShareUrl,
  cleanIndianPhoneNumber,
  type LoanWhatsAppPayload,
} from "@/lib/whatsapp";

interface WhatsAppShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: LoanWhatsAppPayload | null;
  onContinue?: () => void;
  continueLabel?: string;
}

export function WhatsAppShareDialog({
  isOpen,
  onClose,
  data,
  onContinue,
  continueLabel = "View Application Record",
}: WhatsAppShareDialogProps) {
  const [recipientNumber, setRecipientNumber] = React.useState<string>("");
  const [isCopied, setIsCopied] = React.useState(false);

  // Sync recipient number when data changes
  React.useEffect(() => {
    if (data?.contactNumber) {
      setRecipientNumber(cleanIndianPhoneNumber(data.contactNumber));
    }
  }, [data]);

  if (!data) return null;

  const generatedMessage = generateWhatsAppMessage(data);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setIsCopied(true);
      toast.success("WhatsApp template copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleOpenWhatsApp = () => {
    const targetPhone = recipientNumber.trim() || data.contactNumber;
    const shareUrl = getWhatsAppShareUrl(targetPhone, generatedMessage);
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Student Loan Application - ${data.studentName}`,
          text: generatedMessage,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast.error("Share failed. Please copy the template instead.");
        }
      }
    } else {
      handleCopy();
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl rounded-3xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-2xl max-h-[92vh] flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 shadow-xs">
                  <MessageCircle className="h-5 w-5 fill-[#25D366]/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">
                      Share Intake on WhatsApp
                    </h2>
                    <Badge variant="outline" className="border-[#25D366]/40 text-[#25D366] text-[10px] py-0 font-semibold">
                      Live Template
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instantly deliver loan submission details to student / parent WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Recipient Target Phone Control */}
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">
                    {data.studentName}
                  </span>
                  {data.sdmId && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ({data.sdmId})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                    Send to +91:
                  </span>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="tel"
                      maxLength={10}
                      value={recipientNumber}
                      onChange={(e) =>
                        setRecipientNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="9876543210"
                      className="h-8 w-32 pl-8 text-xs font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Message Preview Bubble */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    WhatsApp Message Preview
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Standardized Customer Notification
                  </span>
                </div>

                <div className="relative rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap select-all text-foreground max-h-[320px] overflow-y-auto shadow-inner">
                  {generatedMessage}
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-3.5 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5 text-xs font-semibold"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Template</span>
                    </>
                  )}
                </Button>

                {canNativeShare && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNativeShare}
                    className="gap-1.5 text-xs"
                    title="Share via device menu"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onContinue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onContinue}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {continueLabel}
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenWhatsApp}
                  className="gap-2 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-sm"
                >
                  <MessageCircle className="h-4 w-4 fill-white" />
                  <span>Send on WhatsApp</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
