import React from 'react';
import { Board } from '../components/Board';
import { MoveHistory } from '../components/MoveHistory';
import { useChessGame } from '../hooks/useChessGame';

export const PlayVsHuman: React.FC = () => {
  const game = useChessGame();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Chess: Human vs Human</h1>
      <div className="flex flex-col md:flex-row gap-8">
        <Board 
          position={game.fen} 
          onPieceDrop={(source, target) => game.makeMove({ from: source, to: target, promotion: 'q' })} 
        />
        <div className="flex-1">
          <div className="flex gap-4 mb-4">
            <button 
              onClick={game.resetGame} 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Reset
            </button>
            <button 
              onClick={game.undoMove} 
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Undo
            </button>
          </div>
          <MoveHistory history={game.history} />
        </div>
      </div>
    </div>
  );
};
