import { Brain, Link, ChevronRight, AlertTriangle, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { KNOWN_ISSUES_NQ5, DTC_DATABASE } from "./dtcDatabase";
import { getExpertAdvice, ExpertAdvice } from "@/services/AutoWizardService";
import { useState } from "react";

interface AIAnalysisProps {
  detectedCodes: string[];
}

export default function AIAnalysis({ detectedCodes }: AIAnalysisProps) {
  const activeIssues = KNOWN_ISSUES_NQ5.filter(issue =>
    issue.codes.some((c: string) => detectedCodes.includes(c))
  );

  const allUnknown = detectedCodes.filter((c: string) => !(c in DTC_DATABASE));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-semibold text-sm">Analyse IA Contextuelle</h3>
        <span className="text-[10px] text-purple-400 px-1.5 py-0.5 rounded bg-purple-400/10">NQ5 Expert</span>
      </div>

      {detectedCodes.length === 0 ? (
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-[#C9D1D9] text-sm">Aucun code défaut détecté</p>
          <p className="text-[#8B949E] text-xs mt-1">Lancez un scan réseau pour analyser le véhicule</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeIssues.map((issue, i) => (
            <div key={i} className="bg-[#0D1117] border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-purple-400 text-[10px] font-bold">{issue.priority}</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{issue.title}</p>
                  <p className="text-[#8B949E] text-xs mt-1 leading-relaxed">{issue.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {issue.codes.map((c, j) => (
                  <span key={j} className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    detectedCodes.includes(c) ? "bg-red-500/20 text-red-400" : "bg-[#1C2128] text-[#8B949E]"
                  }`}>{c}</span>
                ))}
              </div>
            </div>
          ))}

          {allUnknown.length > 0 && (
            <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-amber-400 text-sm font-medium">Codes non référencés NQ5</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {allUnknown.map((c, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">{c}</span>
                ))}
              </div>
              <p className="text-[#8B949E] text-xs mt-2">Consulter documentation KIA officielle ou mise à jour de base de données.</p>
            </div>
          )}

          {activeIssues.length === 0 && detectedCodes.length > 0 && (
            <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4">
              <p className="text-[#8B949E] text-xs">Aucune corrélation critique identifiée entre les codes présents.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
