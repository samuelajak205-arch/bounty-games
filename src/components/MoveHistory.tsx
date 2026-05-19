import React from 'react';

interface MoveHistoryProps {
  history: string[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ history }) => {
  return (
    <div className="bg-gray-100 p-4 rounded shadow-inner h-64 overflow-y-auto">
      <h3 className="font-bold mb-2">Move History</h3>
      <ol className="grid grid-cols-2 gap-x-4">
        {history.map((move, index) => (
          <li key={index} className="text-sm">
            {Math.floor(index / 2) + 1}. {move}
          </li>
        ))}
      </ol>
    </div>
  );
};
