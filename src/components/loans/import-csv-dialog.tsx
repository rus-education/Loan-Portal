"use client";

import * as React from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Download,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

interface ImportCsvDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole?: string;
  userBranchCode?: string;
}

interface RowError {
  row: number;
  sdmId?: string;
  error: string;
}

interface PreviewRow {
  rowNumber: number;
  sdmId: string;
  studentName: string;
  contactNumber: string;
  branchCode: string;
  course: string;
  country: string;
  loanAmount: number;
  intakeMonth: string;
  intakeYear: number;
}

export function ImportCsvDialog({
  isOpen,
  onClose,
  onSuccess,
  userRole,
  userBranchCode,
}: ImportCsvDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [csvText, setCsvText] = React.useState<string>("");
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [validationSummary, setValidationSummary] = React.useState<{
    totalRows: number;
    validCount: number;
    invalidCount: number;
  } | null>(null);
  const [errors, setErrors] = React.useState<RowError[]>([]);
  const [previewRows, setPreviewRows] = React.useState<PreviewRow[]>([]);

  const handleClose = () => {
    if (isImporting) return;
    setFile(null);
    setCsvText("");
    setValidationSummary(null);
    setErrors([]);
    setPreviewRows([]);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a valid .csv file");
      return;
    }

    setFile(selected);
    const text = await selected.text();
    setCsvText(text);

    // Auto-trigger dry-run validation
    await runValidation(text);
  };

  const runValidation = async (content: string) => {
    setIsValidating(true);
    setValidationSummary(null);
    setErrors([]);
    setPreviewRows([]);

    try {
      const res = await apiFetch("/api/loans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: content, dryRun: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "CSV validation failed");
        return;
      }

      setValidationSummary(data.summary);
      setErrors(data.errors || []);
      setPreviewRows(data.preview || []);

      if (data.summary?.invalidCount === 0 && data.summary?.validCount > 0) {
        toast.success(`Validation passed: ${data.summary.validCount} rows ready for import!`);
      } else if (data.summary?.validCount > 0) {
        toast.warning(
          `Found ${data.summary.validCount} valid rows and ${data.summary.invalidCount} rows with issues.`
        );
      } else {
        toast.error("No valid rows could be imported. Please review the errors below.");
      }
    } catch (err) {
      console.error("Validation error:", err);
      toast.error("Network error validating CSV file.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvText || !validationSummary || validationSummary.validCount === 0) return;

    setIsImporting(true);
    try {
      const res = await apiFetch("/api/loans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: csvText, dryRun: false }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to complete CSV import");
        return;
      }

      toast.success(
        `Successfully imported ${data.summary?.importedCount || 0} loan applications into database!`
      );
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Import execution error:", err);
      toast.error("Network error executing import.");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const branchCodeToUse = userBranchCode || (userRole === "BRANCH_USER" ? "NDLS" : "NDLS");
    const headers = [
      "SDM ID",
      "Student Name",
      "Contact Number",
      "Branch Code",
      "Course",
      "Country",
      "Loan Amount",
      "Intake Month",
      "Intake Year",
      "Parent/Guardian Income",
      "Current Stage",
      "Remarks",
    ];

    const sampleRow1 = [
      `SDM-IMP-${Date.now().toString().slice(-4)}1`,
      "Aarav Sharma",
      "+91 98111 22334",
      branchCodeToUse,
      "MSc Computer Science",
      "United Kingdom",
      "3500000",
      "September",
      "2026",
      "Salaried - Senior Software Architect (₹32 LPA)",
      "Initial Inquiry",
      "Offer letter received from University of Manchester",
    ];

    const sampleRow2 = [
      `SDM-IMP-${Date.now().toString().slice(-4)}2`,
      "Ananya Sen",
      "+91 98222 33445",
      branchCodeToUse,
      "Master of Data Science",
      "United States",
      "4800000",
      "January",
      "2027",
      "Business - Wholesale Electronics (₹45 LPA)",
      "Initial Inquiry",
      "GRE 328 and CMU admission confirmed",
    ];

    const csvContent =
      "\uFEFF" +
      [headers.join(","), sampleRow1.join(","), sampleRow2.join(",")].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "loan_application_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample import template downloaded");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={!isImporting ? handleClose : undefined}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Import Loan Applications (CSV)</h2>
                  <p className="text-xs text-muted-foreground">
                    Upload batches safely with pre-validation and row-by-row error auditing.
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isImporting}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Template Download & Guidelines Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <div>
                  <p className="font-semibold text-foreground">Need the standardized template?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Download the official CSV format with proper header columns and sample candidate data.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadSampleTemplate}
                  className="gap-1.5 h-8 text-xs shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template</span>
                </Button>
              </div>

              {/* Upload Drop Zone */}
              <div className="rounded-xl border-2 border-dashed border-border/80 bg-card/40 p-6 text-center hover:bg-card/70 transition-colors">
                <input
                  type="file"
                  id="csvFileInput"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isValidating || isImporting}
                  className="hidden"
                />
                <label
                  htmlFor="csvFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      {file ? file.name : "Click to select or drag and drop CSV file"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {file
                        ? `${(file.size / 1024).toFixed(1)} KB • Click to choose a different file`
                        : "Supports UTF-8 CSV formatted batches"}
                    </p>
                  </div>
                </label>
              </div>

              {/* Validation Spinner */}
              {isValidating && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Validating CSV structure and business rules...</span>
                </div>
              )}

              {/* Validation Summary Badges */}
              {validationSummary && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      Total: {validationSummary.totalRows} Rows
                    </Badge>
                    <Badge variant="default" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Valid: {validationSummary.validCount}
                    </Badge>
                    {validationSummary.invalidCount > 0 && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Errors: {validationSummary.invalidCount}
                      </Badge>
                    )}
                  </div>

                  {/* Errors Box */}
                  {errors.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Validation Errors ({errors.length}):</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-destructive/10 text-[11px]">
                        {errors.map((err, idx) => (
                          <div key={idx} className="pt-1 first:pt-0 flex items-start gap-2">
                            <span className="font-mono font-bold text-destructive shrink-0">
                              Row {err.row}:
                            </span>
                            <span className="text-muted-foreground">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid Rows Preview Table */}
                  {previewRows.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                        Valid Rows Preview (first {previewRows.length}):
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                              <th className="p-2">SDM ID</th>
                              <th className="p-2">Student</th>
                              <th className="p-2">Branch</th>
                              <th className="p-2">Course</th>
                              <th className="p-2 text-right">Amount</th>
                              <th className="p-2">Intake</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {previewRows.map((r, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                <td className="p-2 font-mono font-medium">{r.sdmId}</td>
                                <td className="p-2">{r.studentName}</td>
                                <td className="p-2 font-mono">{r.branchCode}</td>
                                <td className="p-2 truncate max-w-[140px]">{r.course}</td>
                                <td className="p-2 text-right font-mono font-semibold">
                                  {formatCurrency(r.loanAmount)}
                                </td>
                                <td className="p-2">{r.intakeMonth} {r.intakeYear}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isImporting}
              >
                Cancel
              </Button>

              <Button
                variant="gradient"
                size="sm"
                onClick={handleExecuteImport}
                disabled={
                  !validationSummary ||
                  validationSummary.validCount === 0 ||
                  isValidating ||
                  isImporting
                }
                className="gap-2 shadow-xs"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing Records...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Import ({validationSummary?.validCount || 0} Records)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
