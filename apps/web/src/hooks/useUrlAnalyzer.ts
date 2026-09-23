import { useState } from "react";
import { api, errorMessage } from "#lib/api";

export interface PossibleDuplicate {
  id: number;
  name: string;
  url: string;
  category: string;
  score: number;
}

export interface AnalyzeResult {
  name: string;
  note: string;
  category: string;
  tags: string[];
  icon: string;
  possibleDuplicates?: PossibleDuplicate[];
}

/** "AI 识别": fills the form from a URL and flags items it may duplicate. */
export function useUrlAnalyzer(onResult: (data: AnalyzeResult) => void) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [possibleDuplicates, setPossibleDuplicates] = useState<PossibleDuplicate[]>([]);

  async function analyze(url: string) {
    setAnalyzing(true);
    setAnalyzeMsg("");
    setPossibleDuplicates([]);
    try {
      const data = await api<AnalyzeResult>("/api/items/analyze", { json: { url } });
      onResult(data);
      setPossibleDuplicates(data.possibleDuplicates ?? []);
    } catch (err) {
      setAnalyzeMsg(errorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  }

  return { analyzing, analyzeMsg, possibleDuplicates, analyze };
}
