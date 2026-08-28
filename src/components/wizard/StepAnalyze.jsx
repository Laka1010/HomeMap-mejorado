import { useState, useEffect } from "react";
import { Sparkles, Check, ChevronRight } from "lucide-react";
import { detectObjects } from "../../services/visionService";
import { useTranslation } from "../../i18n";

export function StepAnalyze({ data, onChange, onNext }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("analyzing"); // analyzing -> results
  const [prediction, setPrediction] = useState(null);

  useEffect(() => {
    const analyze = async () => {
      if (!data.photo) {
        onNext();
        return;
      }

      try {
        // Simular un pequeño retraso para la animación
        await new Promise(r => setTimeout(r, 1500));

        // En una app real pasaríamos el file real, aquí simulamos con el base64 o llamamos al servicio
        // Para el propósito del wizard, usaremos el servicio existente
        const blob = await (await fetch(data.photo)).blob();
        const results = await detectObjects(blob);

        if (results && results.length > 0) {
          setPrediction(results[0]);
          setStatus("results");
        } else {
          onNext(); // Si no detecta nada, pasamos al siguiente paso
        }
      } catch (e) {
        console.error("Error analizando imagen:", e);
        onNext();
      }
    };

    analyze();
  }, []);

  const handleAccept = () => {
    onChange({
      name: prediction.name,
      category: prediction.category
    });
    onNext();
  };

  if (status === "analyzing") {
    return (
      <div className="wizard-step-container">
        <div className="ai-loader-container">
          <div className="ai-pulse" />
          <Sparkles className="ai-icon-spinning" size={48} />
        </div>
        <h2 className="hm-display wizard-title">{t("wizard.stepAnalyzeTitle")}</h2>
        <p className="wizard-subtitle">{t("wizard.stepAnalyzeSubtitle")}</p>

        <style>{`
          .ai-loader-container {
            position: relative;
            width: 120px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 32px;
          }
          .ai-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: var(--accent-soft);
            animation: pulse 2s infinite ease-out;
          }
          .ai-icon-spinning {
            color: var(--accent);
            z-index: 1;
            animation: float 3s infinite ease-in-out;
          }
          @keyframes pulse {
            0% { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(1.4); opacity: 0; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          .wizard-subtitle {
            color: var(--ink-soft);
            max-width: 300px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="wizard-step-container">
      <h2 className="hm-display wizard-title">{t("wizard.stepAnalyzeDetected")}</h2>

      <div className="ai-result-card">
        <div className="ai-result-header">
          <div className="ai-badge">{t("wizard.stepAnalyzeBadge")}</div>
          <div className="ai-confidence">{t("wizard.stepAnalyzeConfidence", { percent: Math.round(prediction.confidence * 100) })}</div>
        </div>

        <div className="ai-result-body">
          <div className="ai-result-name">{prediction.name}</div>
          <div className="ai-result-category">{t("wizard.stepAnalyzeCategoryLabel", { category: prediction.category })}</div>
        </div>

        <div className="ai-result-actions">
          <button className="hm-btn hm-btn-primary ai-btn" onClick={handleAccept}>
            <Check size={18} /> {t("wizard.stepAnalyzeAccept")}
          </button>
          <button className="hm-btn hm-btn-ghost" onClick={onNext}>
            {t("wizard.stepAnalyzeModify")} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .ai-result-card {
          background: var(--surface);
          border: 1px solid var(--accent);
          border-radius: 24px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 30px -10px var(--accent-soft);
          text-align: left;
        }
        .ai-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .ai-badge {
          background: var(--accent);
          color: white;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .ai-confidence {
          font-size: 12px;
          color: var(--success);
          font-weight: 600;
        }
        .ai-result-name {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .ai-result-category {
          color: var(--ink-soft);
          font-size: 15px;
          margin-bottom: 24px;
        }
        .ai-result-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ai-btn {
          justify-content: center;
          padding: 14px !important;
        }
      `}</style>
    </div>
  );
}
