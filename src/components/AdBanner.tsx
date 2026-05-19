import React from 'react';

interface AdBannerProps {
  slot: string;
  className?: string;
}

/**
 * Placeholder for Google AdSense integration as suggested in MVP roadmap.
 */
export const AdBanner: React.FC<AdBannerProps> = ({ slot, className = "" }) => {
  return (
    <div className={`w-full bg-gray-50 border border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center group transition-colors hover:bg-white ${className}`}>
      <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-2">Advertisement</div>
      <div className="text-xs font-bold text-gray-400 opacity-50 mb-1">External Partner Network</div>
      <div className="text-[9px] text-gray-300 font-mono">Slot ID: {slot}</div>
      
      {/* Visual placeholder for the "Ads" experience without actual scripts */}
      <div className="mt-4 w-full h-px bg-gray-100 scale-x-50 group-hover:scale-x-100 transition-transform" />
      <p className="mt-4 text-[10px] text-gray-400 italic font-medium">Support GM AI by exploring our partners</p>
    </div>
  );
};
