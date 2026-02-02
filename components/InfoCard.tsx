import React from 'react';

interface InfoCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, value, subValue, icon, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-900/20 border-blue-800 text-blue-400",
    green: "bg-green-900/20 border-green-800 text-green-400",
    purple: "bg-purple-900/20 border-purple-800 text-purple-400",
    yellow: "bg-yellow-900/20 border-yellow-800 text-yellow-400",
    red: "bg-red-900/20 border-red-800 text-red-400",
  };

  const selectedColor = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <div className={`p-4 rounded-xl border ${selectedColor} backdrop-blur-sm flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        <div className="p-1.5 rounded-lg bg-white/5">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
        {subValue && <div className="text-xs mt-1 opacity-70">{subValue}</div>}
      </div>
    </div>
  );
};

export default InfoCard;
