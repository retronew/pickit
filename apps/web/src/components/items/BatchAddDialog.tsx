import { useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { toastError, toastSuccess } from "#lib/api";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "#components/ui/dialog";
import { Textarea } from "#components/ui/textarea";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { Field, FieldLabel, FieldDescription } from "#components/ui/field";
import { Confirm } from "#components/Confirm";
import { BatchReviewStep, type SlideDirection } from "#components/items/batch/BatchReviewStep";
import { BatchSummaryStep } from "#components/items/batch/BatchSummaryStep";
import { useBatchAdd, type Decision } from "#hooks/useBatchAdd";
import { parseBatchUrls } from "#lib/batch-urls";
import { m } from "#lib/i18n";

type Step = "input" | "review" | "summary";

/**
 * Batch add in three steps: paste URLs → review each analyzed entry
 * (accept / edit / discard) → check the accepted ones and save them.
 */
export function BatchAddDialog({
  open,
  onOpenChange,
  onDone,
  categories,
  allTags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  categories: string[];
  allTags: string[];
}) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<SlideDirection>("next");
  const batch = useBatchAdd();
  const urls = parseBatchUrls(text);
  const accepted = batch.entries.filter((e) => e.decision === "accepted");

  function navigate(to: number) {
    setDirection(to < index ? "prev" : "next");
    setIndex(to);
  }

  function start() {
    if (urls.length === 0) return;
    batch.start(urls);
    setIndex(0);
    setDirection("next");
    setStep("review");
  }

  function decide(url: string, decision: Decision) {
    batch.decide(url, decision);
    // Move on to the next undecided entry, wrapping around; none left → summary.
    const pending = batch.entries.map((e, i) => (e.url !== url && e.decision === "pending" ? i : -1)).filter((i) => i >= 0);
    const next = pending.find((i) => i > index) ?? pending[0];
    if (next == null) setStep("summary");
    else navigate(next);
  }

  async function save() {
    const r = await batch.saveAccepted();
    const summary = r.failed
      ? m.batch_summary_failed({ added: r.added, skipped: r.skipped, failed: r.failed })
      : m.batch_summary({ added: r.added, skipped: r.skipped });
    if (r.failed && !r.added) toastError(m.batch_failed(), new Error(summary), { id: "batch-add" });
    else toastSuccess(m.batch_done(), { description: summary, id: "batch-add" });
    if (r.added || r.skipped) onDone();
    // Failed entries stay in the summary with their error for another try.
    if (!r.failed) reset();
  }

  function reset() {
    batch.reset();
    setText("");
    setStep("input");
    onOpenChange(false);
  }

  async function close() {
    if (batch.saving) return;
    if (step !== "input" && accepted.length > 0) {
      const ok = await Confirm.call({
        title: m.batch_leave_title(),
        message: m.batch_leave_message({ count: accepted.length }),
        confirmLabel: m.batch_leave_confirm(),
        danger: true,
      });
      if (!ok) return;
    }
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogPopup className={step === "review" ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{m.batch_title()}</DialogTitle>
          {step === "summary" && (
            <DialogDescription>{m.batch_summary_title({ count: accepted.length })}</DialogDescription>
          )}
        </DialogHeader>
        <DialogPanel>
          {step === "input" && (
            <Field>
              <FieldLabel htmlFor="batch-urls">{m.batch_label()}</FieldLabel>
              <Textarea
                id="batch-urls"
                className="min-h-40 font-mono text-xs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"https://a.com\nhttps://b.com"}
              />
              <FieldDescription>{m.batch_hint()}</FieldDescription>
            </Field>
          )}
          {step === "review" && batch.entries.length > 0 && (
            <BatchReviewStep
              entries={batch.entries}
              index={Math.min(index, batch.entries.length - 1)}
              direction={direction}
              onNavigate={navigate}
              onUpdate={batch.updateForm}
              onDecide={decide}
              categories={categories}
              allTags={allTags}
            />
          )}
          {step === "summary" && (
            <BatchSummaryStep entries={accepted} onRemove={(url) => batch.decide(url, "discarded")} />
          )}
        </DialogPanel>
        <DialogFooter>
          {step === "input" && (
            <>
              <Button variant="outline" onClick={close}>
                {m.common_cancel()}
              </Button>
              <Button onClick={start} disabled={urls.length === 0}>
                {m.batch_start({ count: urls.length })}
              </Button>
            </>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={close}>
                {m.common_cancel()}
              </Button>
              <Button onClick={() => setStep("summary")}>{m.batch_to_summary({ count: accepted.length })}</Button>
            </>
          )}
          {step === "summary" && (
            <>
              <Button variant="outline" disabled={batch.saving} onClick={() => setStep("review")}>
                <ArrowLeftIcon />
                {m.batch_back()}
              </Button>
              <Button disabled={accepted.length === 0 || batch.saving} onClick={save}>
                {batch.saving && <Spinner />}
                {m.batch_save({ count: accepted.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
