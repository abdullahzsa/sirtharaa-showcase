import { useState } from "react";
import { DocumentPreview } from "@/components/document-preview";
import { SAMPLE_RESUME_TEXT } from "@/sample-resume";
import type { TemplateId } from "@/lib/templates";

export default function App() {
  const [template, setTemplate] = useState<TemplateId>("classic");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        Document Export & Preview Showcase
      </h1>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["classic", "compact", "executive"] as TemplateId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTemplate(t)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: template === t ? "#0B1322" : "#f5f5f5",
              color: template === t ? "#fff" : "#000",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <DocumentPreview 
        text={SAMPLE_RESUME_TEXT} 
        template={template} 
        lang="en" 
      />
    </div>
  );
}
