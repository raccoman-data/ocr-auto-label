import React from 'react';
import { Upload, Palette, Sparkles, Edit, Download } from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export function HowItWorks({ className = '' }: { className?: string }) {
  const steps: Step[] = [
    {
      icon: <Sparkles className="w-4 h-4" />,
      title: "AI Processing",
      description: "Extract sample codes from images using Gemini Vision",
      color: "text-slate-600"
    },
    {
      icon: <Palette className="w-4 h-4" />,
      title: "Smart Grouping", 
      description: "Match unlabeled images using color and timing",
      color: "text-slate-600"
    },
    {
      icon: <Edit className="w-4 h-4" />,
      title: "Quick Editing",
      description: "Fix names with spreadsheet-like shortcuts",
      color: "text-slate-600"
    },
    {
      icon: <Download className="w-4 h-4" />,
      title: "Export",
      description: "Download renamed images and extracted data sheet as ZIP file",
      color: "text-slate-600"
    }
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <div key={index} className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-transparent border border-slate-200 flex items-center justify-center">
                <div className={step.color}>
                  {step.icon}
                </div>
              </div>
            </div>
            <h5 className="text-xs font-semibold text-foreground mb-1">{step.title}</h5>
            <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 